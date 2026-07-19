export type PosMutationType =
  | "openTable"
  | "updateOrder"
  | "moveTable"
  | "mergeTables"
  | "payOrder"
  | "refundPayment"
  | "sendKitchen"
  | "printMark";

export interface PosQueuedMutation {
  id: string;
  type: PosMutationType;
  restaurantId: string;
  branchId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

const STORAGE_KEY = "smartserve_pos_offline_queue_v1";

function read(): PosQueuedMutation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PosQueuedMutation[]) : [];
  } catch {
    return [];
  }
}

function write(items: PosQueuedMutation[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function listQueuedMutations(): PosQueuedMutation[] {
  return read();
}

export function enqueueMutation(
  input: Omit<PosQueuedMutation, "id" | "createdAt" | "attempts">,
): PosQueuedMutation {
  const item: PosQueuedMutation = {
    ...input,
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  const next = [...read(), item];
  write(next);
  return item;
}

export function removeQueuedMutation(id: string) {
  write(read().filter((m) => m.id !== id));
}

export function bumpQueuedMutation(id: string, error: string) {
  write(
    read().map((m) =>
      m.id === id
        ? { ...m, attempts: m.attempts + 1, lastError: error }
        : m,
    ),
  );
}

export function clearQueuedMutations() {
  write([]);
}
