"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { ROLE_LABELS } from "@/lib/roles";
import { Badge, Button, Select } from "@/ui";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";

export function Topbar() {
  const { user, role, signOut } = useAuth();
  const { restaurants, restaurantId, setRestaurantId } = useRestaurant();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-bg-elevated/70 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex items-center gap-3 md:hidden">
        <Link href="/dashboard" className="font-display text-lg">
          SmartServe
        </Link>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {restaurants.length > 0 ? (
          <Select
            aria-label="Restaurante activo"
            className="min-w-[160px]"
            value={restaurantId ?? ""}
            onChange={(e) => setRestaurantId(e.target.value)}
          >
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        ) : null}

        <Button
          variant="ghost"
          size="sm"
          aria-label="Cambiar tema"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>

        <div className="hidden text-right text-sm sm:block">
          <p className="font-medium">{user?.displayName}</p>
          <p className="text-xs text-fg-muted">{user?.email}</p>
        </div>

        {role ? <Badge tone="accent">{ROLE_LABELS[role]}</Badge> : null}

        <Button variant="secondary" size="sm" onClick={() => void signOut()}>
          Salir
        </Button>
      </div>
    </header>
  );
}
