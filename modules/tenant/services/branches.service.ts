"use client";

import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";
import { createBranchDocument } from "@/models/schemas";
import type { Branch } from "@/types/restaurant";
import {
  collection,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";

export function subscribeBranches(
  restaurantId: string,
  onData: (rows: Branch[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "branches"),
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Branch)
          .filter((b) => !b.deletedAt)
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    },
    (err) => onError?.(err),
  );
}

export async function listBranches(restaurantId: string): Promise<Branch[]> {
  if (!isFirebaseConfigured()) return [];
  const snap = await getDocs(
    collection(getDb(), "restaurants", restaurantId, "branches"),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Branch)
    .filter((b) => !b.deletedAt);
}

export async function createBranch(input: {
  restaurantId: string;
  name: string;
  code?: string;
  address?: string;
  phone?: string;
  isDefault?: boolean;
}): Promise<Branch> {
  const branch = createBranchDocument(input.restaurantId, input.name.trim(), {
    code: input.code?.trim() || undefined,
    isDefault: input.isDefault ?? false,
  });
  if (input.address) branch.address = input.address;
  if (input.phone) branch.phone = input.phone;

  await setDoc(
    doc(getDb(), "restaurants", input.restaurantId, "branches", branch.id),
    stripUndefined({ ...branch, deletedAt: null }),
  );

  if (branch.isDefault) {
    await updateDoc(doc(getDb(), "restaurants", input.restaurantId), {
      "settings.defaultBranchId": branch.id,
      updatedAt: new Date().toISOString(),
    });
  }

  return branch;
}

export async function updateBranch(input: {
  restaurantId: string;
  branchId: string;
  patch: Partial<
    Pick<Branch, "name" | "code" | "address" | "phone" | "status" | "isDefault">
  >;
}): Promise<void> {
  const stamp = new Date().toISOString();
  await updateDoc(
    doc(getDb(), "restaurants", input.restaurantId, "branches", input.branchId),
    stripUndefined({ ...input.patch, updatedAt: stamp }),
  );
  if (input.patch.isDefault) {
    await updateDoc(doc(getDb(), "restaurants", input.restaurantId), {
      "settings.defaultBranchId": input.branchId,
      updatedAt: stamp,
    });
  }
}

export async function archiveBranch(input: {
  restaurantId: string;
  branchId: string;
  clearDefault?: boolean;
}): Promise<void> {
  await updateDoc(
    doc(getDb(), "restaurants", input.restaurantId, "branches", input.branchId),
    {
      status: "inactive",
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDefault: false,
    },
  );
  if (input.clearDefault) {
    await updateDoc(doc(getDb(), "restaurants", input.restaurantId), {
      "settings.defaultBranchId": deleteField(),
      updatedAt: new Date().toISOString(),
    });
  }
}
