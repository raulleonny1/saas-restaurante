"use client";

import { getDb } from "@/lib/firebase";
import { defaultWebsiteSettings } from "@/modules/website/domain/defaults";
import { newId, nowIso } from "@/modules/website/domain/ids";
import {
  isValidSlug,
  normalizeHost,
  slugify,
} from "@/modules/website/domain/slug";
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
  onSnapshot,
  setDoc,
  Unsubscribe,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

export function subscribeWebsiteSettings(
  restaurantId: string,
  onData: (row: WebsiteSettings | null) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(getDb(), "restaurants", restaurantId, "websiteSettings", "default"),
    (snap) => {
      onData(snap.exists() ? ({ id: "default", ...snap.data() } as WebsiteSettings) : null);
    },
    (err) => onError?.(err),
  );
}

export async function ensureWebsiteSettings(input: {
  restaurantId: string;
  restaurantName: string;
  slug?: string;
}): Promise<WebsiteSettings> {
  const ref = doc(
    getDb(),
    "restaurants",
    input.restaurantId,
    "websiteSettings",
    "default",
  );
  const existing = await getDoc(ref);
  let settings: WebsiteSettings;
  if (existing.exists()) {
    settings = { id: "default", ...existing.data() } as WebsiteSettings;
  } else {
    settings = defaultWebsiteSettings(
      input.restaurantId,
      input.restaurantName,
    );
    await setDoc(ref, settings);
  }

  let slug = input.slug;
  if (!slug) {
    const base = slugify(input.restaurantName) || "restaurante";
    slug = `${base}-${input.restaurantId.slice(-6).toLowerCase()}`;
    await claimSlug({
      restaurantId: input.restaurantId,
      restaurantName: input.restaurantName,
      slug,
      previousSlug: null,
      published: settings.published,
    });
  } else {
    await syncSlugIndex({
      restaurantId: input.restaurantId,
      restaurantName: input.restaurantName,
      slug,
      published: settings.published,
    });
  }

  return settings;
}

export async function saveWebsiteSettings(
  restaurantId: string,
  patch: Partial<WebsiteSettings>,
): Promise<void> {
  const stamp = nowIso();
  await setDoc(
    doc(getDb(), "restaurants", restaurantId, "websiteSettings", "default"),
    { ...patch, restaurantId, id: "default", updatedAt: stamp },
    { merge: true },
  );
  await updateDoc(doc(getDb(), "restaurants", restaurantId), {
    websitePublished: patch.published,
    updatedAt: stamp,
  });
}

export async function claimSlug(input: {
  restaurantId: string;
  restaurantName: string;
  slug: string;
  previousSlug?: string | null;
  published: boolean;
}): Promise<string> {
  const slug = slugify(input.slug);
  if (!isValidSlug(slug)) throw new Error("Slug inválido");

  const target = await getDoc(doc(getDb(), "restaurantSlugs", slug));
  if (target.exists() && target.data()?.restaurantId !== input.restaurantId) {
    throw new Error("Ese slug ya está en uso");
  }

  const batch = writeBatch(getDb());
  if (input.previousSlug && input.previousSlug !== slug) {
    batch.delete(doc(getDb(), "restaurantSlugs", input.previousSlug));
  }

  const index: RestaurantSlugIndex = {
    slug,
    restaurantId: input.restaurantId,
    restaurantName: input.restaurantName,
    published: input.published,
    updatedAt: nowIso(),
  };
  batch.set(doc(getDb(), "restaurantSlugs", slug), index);
  batch.update(doc(getDb(), "restaurants", input.restaurantId), {
    slug,
    websitePublished: input.published,
    updatedAt: nowIso(),
  });
  await batch.commit();
  return slug;
}

export async function syncSlugIndex(input: {
  restaurantId: string;
  restaurantName: string;
  slug: string;
  published: boolean;
}): Promise<void> {
  await setDoc(doc(getDb(), "restaurantSlugs", input.slug), {
    slug: input.slug,
    restaurantId: input.restaurantId,
    restaurantName: input.restaurantName,
    published: input.published,
    updatedAt: nowIso(),
  } satisfies RestaurantSlugIndex);
}

export async function setCustomDomain(input: {
  restaurantId: string;
  slug: string;
  host: string | null;
  previousHost?: string | null;
}): Promise<{ host: string | null; token: string | null }> {
  const batch = writeBatch(getDb());
  if (input.previousHost) {
    batch.delete(
      doc(getDb(), "customDomains", normalizeHost(input.previousHost)),
    );
  }

  if (!input.host?.trim()) {
    batch.set(
      doc(
        getDb(),
        "restaurants",
        input.restaurantId,
        "websiteSettings",
        "default",
      ),
      {
        customDomain: null,
        domainStatus: "none",
        domainVerificationToken: null,
        updatedAt: nowIso(),
      },
      { merge: true },
    );
    await batch.commit();
    return { host: null, token: null };
  }

  const host = normalizeHost(input.host);
  const taken = await getDoc(doc(getDb(), "customDomains", host));
  if (taken.exists() && taken.data()?.restaurantId !== input.restaurantId) {
    throw new Error("Ese dominio ya está vinculado a otro restaurante");
  }

  const token = `ss-verify-${newId("dom").slice(-10)}`;
  const row: CustomDomainIndex = {
    host,
    restaurantId: input.restaurantId,
    slug: input.slug,
    status: "pending_dns",
    verificationToken: token,
    updatedAt: nowIso(),
  };
  batch.set(doc(getDb(), "customDomains", host), row);
  batch.set(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "websiteSettings",
      "default",
    ),
    {
      customDomain: host,
      domainStatus: "pending_dns",
      domainVerificationToken: token,
      updatedAt: nowIso(),
    },
    { merge: true },
  );
  await batch.commit();
  return { host, token };
}

export async function markDomainActive(input: {
  restaurantId: string;
  host: string;
}): Promise<void> {
  const host = normalizeHost(input.host);
  const stamp = nowIso();
  await updateDoc(doc(getDb(), "customDomains", host), {
    status: "active",
    updatedAt: stamp,
  });
  await setDoc(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "websiteSettings",
      "default",
    ),
    { domainStatus: "active", updatedAt: stamp },
    { merge: true },
  );
}

export function subscribeBlogPosts(
  restaurantId: string,
  onData: (rows: BlogPost[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "blogPosts"),
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as BlogPost)
          .filter((p) => !p.deletedAt)
          .sort((a, b) =>
            (b.publishedAt ?? b.createdAt).localeCompare(
              a.publishedAt ?? a.createdAt,
            ),
          ),
      );
    },
    (err) => onError?.(err),
  );
}

export function subscribeSiteEvents(
  restaurantId: string,
  onData: (rows: SiteEvent[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "siteEvents"),
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as SiteEvent)
          .filter((e) => !e.deletedAt)
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      );
    },
    (err) => onError?.(err),
  );
}

export function subscribeReviews(
  restaurantId: string,
  onData: (rows: Review[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "reviews"),
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Review)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    },
    (err) => onError?.(err),
  );
}

export async function upsertBlogPost(input: {
  restaurantId: string;
  post?: BlogPost | null;
  title: string;
  slug?: string;
  excerpt?: string;
  body: string;
  status: BlogPost["status"];
  coverImageUrl?: string;
}): Promise<BlogPost> {
  const stamp = nowIso();
  const id = input.post?.id ?? newId("post");
  const slug = slugify(input.slug || input.title);
  const row: BlogPost = {
    id,
    restaurantId: input.restaurantId,
    slug,
    title: input.title.trim(),
    excerpt: input.excerpt,
    body: input.body,
    coverImageUrl: input.coverImageUrl,
    status: input.status,
    publishedAt:
      input.status === "published"
        ? input.post?.publishedAt ?? stamp
        : input.post?.publishedAt,
    authorName: input.post?.authorName,
    createdAt: input.post?.createdAt ?? stamp,
    updatedAt: stamp,
    deletedAt: null,
  };
  await setDoc(
    doc(getDb(), "restaurants", input.restaurantId, "blogPosts", id),
    row,
  );
  return row;
}

export async function upsertSiteEvent(input: {
  restaurantId: string;
  event?: SiteEvent | null;
  title: string;
  slug?: string;
  description: string;
  startsAt: string;
  endsAt?: string;
  status: SiteEvent["status"];
  locationLabel?: string;
}): Promise<SiteEvent> {
  const stamp = nowIso();
  const id = input.event?.id ?? newId("evt");
  const slug = slugify(input.slug || input.title);
  const row: SiteEvent = {
    id,
    restaurantId: input.restaurantId,
    slug,
    title: input.title.trim(),
    description: input.description,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    locationLabel: input.locationLabel,
    status: input.status,
    createdAt: input.event?.createdAt ?? stamp,
    updatedAt: stamp,
    deletedAt: null,
  };
  await setDoc(
    doc(getDb(), "restaurants", input.restaurantId, "siteEvents", id),
    row,
  );
  return row;
}

export async function moderateReview(input: {
  restaurantId: string;
  reviewId: string;
  status: Review["status"];
}): Promise<void> {
  await updateDoc(
    doc(getDb(), "restaurants", input.restaurantId, "reviews", input.reviewId),
    { status: input.status, updatedAt: nowIso() },
  );
}
