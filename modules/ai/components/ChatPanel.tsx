"use client";

import { SuggestedQuestions } from "@/modules/ai/components/SuggestedQuestions";
import { useAi } from "@/modules/ai/context/AiProvider";
import { Badge, Button, EmptyState, Textarea, toast } from "@/ui";
import { Loader2, Plus, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function ChatPanel() {
  const {
    messages,
    sessions,
    sessionId,
    setSessionId,
    ask,
    newChat,
    busy,
    snapshotAt,
  } = useAi();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, busy]);

  const submit = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setText("");
    try {
      await ask(question);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error al consultar", "error");
    }
  };

  return (
    <div className="flex min-h-[60vh] flex-col gap-3 lg:min-h-[70vh]">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void newChat()}>
          <Plus className="h-3.5 w-3.5" /> Nueva charla
        </Button>
        {sessions.slice(0, 5).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSessionId(s.id)}
            className={`max-w-[140px] truncate rounded-[var(--radius-md)] px-2.5 py-1 text-xs transition ${
              sessionId === s.id
                ? "bg-accent text-accent-fg"
                : "bg-bg-muted text-fg-muted hover:text-fg"
            }`}
          >
            {s.title || "Consulta"}
          </button>
        ))}
        {snapshotAt ? (
          <Badge tone="neutral">
            Snapshot {new Date(snapshotAt).toLocaleTimeString("es")}
          </Badge>
        ) : null}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-[var(--radius-lg)] border border-border bg-bg-elevated/60 p-3 sm:p-4">
        {!messages.length && !busy ? (
          <div className="space-y-4 py-6">
            <EmptyState
              title="Gerente inteligente"
              description="Pregunta en lenguaje natural. Analizo pedidos, inventario, clientes, promociones y equipo de tu restaurante."
            />
            <SuggestedQuestions disabled={busy} onPick={(q) => void submit(q)} />
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[92%] whitespace-pre-wrap rounded-[var(--radius-lg)] px-3 py-2 text-sm sm:max-w-[80%] ${
                  m.role === "user"
                    ? "bg-accent text-accent-fg"
                    : "border border-border bg-bg text-fg"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
        {busy ? (
          <div className="flex items-center gap-2 text-sm text-fg-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analizando la base de datos…
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {messages.length ? (
        <SuggestedQuestions disabled={busy} onPick={(q) => void submit(q)} />
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Textarea
          label="Tu pregunta"
          rows={2}
          value={text}
          disabled={busy}
          placeholder="Ej. ¿Qué debo comprar mañana?"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit(text);
            }
          }}
        />
        <Button
          disabled={busy || !text.trim()}
          onClick={() => void submit(text)}
          className="sm:mb-0.5"
        >
          <Send className="h-4 w-4" /> Preguntar
        </Button>
      </div>
    </div>
  );
}
