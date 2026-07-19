import type {
  Customer,
  CustomerSegmentId,
  CustomerTier,
} from "@/types/customers";

const DAY = 86_400_000;

export function daysSince(iso?: string, now = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / DAY);
}

export function isBirthdaySoon(birthday?: string, now = new Date()): boolean {
  if (!birthday) return false;
  // Accept YYYY-MM-DD or MM-DD
  const parts = birthday.split("-").map(Number);
  let month: number;
  let day: number;
  if (parts.length === 3) {
    month = parts[1];
    day = parts[2];
  } else if (parts.length === 2) {
    month = parts[0];
    day = parts[1];
  } else return false;
  const todayM = now.getMonth() + 1;
  const todayD = now.getDate();
  // same month, within next 7 days (simple)
  if (month === todayM && day >= todayD && day <= todayD + 7) return true;
  return month === todayM && day === todayD;
}

export function computeValueScore(customer: Customer, now = Date.now()): number {
  const recency = daysSince(customer.lastVisitAt, now);
  const recencyScore =
    recency == null ? 20 : recency <= 7 ? 100 : recency <= 30 ? 70 : recency <= 60 ? 40 : 15;
  const frequencyScore = Math.min(100, customer.visitCount * 12);
  const monetaryScore = Math.min(100, customer.totalSpent / 5);
  return Math.round(recencyScore * 0.35 + frequencyScore * 0.3 + monetaryScore * 0.35);
}

export function deriveTier(points: number, valueScore: number): CustomerTier {
  if (points >= 2000 || valueScore >= 85) return "platinum";
  if (points >= 800 || valueScore >= 70) return "gold";
  if (points >= 250 || valueScore >= 50) return "silver";
  return "standard";
}

export function computeSegments(
  customer: Customer,
  now = Date.now(),
): CustomerSegmentId[] {
  const segments: CustomerSegmentId[] = [];
  const recency = daysSince(customer.lastVisitAt, now);
  const value = customer.valueScore ?? computeValueScore(customer, now);

  if (customer.visitCount <= 2) segments.push("new");
  if (customer.visitCount >= 8 && (recency == null || recency <= 45)) {
    segments.push("loyal");
  }
  if (value >= 75 || customer.totalSpent >= 400) segments.push("high_value");
  if (value >= 80 || customer.tier === "gold" || customer.tier === "platinum") {
    segments.push("vip");
  }
  if (recency != null && recency >= 30 && recency < 60 && customer.visitCount >= 2) {
    segments.push("at_risk");
  }
  if (recency != null && recency >= 60) segments.push("dormant");
  if (isBirthdaySoon(customer.birthday, new Date(now))) segments.push("birthday");
  if (customer.allergies && customer.allergies.length > 0) {
    segments.push("allergy_watch");
  }

  return [...new Set(segments)];
}

export const SEGMENT_LABELS: Record<CustomerSegmentId, string> = {
  vip: "VIP",
  loyal: "Fiel",
  new: "Nuevo",
  at_risk: "En riesgo",
  dormant: "Inactivo",
  birthday: "Cumpleaños",
  high_value: "Alto valor",
  allergy_watch: "Alergias",
};
