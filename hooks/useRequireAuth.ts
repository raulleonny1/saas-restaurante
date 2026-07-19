"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Redirects unauthenticated users to login. */
export function useRequireAuth() {
  const { user, loading, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && status === "unauthenticated") {
      router.replace("/login");
    }
  }, [loading, status, router]);

  return { user, loading };
}
