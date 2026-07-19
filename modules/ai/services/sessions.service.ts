"use client";

import { getDb } from "@/lib/firebase";
import { newId, nowIso } from "@/modules/ai/domain/ids";
import type { AiMessage, AiSession } from "@/types/ai";
import {
  collection,
  doc,
  onSnapshot,
  Unsubscribe,
  writeBatch,
} from "firebase/firestore";

export function subscribeSessions(
  restaurantId: string,
  uid: string,
  onData: (rows: AiSession[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "aiSessions"),
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as AiSession)
          .filter((s) => !s.deletedAt && s.createdBy === uid)
          .sort((a, b) =>
            (b.lastMessageAt ?? b.createdAt).localeCompare(
              a.lastMessageAt ?? a.createdAt,
            ),
          ),
      );
    },
    (err) => onError?.(err),
  );
}

export function subscribeMessages(
  restaurantId: string,
  sessionId: string,
  onData: (rows: AiMessage[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(
      getDb(),
      "restaurants",
      restaurantId,
      "aiSessions",
      sessionId,
      "messages",
    ),
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as AiMessage)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      );
    },
    (err) => onError?.(err),
  );
}

export async function createSession(input: {
  restaurantId: string;
  createdBy: string;
  title?: string;
}): Promise<AiSession> {
  const stamp = nowIso();
  const id = newId("ais");
  const row: AiSession = {
    id,
    restaurantId: input.restaurantId,
    branchId: null,
    createdBy: input.createdBy,
    title: input.title ?? "Nueva consulta",
    model: "smartserve-manager",
    messageCount: 0,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  };
  const batch = writeBatch(getDb());
  batch.set(
    doc(getDb(), "restaurants", input.restaurantId, "aiSessions", id),
    row,
  );
  await batch.commit();
  return row;
}

export async function appendMessage(input: {
  restaurantId: string;
  session: AiSession;
  role: "user" | "assistant";
  content: string;
  model?: string;
  contextRefs?: AiMessage["contextRefs"];
}): Promise<AiMessage> {
  const stamp = nowIso();
  const id = newId("aim");
  const msg: AiMessage = {
    id,
    restaurantId: input.restaurantId,
    sessionId: input.session.id,
    role: input.role,
    content: input.content,
    contextRefs: input.contextRefs,
    createdAt: stamp,
    updatedAt: stamp,
  };

  const batch = writeBatch(getDb());
  batch.set(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "aiSessions",
      input.session.id,
      "messages",
      id,
    ),
    msg,
  );
  batch.update(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "aiSessions",
      input.session.id,
    ),
    {
      messageCount: (input.session.messageCount ?? 0) + 1,
      lastMessageAt: stamp,
      updatedAt: stamp,
      model: input.model ?? input.session.model,
      title:
        input.session.messageCount === 0 && input.role === "user"
          ? input.content.slice(0, 48)
          : input.session.title,
    },
  );
  await batch.commit();
  return msg;
}
