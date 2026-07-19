"use client";

import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";
import { createId } from "@/lib/id";
import { buildMemberPermissionCache } from "@/lib/rbac/evaluate";
import { createMemberDocument } from "@/models/schemas";
import type { AppUser } from "@/types/auth";
import type { MemberInvite } from "@/types/billing";
import type { RoleId } from "@/types/rbac";
import type { Member } from "@/types/restaurant";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";

export function subscribeMembers(
  restaurantId: string,
  onData: (rows: Member[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "members"),
    (snap) => {
      onData(
        snap.docs
          .map((d) => d.data() as Member)
          .sort((a, b) => a.displayName.localeCompare(b.displayName)),
      );
    },
    (err) => onError?.(err),
  );
}

export async function getMember(
  restaurantId: string,
  uid: string,
): Promise<Member | null> {
  if (!isFirebaseConfigured()) return null;
  const snap = await getDoc(
    doc(getDb(), "restaurants", restaurantId, "members", uid),
  );
  return snap.exists() ? (snap.data() as Member) : null;
}

export function subscribeMember(
  restaurantId: string,
  uid: string,
  onData: (member: Member | null) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(getDb(), "restaurants", restaurantId, "members", uid),
    (snap) => {
      onData(snap.exists() ? (snap.data() as Member) : null);
    },
    (err) => onError?.(err),
  );
}

export async function updateMember(input: {
  restaurantId: string;
  uid: string;
  patch: Partial<
    Pick<
      Member,
      | "roleId"
      | "role"
      | "branchIds"
      | "active"
      | "permissionAllow"
      | "permissionDeny"
      | "displayName"
    >
  >;
}): Promise<void> {
  const roleId = input.patch.roleId;
  const allow = input.patch.permissionAllow;
  const deny = input.patch.permissionDeny;
  const extra: Record<string, unknown> = {
    ...input.patch,
    updatedAt: new Date().toISOString(),
  };
  if (roleId) {
    extra.role = roleId;
    const cache = buildMemberPermissionCache({
      roleId,
      permissionAllow: allow,
      permissionDeny: deny,
    });
    extra.permissionsCached = cache.permissionsCached;
    extra.permissionsVersion = cache.permissionsVersion;
  }
  await updateDoc(
    doc(getDb(), "restaurants", input.restaurantId, "members", input.uid),
    stripUndefined(extra),
  );
}

function staffInviteId(restaurantId: string, email: string): string {
  const safe = email.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
  return `inv_${restaurantId}_${safe}`;
}

export async function inviteMember(input: {
  restaurantId: string;
  restaurantName: string;
  email: string;
  roleId: RoleId;
  branchIds?: string[];
  invitedBy: string;
}): Promise<MemberInvite> {
  const email = input.email.trim().toLowerCase();
  const stamp = new Date().toISOString();
  const id = staffInviteId(input.restaurantId, email);
  const ref = doc(getDb(), "memberInvites", id);

  // getDoc de doc inexistente falla si las reglas no permiten resource == null
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      const prev = existing.data() as MemberInvite;
      if (prev.status === "accepted") return prev;
      if (prev.status === "pending") {
        await updateDoc(
          ref,
          stripUndefined({
            roleId: input.roleId,
            branchIds: input.branchIds ?? prev.branchIds ?? [],
            restaurantName: input.restaurantName,
            updatedAt: stamp,
          }),
        );
        return {
          ...prev,
          roleId: input.roleId,
          branchIds: input.branchIds ?? prev.branchIds ?? [],
          restaurantName: input.restaurantName,
          updatedAt: stamp,
        };
      }
    }
  } catch {
    /* seguir a create */
  }

  const row: MemberInvite = {
    id,
    restaurantId: input.restaurantId,
    restaurantName: input.restaurantName,
    email,
    roleId: input.roleId,
    branchIds: input.branchIds ?? [],
    invitedBy: input.invitedBy,
    status: "pending",
    createdAt: stamp,
    updatedAt: stamp,
  };
  try {
    await setDoc(ref, stripUndefined({ ...row }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/permission|insufficient/i.test(msg)) {
      throw new Error(
        "Firestore denegó crear la invitación. Publica firestore.rules (Firebase Console → Firestore → Reglas) y vuelve a intentar.",
      );
    }
    throw e;
  }
  return row;
}

/** Idempotent invite for employee alta / backfill (uses stable doc id). */
export async function ensureStaffInvite(input: {
  restaurantId: string;
  restaurantName: string;
  email: string;
  roleId: RoleId;
  branchIds?: string[];
  invitedBy: string;
}): Promise<boolean> {
  try {
    return Boolean(await inviteMember(input));
  } catch {
    return false;
  }
}

export async function listPendingInvites(
  restaurantId: string,
): Promise<MemberInvite[]> {
  const q = query(
    collection(getDb(), "memberInvites"),
    where("restaurantId", "==", restaurantId),
    where("status", "==", "pending"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as MemberInvite);
}

async function linkEmployeeByEmail(input: {
  restaurantId: string;
  email: string;
  uid: string;
  employeeId?: string;
}): Promise<void> {
  const stamp = new Date().toISOString();
  if (input.employeeId) {
    await updateDoc(
      doc(
        getDb(),
        "restaurants",
        input.restaurantId,
        "employees",
        input.employeeId,
      ),
      { uid: input.uid, updatedAt: stamp },
    );
    return;
  }
  const snap = await getDocs(
    collection(getDb(), "restaurants", input.restaurantId, "employees"),
  );
  for (const d of snap.docs) {
    const data = d.data() as { email?: string; uid?: string; deletedAt?: string | null };
    if (data.deletedAt) continue;
    if ((data.email ?? "").trim().toLowerCase() !== input.email) continue;
    if (data.uid === input.uid) continue;
    await updateDoc(d.ref, { uid: input.uid, updatedAt: stamp });
  }
}

type EmployeeEmailIndex = {
  email: string;
  restaurantId: string;
  employeeId: string;
  roleId: RoleId;
  branchIds?: string[];
  name?: string;
  status?: string;
};

/**
 * Activate staff from employees alta (employeeEmailIndex), even if
 * memberInvites was never created.
 */
export async function activateFromEmployeeEmailIndex(
  user: AppUser,
): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  const email = user.email.trim().toLowerCase();
  const indexRef = doc(getDb(), "employeeEmailIndex", email);

  let snap;
  try {
    snap = await getDoc(indexRef);
  } catch (e) {
    console.warn("[activateFromEmployeeEmailIndex] lectura denegada:", e);
    return false;
  }
  if (!snap.exists()) return false;

  const data = snap.data() as EmployeeEmailIndex;
  if (!data.restaurantId || !data.employeeId || !data.roleId) return false;

  try {
    const existing = await getMember(data.restaurantId, user.uid);
    if (!existing) {
      const member = createMemberDocument(
        data.restaurantId,
        {
          ...user,
          role: data.roleId,
          displayName: data.name || user.displayName,
        },
        data.branchIds ?? [],
      );
      await setDoc(
        doc(getDb(), "restaurants", data.restaurantId, "members", user.uid),
        stripUndefined({ ...member }),
      );
    } else {
      const currentRole = existing.roleId ?? existing.role;
      if (currentRole !== data.roleId) {
        await updateMember({
          restaurantId: data.restaurantId,
          uid: user.uid,
          patch: {
            roleId: data.roleId,
            displayName: data.name || existing.displayName || user.displayName,
            active: true,
          },
        });
      }
    }

    const restaurantIds = new Set(user.restaurantIds);
    restaurantIds.add(data.restaurantId);

    await updateDoc(
      doc(getDb(), "users", user.uid),
      stripUndefined({
        restaurantIds: [...restaurantIds],
        role: data.roleId,
        displayName: data.name || user.displayName,
        updatedAt: new Date().toISOString(),
      }),
    );

    try {
      await linkEmployeeByEmail({
        restaurantId: data.restaurantId,
        email,
        uid: user.uid,
        employeeId: data.employeeId,
      });
    } catch {
      /* best-effort */
    }

    try {
      await updateDoc(indexRef, {
        status: "linked",
        updatedAt: new Date().toISOString(),
      });
    } catch {
      /* non-fatal */
    }

    return true;
  } catch (e) {
    console.warn("[activateFromEmployeeEmailIndex] activación falló:", e);
    return false;
  }
}

/** Accept pending invites for the signed-in user (by email). */
export async function acceptPendingInvites(user: AppUser): Promise<number> {
  if (!isFirebaseConfigured()) return 0;
  const email = user.email.trim().toLowerCase();
  const q = query(
    collection(getDb(), "memberInvites"),
    where("email", "==", email),
    where("status", "==", "pending"),
  );
  let snap;
  try {
    snap = await getDocs(q);
  } catch (e) {
    // Permisos / reglas no publicadas: un solo aviso, sin spamear
    if (typeof console !== "undefined") {
      console.warn(
        "[acceptPendingInvites] no se pudieron leer invitaciones (¿firestore.rules publicadas?):",
        e instanceof Error ? e.message : e,
      );
    }
    const fromIndex = await activateFromEmployeeEmailIndex(user);
    return fromIndex ? 1 : 0;
  }
  let accepted = 0;
  const restaurantIds = new Set(user.restaurantIds);
  let primaryRole: RoleId | null = null;

  for (const d of snap.docs) {
    const inv = d.data() as MemberInvite;
    const existing = await getMember(inv.restaurantId, user.uid);
    if (!existing) {
      const member = createMemberDocument(
        inv.restaurantId,
        { ...user, role: inv.roleId },
        inv.branchIds,
      );
      await setDoc(
        doc(getDb(), "restaurants", inv.restaurantId, "members", user.uid),
        stripUndefined({ ...member }),
      );
    } else {
      const currentRole = existing.roleId ?? existing.role;
      // Race: membership stamped as cliente — force invite role
      if (currentRole !== inv.roleId) {
        await updateMember({
          restaurantId: inv.restaurantId,
          uid: user.uid,
          patch: {
            roleId: inv.roleId,
            branchIds: inv.branchIds,
            active: true,
          },
        });
      }
    }
    restaurantIds.add(inv.restaurantId);
    if (!primaryRole) primaryRole = inv.roleId;
    await updateDoc(doc(getDb(), "memberInvites", inv.id), {
      status: "accepted",
      acceptedAt: new Date().toISOString(),
      acceptedUid: user.uid,
      updatedAt: new Date().toISOString(),
    });
    try {
      await linkEmployeeByEmail({
        restaurantId: inv.restaurantId,
        email,
        uid: user.uid,
      });
    } catch {
      /* best-effort */
    }
    accepted += 1;
  }

  if (accepted > 0) {
    await updateDoc(
      doc(getDb(), "users", user.uid),
      stripUndefined({
        restaurantIds: [...restaurantIds],
        ...(primaryRole ? { role: primaryRole } : {}),
        updatedAt: new Date().toISOString(),
      }),
    );
  } else {
    // Fallback: ficha en Empleados sin memberInvites
    const fromIndex = await activateFromEmployeeEmailIndex(user);
    if (fromIndex) return 1;
  }

  return accepted;
}

export async function revokeInvite(inviteId: string): Promise<void> {
  await updateDoc(doc(getDb(), "memberInvites", inviteId), {
    status: "revoked",
    updatedAt: new Date().toISOString(),
  });
}
