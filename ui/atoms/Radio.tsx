"use client";

import { cn } from "@/lib/cn";
import { InputHTMLAttributes, forwardRef } from "react";
import { Label } from "./Label";

export interface RadioProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: string;
  description?: string;
}

/**
 * Atom — radio button with optional label.
 */
export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ className, label, description, id, ...props }, ref) => {
    const input = (
      <input
        ref={ref}
        id={id}
        type="radio"
        className={cn(
          "h-4 w-4 border-border text-accent accent-accent",
          "focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_var(--ring)]",
          "disabled:cursor-not-allowed disabled:opacity-45",
          className,
        )}
        {...props}
      />
    );

    if (!label) return input;

    return (
      <div className="flex items-start gap-2.5">
        <div className="pt-0.5">{input}</div>
        <div className="space-y-0.5">
          <Label htmlFor={id} className="cursor-pointer text-fg">
            {label}
          </Label>
          {description ? <p className="text-caption">{description}</p> : null}
        </div>
      </div>
    );
  },
);
Radio.displayName = "Radio";
