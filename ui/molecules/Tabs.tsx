"use client";

import { cn } from "@/lib/cn";
import { ButtonHTMLAttributes, HTMLAttributes, createContext, useContext } from "react";

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs compound components require <Tabs>");
  return ctx;
}

export interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  onValueChange: (value: string) => void;
}

/**
 * Molecule — controlled tabs. Compose with TabsList, TabsTrigger, TabsContent.
 */
export function Tabs({ value, onValueChange, className, children, ...props }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn("w-full", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex h-10 items-center gap-1 rounded-[var(--radius-md)] border border-border bg-bg-muted/60 p-1",
        className,
      )}
      {...props}
    />
  );
}

export interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function TabsTrigger({ value, className, ...props }: TabsTriggerProps) {
  const { value: active, onValueChange } = useTabs();
  const selected = active === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => onValueChange(value)}
      className={cn(
        "inline-flex h-8 items-center justify-center rounded-[var(--radius-sm)] px-3 text-sm font-medium transition-colors duration-[var(--duration-fast)]",
        "focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_var(--ring)]",
        selected
          ? "bg-bg-elevated text-fg shadow-[var(--shadow-sm)]"
          : "text-fg-muted hover:text-fg",
        className,
      )}
      {...props}
    />
  );
}

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function TabsContent({ value, className, ...props }: TabsContentProps) {
  const { value: active } = useTabs();
  if (active !== value) return null;
  return (
    <div
      role="tabpanel"
      className={cn("mt-4 outline-none animate-fade-up", className)}
      {...props}
    />
  );
}
