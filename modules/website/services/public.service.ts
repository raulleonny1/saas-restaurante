"use client";

import { getDb } from "@/lib/firebase";
import { newId, nowIso } from "@/modules/website/domain/ids";
import { normalizeHost } from "@/modules/website/domain/slug";
import type { Product, ProductCategory } from "@/types/catalog";
import type { Branch, Restaurant } from "@/types/restaurant";
import type { Order } from "@/types/orders";
import type { Reservation } from "@/types/reservations";
import type { Promotion } from "@/types/promotions";
import type {
  BlogPost,
  CustomDomainIndex,
  RestaurantSlugIndex,
  Review,
  SiteEvent,
  WebsiteSettings,
} from "@/types/website";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";

export async function resolveSlug(
  slug: string,
): Promise<RestaurantSlugIndex | null> {
  const snap = await getDoc(doc(getDb(), "restaurantSlugs", slug));
  if (!snap.exists()) return null;
  return snap.data() as RestaurantSlugIndex;
}

export async function resolveCustomDomain(
  host: string,
): Promise<CustomDomainIndex | null> {
  const snap = await getDoc(
    doc(getDb(), "customDomains", normalizeHost(host)),
  );
  if (!snap.exists()) return null;
  return snap.data() as CustomDomainIndex;
}

export async function loadPublicRestaurant(
  restaurantId: string,
): Promise<Restaurant | null> {
  const snap = await getDoc(doc(getDb(), "restaurants", restaurantId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Restaurant;
}

export async function loadPublicSiteBundle(restaurantId: string): Promise<{
  restaurant: Restaurant;
  settings: WebsiteSettings | null;
  branches: Branch[];
  categories: ProductCategory[];
  products: Product[];
  promotions: Promotion[];
  posts: BlogPost[];
  events: SiteEvent[];
  reviews: Review[];
}> {
  const [
    restaurant,
    settingsSnap,
    branchesSnap,
    categoriesSnap,
    productsSnap,
    promotionsSnap,
    postsSnap,
    eventsSnap,
    reviewsSnap,
  ] = await Promise.all([
    loadPublicRestaurant(restaurantId),
    getDoc(
      doc(getDb(), "restaurants", restaurantId, "websiteSettings", "default"),
    ),
    getDocs(collection(getDb(), "restaurants", restaurantId, "branches")),
    getDocs(collection(getDb(), "restaurants", restaurantId, "categories")),
    getDocs(collection(getDb(), "restaurants", restaurantId, "products")),
    getDocs(collection(getDb(), "restaurants", restaurantId, "promotions")),
    getDocs(collection(getDb(), "restaurants", restaurantId, "blogPosts")),
    getDocs(collection(getDb(), "restaurants", restaurantId, "siteEvents")),
    getDocs(collection(getDb(), "restaurants", restaurantId, "reviews")),
  ]);

  if (!restaurant) throw new Error("Restaurante no encontrado");

  return {
    restaurant,
    settings: settingsSnap.exists()
      ? ({ id: "default", ...settingsSnap.data() } as WebsiteSettings)
      : null,
    branches: branchesSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Branch)
      .filter((b) => !b.deletedAt && b.status === "active"),
    categories: categoriesSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as ProductCategory)
      .filter((c) => !c.deletedAt && c.status === "active")
      .sort((a, b) => a.sortOrder - b.sortOrder),
    products: productsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Product)
      .filter((p) => !p.deletedAt && p.status === "active")
      .map((p) => {
        // Never expose cost/recipe on public surface
        const { cost: _c, recipe: _r, ...safe } = p;
        return { ...safe, recipe: [] } as Product;
      }),
    promotions: promotionsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Promotion)
      .filter(
        (p) =>
          !p.deletedAt &&
          (p.status === "active" || p.status === "scheduled"),
      ),
    posts: postsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as BlogPost)
      .filter((p) => !p.deletedAt && p.status === "published"),
    events: eventsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as SiteEvent)
      .filter((e) => !e.deletedAt && e.status === "published"),
    reviews: reviewsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Review)
      .filter((r) => r.status === "approved"),
  };
}

export async function submitPublicReview(input: {
  restaurantId: string;
  authorName: string;
  rating: number;
  comment: string;
}): Promise<Review> {
  const stamp = nowIso();
  const id = newId("rev");
  const row: Review = {
    id,
    restaurantId: input.restaurantId,
    authorName: input.authorName.trim(),
    rating: Math.min(5, Math.max(1, Math.round(input.rating))),
    comment: input.comment.trim(),
    status: "pending",
    source: "web",
    createdAt: stamp,
    updatedAt: stamp,
  };
  await setDoc(
    doc(getDb(), "restaurants", input.restaurantId, "reviews", id),
    row,
  );
  return row;
}

export async function submitPublicReservation(input: {
  restaurantId: string;
  branchId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  partySize: number;
  startsAt: string;
  notes?: string;
  tableId?: string | null;
  tableName?: string | null;
  durationMinutes?: number;
}): Promise<Reservation> {
  const stamp = nowIso();
  const id = newId("res");
  const startsAt = new Date(input.startsAt).toISOString();
  const ends = new Date(startsAt);
  ends.setMinutes(ends.getMinutes() + (input.durationMinutes ?? 90));
  const row: Reservation = {
    id,
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    partySize: input.partySize,
    tableId: input.tableId ?? null,
    tableName: input.tableName ?? null,
    startsAt,
    endsAt: ends.toISOString(),
    status: "pending",
    source: "web",
    confirmationSent: false,
    reminderSent: false,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
    notes: input.notes,
  };
  await setDoc(
    doc(getDb(), "restaurants", input.restaurantId, "reservations", id),
    row,
  );
  await setDoc(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "publicBookingSlots",
      id,
    ),
    {
      id: row.id,
      restaurantId: row.restaurantId,
      branchId: row.branchId,
      tableId: row.tableId ?? null,
      partySize: row.partySize,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      status: row.status,
      updatedAt: stamp,
    },
  );
  return row;
}

export async function submitPublicOrder(input: {
  restaurantId: string;
  branchId: string;
  customerName: string;
  customerPhone?: string;
  notes?: string;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  currency: string;
}): Promise<Order> {
  const stamp = nowIso();
  const id = newId("ord");
  const subtotal = input.items.reduce(
    (s, i) => s + i.unitPrice * i.quantity,
    0,
  );
  const row: Order = {
    id,
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    channel: "online",
    items: input.items.map((i, idx) => ({
      id: `li_${idx}`,
      productId: i.productId,
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      status: "open",
    })),
    status: "open",
    discountPercent: 0,
    discountAmount: 0,
    tipPercent: 0,
    tipAmount: 0,
    taxAmount: 0,
    subtotal,
    total: subtotal,
    amountPaid: 0,
    currency: input.currency as Order["currency"],
    guestCount: 1,
    openedAt: stamp,
    createdBy: "web_guest",
    notes: [
      input.customerName,
      input.customerPhone,
      input.notes,
    ]
      .filter(Boolean)
      .join(" · "),
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  };
  await setDoc(
    doc(getDb(), "restaurants", input.restaurantId, "orders", id),
    row,
  );
  return row;
}
