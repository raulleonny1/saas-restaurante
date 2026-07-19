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
  const id = createId("inv");
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
  await setDoc(
    doc(getDb(), "memberInvites", id),
    stripUndefined({ ...row }),
  );
  return row;
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

/** Accept pending invites for the signed-in user (by email). */
export async function acceptPendingInvites(user: AppUser): Promise<number> {
  if (!isFirebaseConfigured()) return 0;
  const email = user.email.trim().toLowerCase();
  const q = query(
    collection(getDb(), "memberInvites"),
    where("email", "==", email),
    where("status", "==", "pending"),
  );
  const snap = await getDocs(q);
  let accepted = 0;
  const restaurantIds = new Set(user.restaurantIds);

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
    }
    restaurantIds.add(inv.restaurantId);
    await updateDoc(doc(getDb(), "memberInvites", inv.id), {
      status: "accepted",
      acceptedAt: new Date().toISOString(),
      acceptedUid: user.uid,
      updatedAt: new Date().toISOString(),
    });
    accepted += 1;
  }

  if (accepted > 0) {
    await updateDoc(doc(getDb(), "users", user.uid), {
      restaurantIds: [...restaurantIds],
      updatedAt: new Date().toISOString(),
    });
  }

  return accepted;
}

export async function revokeInvite(inviteId: string): Promise<void> {
  await updateDoc(doc(getDb(), "memberInvites", inviteId), {
    status: "revoked",
    updatedAt: new Date().toISOString(),
  });
}
