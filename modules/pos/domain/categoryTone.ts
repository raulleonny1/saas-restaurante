/**
 * Paleta estable por categoría para el TPV táctil.
 * Hash del id/nombre → color fijo (sin guardar en Firestore).
 */

import type { CSSProperties } from "react";

export type CategoryTone = {
  /** Fondo del tile / chip */
  bg: string;
  /** Texto sobre el fondo */
  fg: string;
  /** Borde / acento */
  border: string;
  /** Chip inactivo (más suave) */
  soft: string;
};

const PALETTE: CategoryTone[] = [
  { bg: "#1d6b4f", fg: "#ecfdf5", border: "#34d399", soft: "#143d30" },
  { bg: "#1e4d8c", fg: "#eff6ff", border: "#60a5fa", soft: "#152a4a" },
  { bg: "#9a3412", fg: "#fff7ed", border: "#fb923c", soft: "#4a1d0f" },
  { bg: "#6b21a8", fg: "#faf5ff", border: "#c084fc", soft: "#3b1460" },
  { bg: "#0e7490", fg: "#ecfeff", border: "#22d3ee", soft: "#0c3d4a" },
  { bg: "#b45309", fg: "#fffbeb", border: "#fbbf24", soft: "#5c2e0a" },
  { bg: "#be123c", fg: "#fff1f2", border: "#fb7185", soft: "#5c0a1f" },
  { bg: "#365314", fg: "#f7fee7", border: "#a3e635", soft: "#1f2e0c" },
  { bg: "#1e3a5f", fg: "#e0f2fe", border: "#38bdf8", soft: "#122338" },
  { bg: "#7c2d12", fg: "#fef3c7", border: "#f59e0b", soft: "#3f1709" },
  { bg: "#115e59", fg: "#ccfbf1", border: "#2dd4bf", soft: "#0a332f" },
  { bg: "#4c1d95", fg: "#ede9fe", border: "#a78bfa", soft: "#2a1055" },
];

const ALL_TONE: CategoryTone = {
  bg: "#374151",
  fg: "#f3f4f6",
  border: "#9ca3af",
  soft: "#1f2937",
};

function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Color TPV para una categoría (id preferido; fallback nombre). */
export function categoryTone(
  categoryId: string | null | undefined,
  categoryName?: string | null,
): CategoryTone {
  const key = (categoryId || categoryName || "").trim();
  if (!key || key === "all") return ALL_TONE;
  return PALETTE[hashKey(key) % PALETTE.length]!;
}

/** Estilos inline listos para botones/tiles. */
export function categoryToneStyle(
  categoryId: string | null | undefined,
  opts?: { active?: boolean; categoryName?: string | null },
): CSSProperties {
  const tone = categoryTone(categoryId, opts?.categoryName);
  if (opts?.active === false) {
    return {
      backgroundColor: tone.soft,
      color: tone.fg,
      borderColor: `${tone.border}55`,
    };
  }
  return {
    backgroundColor: tone.bg,
    color: tone.fg,
    borderColor: tone.border,
  };
}
