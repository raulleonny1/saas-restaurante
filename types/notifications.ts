import type { ISODateString, Timestamps } from "./common";

export type AppNotificationType =
  | "order"
  | "reservation"
  | "loyalty"
  | "promo"
  | "chat"
  | "marketing"
  | "system";

export interface AppNotification extends Timestamps {
  id: string;
  restaurantId: string;
  /** Auth uid of the recipient (customer or staff). */
  uid: string;
  type: AppNotificationType;
  title: string;
  body: string;
  href?: string;
  read: boolean;
  referenceType?: "order" | "reservation" | "chat" | "promotion";
  referenceId?: string;
  readAt?: ISODateString;
}
