"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { Skeleton } from "@/ui";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { restaurant, loading: restLoading } = useRestaurant();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || loading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [ready, loading, user, router]);

  useEffect(() => {
    if (!ready || loading || restLoading || !user) return;
    if (!restaurant) {
      router.replace("/onboarding");
    }
  }, [ready, loading, user, restLoading, restaurant, router]);

  if (!ready || loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        <MobileNav />
      </div>
    </div>
  );
}
