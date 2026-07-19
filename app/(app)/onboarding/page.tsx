"use client";

import { useRestaurant } from "@/context/RestaurantProvider";
import { Button, Input, toast } from "@/ui";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function OnboardingPage() {
  const { create } = useRestaurant();
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await create(name.trim() || "Mi restaurante");
      toast("Restaurante listo", "success");
      router.replace("/dashboard");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg py-10">
      <h1 className="font-display text-4xl tracking-tight">Tu primer restaurante</h1>
      <p className="mt-3 text-fg-muted">
        Todo quedará aislado por <code>restaurantId</code>. Podrás añadir más locales después.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Input
          label="Nombre del restaurante"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Café Norte"
          required
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Creando…" : "Continuar"}
        </Button>
      </form>
    </div>
  );
}
