"use client";

import { cn } from "@/lib/cn";
import { ButtonHTMLAttributes } from "react";

export interface SwitchProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
}

/**
 * Atom — toggle switch. Fully keyboard accessible.
 */
export function Switch({
  checked,
  onCheckedChange,
  label,
  className,
  disabled,
  id,
  ...props
}: SwitchProps) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full transition-colors duration-[var(--duration-fast)]",
          "focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_var(--ring)]",
          "disabled:cursor-not-allowed disabled:opacity-45",
          checked ? "bg-accent" : "bg-bg-muted border border-border",
        )}
        {...props}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-bg-elevated shadow-[var(--shadow-sm)] transition-transform duration-[var(--duration-fast)]",
            checked && "translate-x-4",
          )}
        />
      </button>
      {label ? (
        <label htmlFor={id} className="cursor-pointer text-sm text-fg">
          {label}
        </label>
      ) : null}
    </div>
  );
}
