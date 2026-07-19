"use client";

import { useAuth } from "@/context/AuthProvider";
import { ReservationActionsList } from "@/modules/reservations/components/ReservationActions";
import { ReservationCalendar } from "@/modules/reservations/components/ReservationCalendar";
import { ReservationForm } from "@/modules/reservations/components/ReservationForm";
import { WaitlistPanel } from "@/modules/reservations/components/WaitlistPanel";
import {
  ReservationsProvider,
  useReservations,
} from "@/modules/reservations/context/ReservationsProvider";
import {
  connectGoogleCalendarPopup,
  getGoogleClientId,
  getStoredGoogleAccessToken,
} from "@/modules/reservations/services/google-calendar.service";
import {
  Alert,
  Badge,
  Button,
  PageHeader,
  Select,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from "@/ui";
import { useState } from "react";

function ReservationsWorkspace() {
  const { can } = useAuth();
  const {
    ready,
    error,
    branches,
    branchId,
    setBranchId,
    waitlist,
    dueReminders,
    dayReservations,
  } = useReservations();
  const [tab, setTab] = useState("book");
  const [gcalConnected, setGcalConnected] = useState(
    () => Boolean(getStoredGoogleAccessToken()),
  );

  if (!ready) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }

  if (!can("reservations.read") && !can("reservations.manage")) {
    return (
      <Alert tone="warning" title="Sin acceso a reservas">
        Tu rol no tiene permiso `reservations.read`.
      </Alert>
    );
  }

  return (
    <div className="space-y-4 pb-16 lg:pb-0">
      <PageHeader
        title="Reservas"
        description="Calendario, plano, confirmaciones, recordatorios, lista de espera, auto-asignación e integración Google Calendar."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {dueReminders.length ? (
              <Badge tone="warning">{dueReminders.length} recordatorios</Badge>
            ) : null}
            <Badge tone="accent">{dayReservations.length} hoy</Badge>
            {branchId && branches.length > 0 ? (
              <Select
                aria-label="Sucursal"
                className="min-w-[160px]"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void (async () => {
                  try {
                    if (!getGoogleClientId()) {
                      toast(
                        "Sin CLIENT_ID: usa el botón Google en cada reserva (enlace) o ICS",
                        "info",
                      );
                      return;
                    }
                    await connectGoogleCalendarPopup();
                    setGcalConnected(true);
                    toast("Google Calendar conectado", "success");
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "Error", "error");
                  }
                })();
              }}
            >
              {gcalConnected ? "GCal conectado" : "Conectar Google"}
            </Button>
          </div>
        }
      />

      {error ? (
        <Alert tone="danger" title="Error Firestore">
          {error}
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <ReservationCalendar />
        <div className="min-w-0">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start">
              <TabsTrigger value="book">Nueva / Plano</TabsTrigger>
              <TabsTrigger value="day">
                Del día ({dayReservations.length})
              </TabsTrigger>
              <TabsTrigger value="waitlist">
                Espera ({waitlist.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="book">
              <ReservationForm />
            </TabsContent>
            <TabsContent value="day">
              <ReservationActionsList />
            </TabsContent>
            <TabsContent value="waitlist">
              <WaitlistPanel />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export function ReservationsView() {
  return (
    <ReservationsProvider>
      <ReservationsWorkspace />
    </ReservationsProvider>
  );
}
