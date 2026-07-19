import type { ISODateString, Timestamps } from "./common";

export interface CustomerChatThread extends Timestamps {
  id: string;
  restaurantId: string;
  customerId: string;
  customerUid: string;
  customerName: string;
  lastMessage?: string;
  lastMessageAt?: ISODateString;
  unreadCustomer: number;
  unreadStaff: number;
}

export interface CustomerChatMessage extends Timestamps {
  id: string;
  restaurantId: string;
  threadId: string;
  senderUid: string;
  senderRole: "customer" | "staff";
  body: string;
}
