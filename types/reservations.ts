import type { ISODateString, SoftDelete, Timestamps } from "./common";

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "seated"
  | "completed"
  | "cancelled"
  | "no_show";

export type ReservationSource = "phone" | "web" | "walk_in" | "app" | "waitlist";

export interface Reservation extends Timestamps, SoftDelete {
  id: string;
  restaurantId: string;
  branchId: string;
  customerId?: string | null;
  /** Auth uid when booking from the customer app. */
  customerUid?: string | null;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  partySize: number;
  tableId?: string | null;
  tableName?: string | null;
  startsAt: ISODateString;
  endsAt: ISODateString;
  status: ReservationStatus;
  notes?: string;
  source?: ReservationSource;
  reminderSent: boolean;
  reminderSentAt?: ISODateString;
  /** Minutes before start when reminder should fire (default 120). */
  reminderMinutesBefore?: number;
  confirmationSent: boolean;
  confirmationSentAt?: ISODateString;
  assignedAutomatically?: boolean;
  googleEventId?: string | null;
  googleCalendarSyncedAt?: ISODateString;
  createdBy?: string;
}

export type WaitlistStatus =
  | "waiting"
  | "offered"
  | "booked"
  | "cancelled"
  | "expired";

export interface WaitlistEntry extends Timestamps, SoftDelete {
  id: string;
  restaurantId: string;
  branchId: string;
  customerId?: string | null;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  partySize: number;
  /** Preferred window start (optional). */
  preferredStartsAt?: ISODateString;
  preferredEndsAt?: ISODateString;
  status: WaitlistStatus;
  notes?: string;
  offeredTableId?: string | null;
  offeredReservationId?: string | null;
  createdBy?: string;
}

export interface GoogleCalendarConnection {
  connected: boolean;
  calendarId?: string;
  /** Display only — tokens stay in session/local, not Firestore by default. */
  accountEmail?: string;
  lastSyncedAt?: ISODateString;
}

export interface ReservationsSettings extends Timestamps {
  id: string;
  restaurantId: string;
  branchId: string;
  defaultDurationMinutes: number;
  reminderMinutesBefore: number;
  autoAssignEnabled: boolean;
  googleCalendar: GoogleCalendarConnection;
}
