"use client";

import {
  bumpQueuedMutation,
  listQueuedMutations,
  removeQueuedMutation,
  type PosQueuedMutation,
} from "@/modules/pos/offline/queue";
import { enableNetwork, disableNetwork } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

export type SyncStatus = "online" | "offline" | "syncing";

type FlushHandler = (mutation: PosQueuedMutation) => Promise<void>;

let flushHandler: FlushHandler | null = null;

export function registerOfflineFlushHandler(handler: FlushHandler) {
  flushHandler = handler;
}

export async function setFirestoreConnectivity(online: boolean) {
  const db = getDb();
  if (online) await enableNetwork(db);
  else await disableNetwork(db);
}

export async function flushOfflineQueue(): Promise<{
  flushed: number;
  failed: number;
}> {
  if (!flushHandler) return { flushed: 0, failed: 0 };
  const items = listQueuedMutations();
  let flushed = 0;
  let failed = 0;
  for (const item of items) {
    try {
      await flushHandler(item);
      removeQueuedMutation(item.id);
      flushed += 1;
    } catch (err) {
      failed += 1;
      bumpQueuedMutation(
        item.id,
        err instanceof Error ? err.message : "sync_error",
      );
    }
  }
  return { flushed, failed };
}
