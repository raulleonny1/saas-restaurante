"use client";

import { cn } from "@/lib/cn";
import { Search, X } from "lucide-react";
import { InputHTMLAttributes, forwardRef } from "react";

export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  onClear?: () => void;
}

/**
 * Molecule — search field with leading icon and optional clear action.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, onClear, value, ...props }, ref) => {
    const showClear = onClear && String(value ?? "").length > 0;

    return (
      <div className={cn("relative w-full", className)}>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-fg-muted"
          strokeWidth={1.75}
        />
        <input
          ref={ref}
          type="search"
          value={value}
          className={cn(
            "h-10 w-full rounded-[var(--radius-md)] border border-border bg-bg-elevated py-2 pr-9 pl-9 text-sm text-fg shadow-[var(--shadow-sm)]",
            "outline-none transition-[border,box-shadow] duration-[var(--duration-fast)]",
            "placeholder:text-fg-muted/70",
            "focus:border-accent focus:shadow-[0_0_0_4px_var(--ring)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          {...props}
        />
        {showClear ? (
          <button
            type="button"
            onClick={onClear}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-[var(--radius-sm)] p-1 text-fg-muted hover:bg-bg-muted hover:text-fg"
            aria-label="Limpiar búsqueda"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        ) : null}
      </div>
    );
  },
);
SearchInput.displayName = "SearchInput";
