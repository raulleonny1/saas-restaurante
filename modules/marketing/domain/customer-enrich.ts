import {
  computeSegments,
  computeValueScore,
  deriveTier,
} from "@/modules/customers/domain/segments";
import type { Customer } from "@/types/customers";

export { computeSegments };

export function enrichCustomerLike(customer: Customer): Customer {
  const valueScore = customer.valueScore ?? computeValueScore(customer);
  const tier = customer.tier ?? deriveTier(customer.points ?? 0, valueScore);
  const segments = customer.segments ?? computeSegments({ ...customer, valueScore, tier });
  return { ...customer, valueScore, tier, segments };
}
