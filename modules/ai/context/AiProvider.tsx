"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { isFirebaseConfigured } from "@/lib/firebase";
import type { BusinessSnapshot } from "@/modules/ai/domain/snapshot";
import { askManager } from "@/modules/ai/services/ask.service";
import {
  dismissInsight,
  refreshManagerInsights,
  subscribeInsights,
} from "@/modules/ai/services/insights.service";
import {
  appendMessage,
  createSession,
  subscribeMessages,
  subscribeSessions,
} from "@/modules/ai/services/sessions.service";
import { loadBusinessSnapshot } from "@/modules/ai/services/snapshot.service";
import type { AiInsight, AiMessage, AiSession } from "@/types/ai";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface AiContextValue {
  ready: boolean;
  error: string | null;
  busy: boolean;
  sessions: AiSession[];
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  messages: AiMessage[];
  insights: AiInsight[];
  snapshotAt: string | null;
  ask: (question: string) => Promise<void>;
  newChat: () => Promise<void>;
  refreshInsights: () => Promise<number>;
  dismiss: (insightId: string) => Promise<void>;
  reloadSnapshot: () => Promise<void>;
}

const AiContext = createContext<AiContextValue | null>(null);

export function useAi() {
  const ctx = useContext(AiContext);
  if (!ctx) throw new Error("useAi requires provider");
  return ctx;
}

export function AiProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { restaurant, restaurantId } = useRestaurant();
  const [sessions, setSessions] = useState<AiSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [snapshot, setSnapshot] = useState<BusinessSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const reloadSnapshot = useCallback(async () => {
    if (!restaurantId || !restaurant) return;
    const snap = await loadBusinessSnapshot({
      restaurantId,
      restaurantName: restaurant.name,
      currency: restaurant.currency ?? "EUR",
    });
    setSnapshot(snap);
  }, [restaurantId, restaurant]);

  useEffect(() => {
    if (!restaurantId || !user?.uid || !isFirebaseConfigured()) {
      setReady(true);
      setError(
        !isFirebaseConfigured()
          ? "Firebase no está configurado"
          : "Selecciona un restaurante e inicia sesión",
      );
      return;
    }
    setError(null);
    void reloadSnapshot()
      .then(() => setReady(true))
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Error cargando datos");
        setReady(true);
      });

    const u1 = subscribeSessions(
      restaurantId,
      user.uid,
      setSessions,
      (e) => setError(e.message),
    );
    const u2 = subscribeInsights(
      restaurantId,
      setInsights,
      (e) => setError(e.message),
    );
    return () => {
      u1();
      u2();
    };
  }, [restaurantId, user?.uid, reloadSnapshot]);

  useEffect(() => {
    if (!restaurantId || !sessionId) {
      setMessages([]);
      return;
    }
    return subscribeMessages(
      restaurantId,
      sessionId,
      setMessages,
      (e) => setError(e.message),
    );
  }, [restaurantId, sessionId]);

  const ensureSession = async (): Promise<AiSession> => {
    if (!restaurantId || !user?.uid) throw new Error("Sin sesión");
    if (sessionId) {
      const existing = sessions.find((s) => s.id === sessionId);
      if (existing) return existing;
    }
    const created = await createSession({
      restaurantId,
      createdBy: user.uid,
    });
    setSessionId(created.id);
    return created;
  };

  const value: AiContextValue = {
    ready,
    error,
    busy,
    sessions,
    sessionId,
    setSessionId,
    messages,
    insights,
    snapshotAt: snapshot?.generatedAt ?? null,
    reloadSnapshot,
    newChat: async () => {
      if (!restaurantId || !user?.uid) return;
      const s = await createSession({
        restaurantId,
        createdBy: user.uid,
        title: "Nueva consulta",
      });
      setSessionId(s.id);
    },
    ask: async (question: string) => {
      if (!restaurantId || !user?.uid) throw new Error("Sin sesión");
      setBusy(true);
      try {
        let snap = snapshot;
        if (!snap) {
          await reloadSnapshot();
          snap = await loadBusinessSnapshot({
            restaurantId,
            restaurantName: restaurant?.name ?? "Restaurante",
            currency: restaurant?.currency ?? "EUR",
          });
          setSnapshot(snap);
        }
        const session = await ensureSession();
        await appendMessage({
          restaurantId,
          session,
          role: "user",
          content: question,
        });
        // refresh session messageCount locally for next append
        const refreshed: AiSession = {
          ...session,
          messageCount: (session.messageCount ?? 0) + 1,
        };
        const answer = await askManager(snap, question);
        await appendMessage({
          restaurantId,
          session: refreshed,
          role: "assistant",
          content: answer.content,
          model: answer.model,
          contextRefs: answer.finding.refs?.map((r) => ({
            type: r.type,
            id: r.id,
          })),
        });
      } finally {
        setBusy(false);
      }
    },
    refreshInsights: async () => {
      if (!restaurantId || !restaurant) return 0;
      setBusy(true);
      try {
        const snap = await loadBusinessSnapshot({
          restaurantId,
          restaurantName: restaurant.name,
          currency: restaurant.currency ?? "EUR",
        });
        setSnapshot(snap);
        return refreshManagerInsights(snap);
      } finally {
        setBusy(false);
      }
    },
    dismiss: async (insightId) => {
      if (!restaurantId) return;
      await dismissInsight(restaurantId, insightId);
    },
  };

  return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
}
