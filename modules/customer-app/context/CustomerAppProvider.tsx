"use client";

import { useAuth } from "@/context/AuthProvider";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  ensureChatThread,
  sendCustomerMessage,
  subscribeChatMessages,
} from "@/modules/customer-app/services/chat.service";
import {
  subscribeLoyaltyAccount,
  subscribeLoyaltyTx,
} from "@/modules/customer-app/services/loyalty.service";
import {
  markNotificationRead,
  subscribeMyNotifications,
} from "@/modules/customer-app/services/notifications.service";
import {
  placeCustomerOrder,
  subscribeMyOrders,
} from "@/modules/customer-app/services/orders.service";
import {
  ensureCustomerProfile,
  updateCustomerFavorites,
} from "@/modules/customer-app/services/profile.service";
import {
  bookCustomerReservation,
  subscribeMyReservations,
} from "@/modules/customer-app/services/reservations.service";
import { resolveSlug } from "@/modules/website/services/public.service";
import type { Product, ProductCategory } from "@/types/catalog";
import type {
  Customer,
  LoyaltyAccount,
  LoyaltyTransaction,
  PersonalizedPromoDraft,
} from "@/types/customers";
import type {
  CustomerChatMessage,
  CustomerChatThread,
} from "@/types/customer-chat";
import type { AppNotification } from "@/types/notifications";
import type { Order } from "@/types/orders";
import type { Promotion } from "@/types/promotions";
import type { Reservation } from "@/types/reservations";
import type { Branch, Restaurant } from "@/types/restaurant";
import { getDb } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import {
  createContext,
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

interface CustomerAppContextValue {
  ready: boolean;
  error: string | null;
  slug: string;
  restaurant: Restaurant | null;
  customer: Customer | null;
  branches: Branch[];
  products: Product[];
  categories: ProductCategory[];
  promotions: Promotion[];
  personalPromos: PersonalizedPromoDraft[];
  orders: Order[];
  reservations: Reservation[];
  loyalty: LoyaltyAccount | null;
  loyaltyTx: LoyaltyTransaction[];
  notifications: AppNotification[];
  chatThread: CustomerChatThread | null;
  chatMessages: CustomerChatMessage[];
  cart: CartLine[];
  addToCart: (p: Product) => void;
  setQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  cartTotal: number;
  toggleFavorite: (productId: string) => Promise<void>;
  placeOrder: (input: {
    customerPhone?: string;
    notes?: string;
  }) => Promise<Order>;
  bookReservation: (input: {
    partySize: number;
    startsAt: string;
    customerPhone?: string;
    notes?: string;
  }) => Promise<void>;
  sendChat: (body: string) => Promise<void>;
  markRead: (id: string) => Promise<void>;
}

const Ctx = createContext<CustomerAppContextValue | null>(null);

export function useCustomerApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCustomerApp requires provider");
  return ctx;
}

export function CustomerAppProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [personalPromos, setPersonalPromos] = useState<PersonalizedPromoDraft[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyAccount | null>(null);
  const [loyaltyTx, setLoyaltyTx] = useState<LoyaltyTransaction[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [chatThread, setChatThread] = useState<CustomerChatThread | null>(null);
  const [chatMessages, setChatMessages] = useState<CustomerChatMessage[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);

  useEffect(() => {
    if (!slug || !isFirebaseConfigured()) {
      setReady(true);
      setError("Firebase no configurado");
      return;
    }
    if (!user) {
      setReady(true);
      setError(null);
      return;
    }

    let cancelled = false;
    const unsubs: Array<() => void> = [];

    void (async () => {
      try {
        setReady(false);
        const index = await resolveSlug(slug);
        if (!index) throw new Error("Restaurante no encontrado");
        const rDoc = await getDoc(
          doc(getDb(), "restaurants", index.restaurantId),
        );
        if (!rDoc.exists()) throw new Error("Restaurante no encontrado");
        const rest = { id: rDoc.id, ...rDoc.data() } as Restaurant;
        if (cancelled) return;
        setRestaurant(rest);

        const profile = await ensureCustomerProfile({
          restaurantId: rest.id,
          user,
        });
        if (cancelled) return;
        setCustomer(profile);

        const [bSnap, pSnap, cSnap, promoSnap] = await Promise.all([
          getDocs(collection(getDb(), "restaurants", rest.id, "branches")),
          getDocs(collection(getDb(), "restaurants", rest.id, "products")),
          getDocs(collection(getDb(), "restaurants", rest.id, "categories")),
          getDocs(collection(getDb(), "restaurants", rest.id, "promotions")),
        ]);
        if (cancelled) return;
        setBranches(
          bSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as Branch)
            .filter((b) => !b.deletedAt && b.status === "active"),
        );
        setProducts(
          pSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as Product)
            .filter((p) => !p.deletedAt && p.status === "active")
            .map((p) => {
              const { cost: _c, recipe: _r, ...safe } = p;
              return { ...safe, recipe: [] } as Product;
            }),
        );
        setCategories(
          cSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as ProductCategory)
            .filter((c) => !c.deletedAt && c.status === "active"),
        );
        setPromotions(
          promoSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as Promotion)
            .filter(
              (p) =>
                !p.deletedAt &&
                (p.status === "active" || p.status === "scheduled"),
            ),
        );

        unsubs.push(
          subscribeMyOrders(rest.id, user.uid, setOrders, (e) =>
            setError(e.message),
          ),
        );
        unsubs.push(
          subscribeMyReservations(rest.id, user.uid, setReservations, (e) =>
            setError(e.message),
          ),
        );
        unsubs.push(
          subscribeLoyaltyAccount(rest.id, profile.id, setLoyalty, (e) =>
            setError(e.message),
          ),
        );
        unsubs.push(
          subscribeLoyaltyTx(rest.id, profile.id, setLoyaltyTx, (e) =>
            setError(e.message),
          ),
        );
        unsubs.push(
          subscribeMyNotifications(rest.id, user.uid, setNotifications, (e) =>
            setError(e.message),
          ),
        );
        unsubs.push(
          onSnapshot(
            query(
              collection(getDb(), "restaurants", rest.id, "personalizedPromos"),
              where("customerId", "==", profile.id),
            ),
            (snap) => {
              setPersonalPromos(
                snap.docs
                  .map((d) => ({ id: d.id, ...d.data() }) as PersonalizedPromoDraft)
                  .filter((p) => !p.deletedAt && p.status === "offered"),
              );
            },
          ),
        );

        const thread = await ensureChatThread({
          restaurantId: rest.id,
          customerId: profile.id,
          customerUid: user.uid,
          customerName: profile.name,
        });
        if (cancelled) return;
        setChatThread(thread);
        unsubs.push(
          subscribeChatMessages(rest.id, thread.id, setChatMessages, (e) =>
            setError(e.message),
          ),
        );

        setError(null);
        setReady(true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error");
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [slug, user]);

  const defaultBranchId =
    branches.find((b) => b.isDefault)?.id ?? branches[0]?.id ?? "";

  const cartTotal = useMemo(
    () => cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
    [cart],
  );

  const value: CustomerAppContextValue = {
    ready,
    error,
    slug,
    restaurant,
    customer,
    branches,
    products,
    categories,
    promotions,
    personalPromos,
    orders,
    reservations,
    loyalty,
    loyaltyTx,
    notifications,
    chatThread,
    chatMessages,
    cart,
    cartTotal,
    addToCart: (p) => {
      setCart((prev) => {
        const ex = prev.find((l) => l.productId === p.id);
        if (ex) {
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
    },
    setQty: (productId, qty) => {
      setCart((prev) =>
        prev
          .map((l) => (l.productId === productId ? { ...l, quantity: qty } : l))
          .filter((l) => l.quantity > 0),
      );
    },
    clearCart: () => setCart([]),
    toggleFavorite: async (productId) => {
      if (!restaurant || !customer) return;
      const favs = customer.favorites?.includes(productId)
        ? customer.favorites.filter((id) => id !== productId)
        : [...(customer.favorites ?? []), productId];
      await updateCustomerFavorites({
        restaurantId: restaurant.id,
        customerId: customer.id,
        favorites: favs,
      });
      setCustomer({ ...customer, favorites: favs });
    },
    placeOrder: async (input) => {
      if (!restaurant || !customer || !user || !defaultBranchId) {
        throw new Error("Sesión incompleta");
      }
      if (!cart.length) throw new Error("Carrito vacío");
      const order = await placeCustomerOrder({
        restaurantId: restaurant.id,
        branchId: defaultBranchId,
        customerId: customer.id,
        customerUid: user.uid,
        customerName: customer.name,
        customerPhone: input.customerPhone ?? customer.phone,
        notes: input.notes,
        currency: restaurant.currency,
        items: cart,
      });
      setCart([]);
      return order;
    },
    bookReservation: async (input) => {
      if (!restaurant || !customer || !user || !defaultBranchId) {
        throw new Error("Sesión incompleta");
      }
      await bookCustomerReservation({
        restaurantId: restaurant.id,
        branchId: defaultBranchId,
        customerId: customer.id,
        customerUid: user.uid,
        customerName: customer.name,
        customerPhone: input.customerPhone ?? customer.phone,
        customerEmail: customer.email,
        partySize: input.partySize,
        startsAt: input.startsAt,
        notes: input.notes,
      });
    },
    sendChat: async (body) => {
      if (!restaurant || !chatThread || !user) return;
      await sendCustomerMessage({
        restaurantId: restaurant.id,
        thread: chatThread,
        senderUid: user.uid,
        body,
      });
    },
    markRead: async (id) => {
      if (!restaurant) return;
      await markNotificationRead({
        restaurantId: restaurant.id,
        notificationId: id,
      });
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
