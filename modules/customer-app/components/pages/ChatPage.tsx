"use client";

import { useCustomerApp } from "@/modules/customer-app/context/CustomerAppProvider";
import { FormEvent, useEffect, useRef, useState } from "react";

export function CustomerChatPage() {
  const { chatMessages, sendChat, restaurant } = useCustomerApp();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      await sendChat(body);
      setBody("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] flex-col">
      <div className="mb-4">
        <h1 className="font-[family-name:var(--font-display)] text-2xl">Chat</h1>
        <p className="text-sm text-[#a8b5a4]">
          Mensajes con {restaurant?.name ?? "el restaurante"}.
        </p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3">
        {chatMessages.map((m) => {
          const mine = m.senderRole === "customer";
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  mine
                    ? "bg-emerald-800 text-white"
                    : "bg-white/10 text-[#e7efe4]"
                }`}
              >
                <p>{m.body}</p>
                <p className="mt-1 text-[10px] opacity-60">
                  {new Date(m.createdAt).toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
        {!chatMessages.length ? (
          <p className="py-10 text-center text-sm text-[#8fa08c]">
            Escribe para empezar la conversación.
          </p>
        ) : null}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => void onSubmit(e)}
        className="mt-3 flex gap-2"
      >
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Tu mensaje…"
          className="flex-1 rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !body.trim()}
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
