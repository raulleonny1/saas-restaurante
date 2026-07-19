"use client";

import { getDb, getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { firebaseErrorCode, mapAuthError } from "@/lib/auth-errors";
import { stripUndefined } from "@/lib/firestore-safe";
import { buildMemberPermissionCache } from "@/lib/rbac/evaluate";
import { ROLES_WITH_VENUE } from "@/lib/roles";
import {
  createBranchDocument,
  createMemberDocument,
  createRestaurantDocument,
  createTenantBillingDocument,
  createUserDocument,
} from "@/models/schemas";
import { defaultWebsiteSettings } from "@/modules/website/domain/defaults";
import type {
  AppUser,
  ResetPasswordInput,
  SignInCredentials,
  SignUpCredentials,
  UserRole,
} from "@/types/auth";
import type { RoleId } from "@/types/rbac";
import type { Member } from "@/types/restaurant";
import type { RestaurantSlugIndex } from "@/types/website";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  runTransaction,
  setDoc,
  updateDoc,
} from "firebase/firestore";

function assertFirebase(): void {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase Auth no está configurado. Añade las variables NEXT_PUBLIC_FIREBASE_* en .env.local.",
    );
  }
}

async function readUserProfile(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(getDb(), "users", uid));
  if (!snap.exists()) return null;
  return snap.data() as AppUser;
}

/**
 * Race fix: onAuthStateChanged often fires during signUp and used to create
 * users/{uid} with role "cliente", overwriting "propietario".
 * - Create profile only if missing (transaction).
 * - Repair cliente + restaurantIds using membership / ownership.
 */
async function repairMislabeledOwner(user: AppUser): Promise<AppUser> {
  if (user.role !== "cliente" || !user.restaurantIds?.length) return user;

  const stamp = new Date().toISOString();
  let repairedRole: RoleId | null = null;

  for (const restaurantId of user.restaurantIds) {
    const memberRef = doc(
      getDb(),
      "restaurants",
      restaurantId,
      "members",
      user.uid,
    );
    const memberSnap = await getDoc(memberRef);
    if (!memberSnap.exists()) continue;

    const member = memberSnap.data() as Member;
    const memberRole = (member.roleId ?? member.role) as RoleId;

    if (memberRole === "propietario" || memberRole === "gerente") {
      repairedRole = memberRole;
      break;
    }

    // Both profile and member stamped as cliente after signup race → owner
    if (memberRole === "cliente") {
      const cache = buildMemberPermissionCache({ roleId: "propietario" });
      await updateDoc(memberRef, {
        role: "propietario",
        roleId: "propietario",
        permissionsCached: cache.permissionsCached,
        permissionsVersion: cache.permissionsVersion,
        updatedAt: stamp,
      });
      repairedRole = "propietario";
      break;
    }

    // Invited staff: sync global hint to membership role
    if (memberRole && memberRole !== "cliente") {
      repairedRole = memberRole;
      break;
    }
  }

  if (!repairedRole) {
    // Has restaurants but no usable member role → venue creator
    repairedRole = "propietario";
  }

  await updateDoc(doc(getDb(), "users", user.uid), {
    role: repairedRole,
    updatedAt: stamp,
  });

  return { ...user, role: repairedRole, updatedAt: stamp };
}

async function ensureUserProfile(
  fbUser: User,
  fallbackRole: UserRole = "cliente",
): Promise<AppUser> {
  const userRef = doc(getDb(), "users", fbUser.uid);
  let existing = await readUserProfile(fbUser.uid);
  if (existing) return repairMislabeledOwner(existing);

  const appUser = createUserDocument(
    fbUser.uid,
    fbUser.email ?? "",
    fbUser.displayName ?? fbUser.email?.split("@")[0] ?? "Usuario",
    fallbackRole,
  );

  // Create-only: never overwrite a profile written by signUp
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(userRef);
    if (snap.exists()) return;
    tx.set(userRef, stripUndefined({ ...appUser }));
  });

  existing = await readUserProfile(fbUser.uid);
  if (!existing) return appUser;
  return repairMislabeledOwner(existing);
}

async function forceUserRole(
  uid: string,
  role: RoleId,
  restaurantIds?: string[],
): Promise<void> {
  await setDoc(
    doc(getDb(), "users", uid),
    stripUndefined({
      role,
      ...(restaurantIds ? { restaurantIds } : {}),
      updatedAt: new Date().toISOString(),
    }),
    { merge: true },
  );
}

async function writeStep(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    const code = firebaseErrorCode(error);
    const mapped = mapAuthError(error);
    throw new Error(`${mapped} (paso: ${label}${code ? ` · ${code}` : ""})`);
  }
}

async function provisionRestaurantForAdmin(
  user: AppUser,
  restaurantName: string,
): Promise<AppUser> {
  const restaurant = createRestaurantDocument(
    restaurantName.trim() || "Mi restaurante",
  );
  const branch = createBranchDocument(restaurant.id, "Principal", {
    code: "MAIN",
    isDefault: true,
  });
  restaurant.settings.defaultBranchId = branch.id;

  const member = createMemberDocument(
    restaurant.id,
    { ...user, role: "propietario" },
    [],
  );

  // Core tenant (must succeed)
  await writeStep("crear restaurante", () =>
    setDoc(
      doc(getDb(), "restaurants", restaurant.id),
      stripUndefined({ ...restaurant, deletedAt: null }),
    ),
  );
  await writeStep("crear membresía", () =>
    setDoc(
      doc(getDb(), "restaurants", restaurant.id, "members", user.uid),
      stripUndefined({ ...member }),
    ),
  );
  await writeStep("crear sucursal", () =>
    setDoc(
      doc(getDb(), "restaurants", restaurant.id, "branches", branch.id),
      stripUndefined({ ...branch, deletedAt: null }),
    ),
  );

  try {
    const billing = createTenantBillingDocument(restaurant.id, user.email);
    await setDoc(
      doc(getDb(), "restaurants", restaurant.id, "billing", "current"),
      stripUndefined({ ...billing }),
    );
  } catch (error) {
    console.warn("[signUp] billing no provisionado:", firebaseErrorCode(error));
  }

  // Website extras (best-effort — requires published firestore.rules)
  const website = defaultWebsiteSettings(restaurant.id, restaurant.name);
  const { customDomain: _c, ...websiteSafe } = website;
  try {
    await setDoc(
      doc(getDb(), "restaurants", restaurant.id, "websiteSettings", "default"),
      stripUndefined({ ...websiteSafe }),
    );
    if (restaurant.slug) {
      const slugIndex: RestaurantSlugIndex = {
        slug: restaurant.slug,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        published: true,
        updatedAt: restaurant.createdAt,
      };
      await setDoc(
        doc(getDb(), "restaurantSlugs", restaurant.slug),
        stripUndefined({ ...slugIndex }),
      );
    }
  } catch (error) {
    console.warn(
      "[signUp] Sitio web no provisionado (¿reglas publicadas?):",
      firebaseErrorCode(error),
      error,
    );
  }

  const next: AppUser = {
    ...user,
    role: "propietario",
    restaurantIds: [...user.restaurantIds, restaurant.id],
    updatedAt: new Date().toISOString(),
  };
  await writeStep("actualizar perfil", () =>
    updateDoc(doc(getDb(), "users", user.uid), {
      restaurantIds: next.restaurantIds,
      role: next.role,
      updatedAt: next.updatedAt,
    }),
  );
  return next;
}

export async function signUp(input: SignUpCredentials): Promise<AppUser> {
  assertFirebase();

  try {
    const auth = getFirebaseAuth();
    let cred;
    try {
      cred = await createUserWithEmailAndPassword(
        auth,
        input.email.trim(),
        input.password,
      );
    } catch (error) {
      throw new Error(mapAuthError(error));
    }

    try {
      await updateProfile(cred.user, { displayName: input.displayName.trim() });
    } catch {
      /* non-fatal */
    }

    const resolvedRole: RoleId = ROLES_WITH_VENUE.includes(input.role)
      ? "propietario"
      : input.role;

    let appUser = createUserDocument(
      cred.user.uid,
      input.email.trim(),
      input.displayName.trim(),
      resolvedRole,
    );
    // Full overwrite so a raced "cliente" stub cannot win
    await writeStep("crear usuario", () =>
      setDoc(
        doc(getDb(), "users", cred.user.uid),
        stripUndefined({ ...appUser }),
      ),
    );

    if (ROLES_WITH_VENUE.includes(input.role)) {
      appUser = await provisionRestaurantForAdmin(
        appUser,
        input.restaurantName ?? "Mi restaurante",
      );
    }

    // Final stamp — beats any concurrent ensureUserProfile(cliente)
    await writeStep("fijar rol", () =>
      forceUserRole(
        cred.user.uid,
        appUser.role,
        appUser.restaurantIds,
      ),
    );

    const finalProfile = await readUserProfile(cred.user.uid);
    const result = finalProfile ?? appUser;
    pushProfileToSession(result);
    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes("(paso:")) {
      throw error;
    }
    throw new Error(mapAuthError(error));
  }
}

export async function signIn(input: SignInCredentials): Promise<AppUser> {
  assertFirebase();

  try {
    const cred = await signInWithEmailAndPassword(
      getFirebaseAuth(),
      input.email.trim(),
      input.password,
    );
    return ensureUserProfile(cred.user);
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  assertFirebase();

  try {
    await sendPasswordResetEmail(getFirebaseAuth(), input.email.trim());
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
}

export async function signOut(): Promise<void> {
  assertFirebase();
  await firebaseSignOut(getFirebaseAuth());
}

export function subscribeAuth(callback: (user: AppUser | null) => void): () => void {
  if (!isFirebaseConfigured()) {
    callback(null);
    return () => undefined;
  }

  return onAuthStateChanged(getFirebaseAuth(), async (fbUser) => {
    if (!fbUser) {
      callback(null);
      return;
    }
    try {
      const profile = await ensureUserProfile(fbUser);
      callback(profile);
    } catch {
      callback(null);
    }
  });
}

export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  assertFirebase();
  await updateDoc(doc(getDb(), "users", uid), {
    role,
    updatedAt: new Date().toISOString(),
  });
}

/** Re-read + repair profile for the signed-in Firebase user. */
export async function reloadCurrentUser(): Promise<AppUser | null> {
  if (!isFirebaseConfigured()) return null;
  const fbUser = getFirebaseAuth().currentUser;
  if (!fbUser) return null;
  return ensureUserProfile(fbUser);
}

type ProfileHook = (user: AppUser) => void;
let profileHook: ProfileHook | null = null;

/** AuthProvider binds this so signUp can push the final role into session state. */
export function bindAuthProfileHook(hook: ProfileHook | null): void {
  profileHook = hook;
}

function pushProfileToSession(user: AppUser): void {
  profileHook?.(user);
}
