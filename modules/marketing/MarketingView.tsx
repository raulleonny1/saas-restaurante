"use client";

import { useAuth } from "@/context/AuthProvider";
import { AutomationsPanel } from "@/modules/marketing/components/AutomationsPanel";
import { CampaignsPanel } from "@/modules/marketing/components/CampaignsPanel";
import { CouponsPanel } from "@/modules/marketing/components/CouponsPanel";
import { PromotionsPanel } from "@/modules/marketing/components/PromotionsPanel";
import { SegmentsPanel } from "@/modules/marketing/components/SegmentsPanel";
import {
  MarketingProvider,
  useMarketing,
} from "@/modules/marketing/context/MarketingProvider";
import {
  Alert,
  Badge,
  PageHeader,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/ui";
import { useState } from "react";

function MarketingWorkspace() {
  const { can } = useAuth();
  const { ready, error, campaigns, coupons, promotions, automations } =
    useMarketing();
  const [tab, setTab] = useState("campaigns");

  if (!ready) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }

  if (
    !can("marketing.read") &&
    !can("marketing.campaigns.manage") &&
    !can("marketing.coupons.manage")
  ) {
    return (
      <Alert tone="warning" title="Sin acceso a Marketing">
        Tu rol no tiene permiso `marketing.read`.
      </Alert>
    );
  }

  return (
    <div className="space-y-4 pb-16 lg:pb-0">
      <PageHeader
        title="Marketing"
        description="Email, SMS, WhatsApp, push, cupones, promociones, programación, segmentación y automatizaciones."
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge tone="accent">{campaigns.length} campañas</Badge>
            <Badge tone="neutral">{coupons.length} cupones</Badge>
            <Badge tone="neutral">{promotions.length} promos</Badge>
            <Badge tone="neutral">{automations.length} autos</Badge>
          </div>
        }
      />

      {error ? (
        <Alert tone="danger" title="Error Firestore">
          {error}
        </Alert>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex w-full flex-wrap justify-start gap-1 overflow-x-auto">
          <TabsTrigger value="campaigns">Campañas</TabsTrigger>
          <TabsTrigger value="coupons">Cupones</TabsTrigger>
          <TabsTrigger value="promotions">Promociones</TabsTrigger>
          <TabsTrigger value="automations">Automatizaciones</TabsTrigger>
          <TabsTrigger value="segments">Segmentación</TabsTrigger>
        </TabsList>
        <TabsContent value="campaigns">
          <CampaignsPanel />
        </TabsContent>
        <TabsContent value="coupons">
          <CouponsPanel />
        </TabsContent>
        <TabsContent value="promotions">
          <PromotionsPanel />
        </TabsContent>
        <TabsContent value="automations">
          <AutomationsPanel />
        </TabsContent>
        <TabsContent value="segments">
          <SegmentsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function MarketingView() {
  return (
    <MarketingProvider>
      <MarketingWorkspace />
    </MarketingProvider>
  );
}
