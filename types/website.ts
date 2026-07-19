import type { ISODateString, SoftDelete, Timestamps } from "./common";

export type WebsiteSectionId =
  | "menu"
  | "orders"
  | "reservations"
  | "reviews"
  | "location"
  | "promotions"
  | "blog"
  | "events";

export type ContentStatus = "draft" | "published" | "archived";
export type ReviewStatus = "pending" | "approved" | "rejected";
export type DomainStatus =
  | "none"
  | "pending_dns"
  | "verifying"
  | "active"
  | "error";

export interface WebsiteSeo {
  title: string;
  description: string;
  keywords?: string[];
  ogImageUrl?: string;
  noIndex?: boolean;
  canonicalPath?: string;
}

export interface WebsiteSettings extends Timestamps {
  id: "default";
  restaurantId: string;
  published: boolean;
  tagline?: string;
  about?: string;
  heroImageUrl?: string;
  accentColor?: string;
  /** Sections enabled on the public site. */
  sections: Record<WebsiteSectionId, boolean>;
  seo: WebsiteSeo;
  social?: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    googleMapsUrl?: string;
  };
  orderSettings?: {
    enabled: boolean;
    minOrderAmount?: number;
    deliveryEnabled?: boolean;
    takeawayEnabled?: boolean;
    note?: string;
  };
  reservationSettings?: {
    enabled: boolean;
    defaultPartySize?: number;
    /** Duración estimada de la reserva (minutos). */
    defaultDurationMinutes?: number;
    note?: string;
  };
  customDomain?: string | null;
  domainStatus?: DomainStatus;
  domainVerificationToken?: string;
}

export interface BlogPost extends Timestamps, SoftDelete {
  id: string;
  restaurantId: string;
  slug: string;
  title: string;
  excerpt?: string;
  body: string;
  coverImageUrl?: string;
  status: ContentStatus;
  publishedAt?: ISODateString;
  authorName?: string;
  seo?: Partial<WebsiteSeo>;
}

export interface SiteEvent extends Timestamps, SoftDelete {
  id: string;
  restaurantId: string;
  slug: string;
  title: string;
  description: string;
  startsAt: ISODateString;
  endsAt?: ISODateString;
  locationLabel?: string;
  coverImageUrl?: string;
  status: ContentStatus;
  capacity?: number;
  ticketUrl?: string;
}

export interface Review extends Timestamps {
  id: string;
  restaurantId: string;
  authorName: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  source: "web" | "manual";
}

/** Root index: slug → restaurant */
export interface RestaurantSlugIndex {
  slug: string;
  restaurantId: string;
  restaurantName: string;
  published: boolean;
  updatedAt: ISODateString;
}

/** Root index: hostname → restaurant */
export interface CustomDomainIndex {
  host: string;
  restaurantId: string;
  slug: string;
  status: DomainStatus;
  verificationToken: string;
  updatedAt: ISODateString;
}

export const DEFAULT_WEBSITE_SECTIONS: Record<WebsiteSectionId, boolean> = {
  menu: true,
  orders: true,
  reservations: true,
  reviews: true,
  location: true,
  promotions: true,
  blog: true,
  events: true,
};
