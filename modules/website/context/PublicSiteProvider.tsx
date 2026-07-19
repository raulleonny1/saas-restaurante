"use client";

import {
  loadPublicSiteBundle,
  resolveSlug,
  submitPublicOrder,
  submitPublicReservation,
  submitPublicReview,
} from "@/modules/website/services/public.service";
import type { Product, ProductCategory } from "@/types/catalog";
import type { Branch, Restaurant } from "@/types/restaurant";
import type { Promotion } from "@/types/promotions";
import type {
  BlogPost,
  Review,
  SiteEvent,
  WebsiteSettings,
} from "@/types/website";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface CartLine {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

interface PublicSiteContextValue {
  ready: boolean;
  error: string | null;
  slug: string;
  restaurant: Restaurant | null;
  settings: WebsiteSettings | null;
  branches: Branch[];
  categories: ProductCategory[];
  products: Product[];
  promotions: Promotion[];
  posts: BlogPost[];
  events: SiteEvent[];
  reviews: Review[];
  cart: CartLine[];
  addToCart: (p: Product) => void;
  setQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  cartTotal: number;
  sectionEnabled: (id: keyof WebsiteSettings["sections"]) => boolean;
  placeOrder: (input: {
    customerName: string;
    customerPhone?: string;
    notes?: string;
  }) => Promise<void>;
  bookTable: (input: {
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    partySize: number;
    startsAt: string;
    notes?: string;
    tableId?: string | null;
    tableName?: string | null;
    durationMinutes?: number;
  }) => Promise<void>;
  leaveReview: (input: {
    authorName: string;
    rating: number;
    comment: string;
  }) => Promise<void>;
}

const PublicSiteContext = createContext<PublicSiteContextValue | null>(null);

export function usePublicSite() {
  const ctx = useContext(PublicSiteContext);
  if (!ctx) throw new Error("usePublicSite requires provider");
  return ctx;
}

export function PublicSiteProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [settings, setSettings] = useState<WebsiteSettings | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [events, setEvents] = useState<SiteEvent[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setReady(false);
        const index = await resolveSlug(slug);
        if (!index) {
          throw new Error(
            "No existe este local. En Admin → Sitio web guarda un slug y abre /r/tu-slug",
          );
        }
        const bundle = await loadPublicSiteBundle(index.restaurantId);
        if (cancelled) return;
        // El home del cliente es público (sin registro). Aunque esté en
        // “borrador”, se muestra para que el dueño pueda verlo al momento.
        setRestaurant(bundle.restaurant);
        setSettings(bundle.settings);
        setBranches(bundle.branches);
        setCategories(bundle.categories);
        setProducts(bundle.products);
        setPromotions(bundle.promotions);
        setPosts(bundle.posts);
        setEvents(bundle.events);
        setReviews(bundle.reviews);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error cargando sitio");
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!restaurant || !settings) return;
    document.title = settings.seo?.title || restaurant.name;
    const desc = settings.seo?.description;
    if (desc) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "description");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", desc);
    }
  }, [restaurant, settings]);

  const addToCart = useCallback((p: Product) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          unitPrice: p.price,
          quantity: 1,
        },
      ];
    });
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setCart((prev) =>
      prev
        .map((l) =>
          l.productId === productId ? { ...l, quantity: qty } : l,
        )
        .filter((l) => l.quantity > 0),
    );
  }, []);

  const cartTotal = useMemo(
    () => cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
    [cart],
  );

  const defaultBranchId =
    settings?.reservationSettings && branches[0]
      ? branches.find((b) => b.isDefault)?.id ?? branches[0]?.id
      : branches[0]?.id;

  const value: PublicSiteContextValue = {
    ready,
    error,
    slug,
    restaurant,
    settings,
    branches,
    categories,
    products,
    promotions,
    posts,
    events,
    reviews,
    cart,
    addToCart,
    setQty,
    clearCart: () => setCart([]),
    cartTotal,
    sectionEnabled: (id) => settings?.sections?.[id] !== false,
    placeOrder: async (input) => {
      if (!restaurant || !defaultBranchId) throw new Error("Sin sucursal");
      if (!cart.length) throw new Error("Carrito vacío");
      await submitPublicOrder({
        restaurantId: restaurant.id,
        branchId: defaultBranchId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        notes: input.notes,
        items: cart,
        currency: restaurant.currency,
      });
      setCart([]);
    },
    bookTable: async (input) => {
      if (!restaurant || !defaultBranchId) throw new Error("Sin sucursal");
      await submitPublicReservation({
        restaurantId: restaurant.id,
        branchId: defaultBranchId,
        ...input,
      });
    },
    leaveReview: async (input) => {
      if (!restaurant) throw new Error("Sin restaurante");
      await submitPublicReview({
        restaurantId: restaurant.id,
        ...input,
      });
    },
  };

  return (
    <PublicSiteContext.Provider value={value}>
      {children}
    </PublicSiteContext.Provider>
  );
}
