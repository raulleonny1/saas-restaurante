"use client";

import { useAuth } from "@/context/AuthProvider";
import { ChatPanel } from "@/modules/ai/components/ChatPanel";
import { InsightsPanel } from "@/modules/ai/components/InsightsPanel";
import { AiProvider, useAi } from "@/modules/ai/context/AiProvider";
import {
  Alert,
  Badge,
  Button,
  PageHeader,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from "@/ui";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

function AiWorkspace() {
  const { can } = useAuth();
  const { ready, error, reloadSnapshot, busy, insights } = useAi();
  const [tab, setTab] = useState(() =>
    can("ai.assistant") ? "chat" : "insights",
  );

  if (!ready) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }

  if (!can("ai.assistant") && !can("ai.insights")) {
    return (
      <Alert tone="warning" title="Sin acceso a IA">
        Tu rol no tiene permiso `ai.assistant` o `ai.insights`.
      </Alert>
    );
  }

  return (
    <div className="space-y-4 pb-16 lg:pb-0">
      <PageHeader
        title="Gerente IA"
        description="Asistente que analiza tu base operativa y responde en lenguaje natural: compras, ventas, promos, equipo y clientes."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{insights.length} insights</Badge>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  try {
                    await reloadSnapshot();
                    toast("Datos actualizados", "success");
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "Error", "error");
                  }
                })();
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Actualizar datos
            </Button>
          </div>
        }
      />

      {error ? (
        <Alert tone="danger" title="Error">
          {error}
        </Alert>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start">
          {can("ai.assistant") ? (
            <TabsTrigger value="chat">Chat gerente</TabsTrigger>
          ) : null}
          {can("ai.insights") ? (
            <TabsTrigger value="insights">Insights</TabsTrigger>
          ) : null}
        </TabsList>
        {can("ai.assistant") ? (
          <TabsContent value="chat">
            <ChatPanel />
          </TabsContent>
        ) : null}
        {can("ai.insights") ? (
          <TabsContent value="insights">
            <InsightsPanel />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

export function AiView() {
  return (
    <AiProvider>
      <AiWorkspace />
    </AiProvider>
  );
}
