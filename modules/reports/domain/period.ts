export type ReportPeriodPreset =
  | "today"
  | "7d"
  | "30d"
  | "90d"
  | "custom";

export interface DateRange {
  from: Date;
  to: Date;
  label: string;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function resolvePeriod(
  preset: ReportPeriodPreset,
  customFrom?: string,
  customTo?: string,
  now = new Date(),
): DateRange {
  const to = endOfDay(now);
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to, label: "Hoy" };
    case "7d": {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 6);
      return { from, to, label: "Últimos 7 días" };
    }
    case "30d": {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 29);
      return { from, to, label: "Últimos 30 días" };
    }
    case "90d": {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 89);
      return { from, to, label: "Últimos 90 días" };
    }
    case "custom": {
      const from = customFrom
        ? startOfDay(new Date(customFrom))
        : startOfDay(now);
      const end = customTo ? endOfDay(new Date(customTo)) : to;
      return { from, to: end, label: "Personalizado" };
    }
    default:
      return { from: startOfDay(now), to, label: "Hoy" };
  }
}

/** Previous window of equal length ending just before `from`. */
export function previousRange(range: DateRange): DateRange {
  const ms = range.to.getTime() - range.from.getTime();
  const to = new Date(range.from.getTime() - 1);
  const from = new Date(to.getTime() - ms);
  return { from, to, label: "Periodo anterior" };
}

export function inRange(iso: string | undefined, range: DateRange): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= range.from.getTime() && t <= range.to.getTime();
}

export function dayKey(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", {
    day: "numeric",
    month: "short",
  });
}
