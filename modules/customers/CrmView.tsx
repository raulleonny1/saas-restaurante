"use client";

import { useAuth } from "@/context/AuthProvider";
import { CustomerDetail } from "@/modules/customers/components/CustomerDetail";
import { CustomerFormModal } from "@/modules/customers/components/CustomerFormModal";
import { CustomerList } from "@/modules/customers/components/CustomerList";
import { CrmProvider, useCrm } from "@/modules/customers/context/CrmProvider";
import {
  Alert,
  Badge,
  Button,
  PageHeader,
  Skeleton,
  toast,
} from "@/ui";
import { Plus, Users } from "lucide-react";
import { useState } from "react";

function CrmWorkspace() {
  const { can } = useAuth();
  const { ready, error, customers, selected, bootstrap } = useCrm();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [booting, setBooting] = useState(false);

  if (!ready) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }

  if (!can("customers.read") && !can("customers.manage")) {
    return (
      <Alert tone="warning" title="Sin acceso a CRM">
        Tu rol no tiene permiso `customers.read`.
      </Alert>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 pb-16 lg:pb-0">
      <PageHeader
        title="Clientes"
        description="CRM: historial, pedidos, puntos, cumpleaños, preferencias, alergias, frecuencia, valor, segmentación y promos personalizadas."
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge tone="accent">{customers.length} clientes</Badge>
            {!customers.length ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={booting}
                onClick={() => {
                  void (async () => {
                    try {
                      setBooting(true);
                      const res = await bootstrap();
                      toast(`CRM listo: ${res.created} clientes demo`, "success");
                    } catch (e) {
                      toast(e instanceof Error ? e.message : "Error", "error");
                    } finally {
                      setBooting(false);
                    }
                  })();
                }}
              >
                <Users className="h-4 w-4" /> Inicializar CRM
              </Button>
            ) : null}
            {selected ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setEditing(true);
                  setFormOpen(true);
                }}
              >
                Editar
              </Button>
            ) : null}
            <Button
              size="sm"
              onClick={() => {
                setEditing(false);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Nuevo
            </Button>
          </div>
        }
      />

      {error ? (
        <Alert tone="danger" title="Error Firestore">
          {error}
        </Alert>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
        <section className="min-h-[320px] rounded-[var(--radius-xl)] border border-border bg-bg-elevated/60 p-3 sm:p-4 lg:min-h-0">
          <CustomerList />
        </section>
        <section className="min-h-[420px] lg:min-h-0">
          <CustomerDetail />
        </section>
      </div>

      <CustomerFormModal
        open={formOpen}
        customer={editing ? selected : null}
        onClose={() => {
          setFormOpen(false);
          setEditing(false);
        }}
      />
    </div>
  );
}

export function CrmView() {
  return (
    <CrmProvider>
      <CrmWorkspace />
    </CrmProvider>
  );
}
