"use client";

import { create } from "zustand";

interface UiStore {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

/** Lightweight UI state — keep domain state in context/services. */
export const useUiStore = create<UiStore>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
