"use client";

import { getDb } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";
import { newId, nowIso } from "@/modules/customer-app/domain/ids";
import type {
  CustomerChatMessage,
  CustomerChatThread,
} from "@/types/customer-chat";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
} from "firebase/firestore";

export async function ensureChatThread(input: {
  restaurantId: string;
  customerId: string;
  customerUid: string;
  customerName: string;
}): Promise<CustomerChatThread> {
  const q = query(
    collection(getDb(), "restaurants", input.restaurantId, "customerChats"),
    where("customerUid", "==", input.customerUid),
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as CustomerChatThread;
  }
  const stamp = nowIso();
  const id = newId("chat");
  const row: CustomerChatThread = {
    id,
    restaurantId: input.restaurantId,
    customerId: input.customerId,
    customerUid: input.customerUid,
    customerName: input.customerName,
    unreadCustomer: 0,
    unreadStaff: 0,
    createdAt: stamp,
    updatedAt: stamp,
  };
  await setDoc(
    doc(getDb(), "restaurants", input.restaurantId, "customerChats", id),
    stripUndefined({ ...row }),
  );
  return row;
}

export function subscribeChatMessages(
  restaurantId: string,
  threadId: string,
  onData: (rows: CustomerChatMessage[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(
      getDb(),
      "restaurants",
      restaurantId,
      "customerChats",
      threadId,
      "messages",
    ),
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CustomerChatMessage)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      );
    },
    (err) => onError?.(err),
  );
}

export async function sendCustomerMessage(input: {
  restaurantId: string;
  thread: CustomerChatThread;
  senderUid: string;
  body: string;
}): Promise<void> {
  const stamp = nowIso();
  const id = newId("msg");
  const msg: CustomerChatMessage = {
    id,
    restaurantId: input.restaurantId,
    threadId: input.thread.id,
    senderUid: input.senderUid,
    senderRole: "customer",
    body: input.body.trim(),
    createdAt: stamp,
    updatedAt: stamp,
  };
  await setDoc(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "customerChats",
      input.thread.id,
      "messages",
      id,
    ),
    stripUndefined({ ...msg }),
  );
  await updateDoc(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "customerChats",
      input.thread.id,
    ),
    {
      lastMessage: msg.body,
      lastMessageAt: stamp,
      unreadStaff: (input.thread.unreadStaff ?? 0) + 1,
      updatedAt: stamp,
    },
  );
}
