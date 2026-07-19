"use client";

import { formatCurrency } from "@/lib/format";
import { addMinutes } from "@/modules/reservations/domain/time";
import type { PublicBookingSlot } from "@/modules/reservations/domain/publicSlot";
import {
  availableTablesForSlot,
  subscribePublicBookingSlots,
  subscribePublicTables,
} from "@/modules/reservations/services/public-slots.service";
import { usePublicSite } from "@/modules/website/context/PublicSiteProvider";
import { publicSitePath } from "@/modules/website/domain/slug";
import type { Table } from "@/types/orders";
import { Button, Input, Textarea, toast } from "@/ui";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export function HomeExtras() {
  const {
    settings,
    promotions,
    events,
    sectionEnabled,
    restaurant,
    categories,
    products,
    slug,
  } = usePublicSite();

  const featured = useMemo(() => {
    const byCat = categories
      .map((c) => ({
        category: c,
        items: products.filter((p) => p.categoryId === c.id).slice(0, 4),
      }))
      .filter((g) => g.items.length)
      .slice(0, 4);
    if (byCat.length) return byCat;
    if (!products.length) return [];
    return [
      {
        category: { id: "carta", name: "Nuestra carta" },
        items: products.slice(0, 8),
      },
    ];
  }, [categories, products]);

  return (
    <div className="space-y-14">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-transparent px-6 py-10 sm:px-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--site-accent)]">
          Bienvenido
        </p>
        <h1 className="mt-2 max-w-xl font-[family-name:var(--font-display)] text-4xl tracking-tight sm:text-5xl">
          {restaurant?.name}
        </h1>
        <p className="mt-3 max-w-lg text-[#c5d0c2]">
          {settings?.about ||
            settings?.seo?.description ||
            "Descubre la carta, reserva mesa y pide online."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {sectionEnabled("menu") ? (
            <Link
              href={publicSitePath(slug, "/menu")}
              className="rounded-full bg-[var(--site-accent)] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Ver carta
            </Link>
          ) : null}
          {sectionEnabled("reservations") ? (
            <Link
              href={publicSitePath(slug, "/reservas")}
              className="rounded-full border border-white/25 bg-white/5 px-5 py-2.5 text-sm font-semibold"
            >
              Reservar mesa
            </Link>
          ) : null}
          {sectionEnabled("orders") ? (
            <Link
              href={publicSitePath(slug, "/pedir")}
              className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-[#c5d0c2]"
            >
              Pedir online
            </Link>
          ) : null}
        </div>
      </section>

      {featured.length ? (
        <section className="space-y-8">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-3xl">
                Lo que ofrecemos
              </h2>
              <p className="mt-1 text-sm text-[#a8b5a4]">
                Carta del local · actualizada desde el inventario
              </p>
            </div>
            {sectionEnabled("menu") ? (
              <Link
                href={publicSitePath(slug, "/menu")}
                className="text-sm text-[var(--site-accent)] hover:underline"
              >
                Carta completa
              </Link>
            ) : null}
          </div>
          {featured.map((g) => (
            <div key={g.category.id}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#8fa08c]">
                {g.category.name}
              </h3>
              <ul className="grid gap-3 sm:grid-cols-2">
                {g.items.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{p.name}</p>
                        {p.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-[#a8b5a4]">
                            {p.description}
                          </p>
                        ) : null}
                      </div>
                      <span className="shrink-0 tabular-nums text-[var(--site-accent)]">
                        {formatCurrency(p.price, restaurant?.currency)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : (
        <p className="text-[#8fa08c]">
          La carta se está preparando. Vuelve pronto.
        </p>
      )}

      {sectionEnabled("promotions") && promotions[0] ? (
        <section className="rounded-2xl border border-[var(--site-accent)]/30 bg-[var(--site-accent)]/10 p-6">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">
            Promoción destacada
          </h2>
          <p className="mt-2 text-lg text-[var(--site-accent)]">
            {promotions[0].name}
          </p>
          <p className="mt-1 text-[#c5d0c2]">
            {promotions[0].personalizedMessage ||
              (promotions[0].percentOff
                ? `${promotions[0].percentOff}% de descuento`
                : "Oferta disponible")}
          </p>
        </section>
      ) : null}

      {sectionEnabled("events") && events[0] ? (
        <section>
          <h2 className="font-[family-name:var(--font-display)] text-3xl">
            Próximo evento
          </h2>
          <p className="mt-2 text-lg">{events[0].title}</p>
          <p className="text-[#c5d0c2]">
            {new Date(events[0].startsAt).toLocaleString("es")}
          </p>
        </section>
      ) : null}

      {restaurant?.phone ? (
        <p className="text-sm text-[#8fa08c]">Tel. {restaurant.phone}</p>
      ) : null}
    </div>
  );
}

export function MenuPage() {
  const { categories, products, restaurant, addToCart, sectionEnabled } =
    usePublicSite();
  const grouped = useMemo(() => {
    return categories
      .map((c) => ({
        category: c,
        items: products.filter((p) => p.categoryId === c.id),
      }))
      .filter((g) => g.items.length);
  }, [categories, products]);

  const orphan = products.filter(
    (p) => !categories.some((c) => c.id === p.categoryId),
  );

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-4xl">Menú</h1>
        <p className="mt-2 text-[#c5d0c2]">Carta actualizada en tiempo real.</p>
      </header>
      {!grouped.length && !orphan.length ? (
        <p className="text-[#8fa08c]">Menú en preparación.</p>
      ) : null}
      {[...grouped, ...(orphan.length ? [{ category: { id: "otros", name: "Otros" }, items: orphan }] : [])].map(
        (g) => (
          <section key={g.category.id}>
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl">
              {g.category.name}
            </h2>
            <ul className="divide-y divide-white/10 border-y border-white/10">
              {g.items.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{p.name}</p>
                    {p.description ? (
                      <p className="mt-1 text-sm text-[#a8b5a4]">
                        {p.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums text-[var(--site-accent)]">
                      {formatCurrency(p.price, restaurant?.currency)}
                    </span>
                    {sectionEnabled("orders") ? (
                      <button
                        type="button"
                        onClick={() => {
                          addToCart(p);
                          toast("Añadido al pedido", "success");
                        }}
                        className="rounded-md border border-white/20 px-3 py-1 text-xs"
                      >
                        Añadir
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
    </div>
  );
}

export function OrderPage() {
  const {
    cart,
    setQty,
    cartTotal,
    placeOrder,
    restaurant,
    products,
    addToCart,
  } = usePublicSite();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl">
          Pedidos online
        </h1>
        <p className="mt-2 text-[#c5d0c2]">Takeaway / recogida en local.</p>
        <ul className="mt-6 space-y-2">
          {products.slice(0, 12).map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 border-b border-white/10 py-2"
            >
              <span>
                {p.name}{" "}
                <span className="text-[#8fa08c]">
                  {formatCurrency(p.price, restaurant?.currency)}
                </span>
              </span>
              <button
                type="button"
                className="text-sm text-[var(--site-accent)]"
                onClick={() => addToCart(p)}
              >
                + Añadir
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-white/15 bg-white/5 p-4">
        <h2 className="text-lg font-medium">Tu pedido</h2>
        {!cart.length ? (
          <p className="mt-3 text-sm text-[#8fa08c]">Carrito vacío</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {cart.map((l) => (
              <li key={l.productId} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {l.name} ×
                  <input
                    type="number"
                    min={0}
                    className="ml-1 w-12 rounded border border-white/20 bg-transparent px-1"
                    value={l.quantity}
                    onChange={(e) =>
                      setQty(l.productId, Number(e.target.value) || 0)
                    }
                  />
                </span>
                <span>
                  {formatCurrency(
                    l.unitPrice * l.quantity,
                    restaurant?.currency,
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-lg tabular-nums">
          Total {formatCurrency(cartTotal, restaurant?.currency)}
        </p>
        <div className="mt-4 space-y-2">
          <Input
            label="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Teléfono"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Textarea
            label="Notas"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button
            disabled={busy || !cart.length || !name.trim()}
            onClick={() => {
              void (async () => {
                try {
                  setBusy(true);
                  await placeOrder({
                    customerName: name,
                    customerPhone: phone,
                    notes,
                  });
                  toast("Pedido enviado al restaurante", "success");
                  setName("");
                  setPhone("");
                  setNotes("");
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Error", "error");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Confirmar pedido
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ReservationsPage() {
  const { bookTable, settings, restaurant, branches } = usePublicSite();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [party, setParty] = useState(
    String(settings?.reservationSettings?.defaultPartySize ?? 2),
  );
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [tableId, setTableId] = useState("");
  const [tables, setTables] = useState<Table[]>([]);
  const [slots, setSlots] = useState<PublicBookingSlot[]>([]);

  const branchId =
    branches.find((b) => b.isDefault)?.id ?? branches[0]?.id ?? "";
  const duration =
    settings?.reservationSettings?.defaultDurationMinutes ?? 90;
  const partyNum = Math.max(1, Number(party) || 2);

  useEffect(() => {
    if (!restaurant?.id) return;
    const unsubTables = subscribePublicTables(restaurant.id, setTables);
    const unsubSlots = subscribePublicBookingSlots(restaurant.id, setSlots);
    return () => {
      unsubTables();
      unsubSlots();
    };
  }, [restaurant?.id]);

  const freeTables = useMemo(() => {
    if (!when || !branchId) return [] as Table[];
    const startsAt = new Date(when).toISOString();
    const endsAt = addMinutes(startsAt, duration);
    return availableTablesForSlot({
      tables,
      slots,
      branchId,
      partySize: partyNum,
      startsAt,
      endsAt,
    });
  }, [when, branchId, duration, tables, slots, partyNum]);

  useEffect(() => {
    if (tableId && !freeTables.some((t) => t.id === tableId)) {
      setTableId("");
    }
  }, [freeTables, tableId]);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-4xl">
          Reservar mesa
        </h1>
        <p className="mt-2 text-[#c5d0c2]">
          {settings?.reservationSettings?.note ||
            "Elige fecha, comensales y una mesa libre. El local lo ve al instante."}
        </p>
      </header>

      <Input
        label="Nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Input
        label="Teléfono"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <Input
        label="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label="Comensales"
        type="number"
        min={1}
        max={50}
        value={party}
        onChange={(e) => setParty(e.target.value)}
      />
      <Input
        label="Fecha y hora"
        type="datetime-local"
        value={when}
        onChange={(e) => setWhen(e.target.value)}
      />

      {when ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-[#e8efe6]">
            Mesas disponibles
            <span className="ml-2 text-xs font-normal text-[#8fa08c]">
              ({freeTables.length} libres · {duration} min)
            </span>
          </p>
          {!freeTables.length ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-3 text-sm text-amber-100">
              No hay mesas libres para ese horario y comensales. Prueba otra
              hora o reduce el grupo.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {freeTables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTableId(t.id)}
                  className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
                    tableId === t.id
                      ? "border-[var(--site-accent)] bg-[var(--site-accent)]/20"
                      : "border-white/15 bg-white/[0.03] hover:border-white/30"
                  }`}
                >
                  <p className="font-semibold">{t.name}</p>
                  <p className="mt-0.5 text-[11px] text-[#8fa08c]">
                    {t.seats} asientos
                    {t.zone ? ` · ${t.zone}` : ""}
                  </p>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setTableId("")}
            className={`text-xs ${
              !tableId ? "text-[var(--site-accent)]" : "text-[#8fa08c]"
            }`}
          >
            Sin preferencia de mesa (asignamos la primera libre)
          </button>
        </div>
      ) : (
        <p className="text-sm text-[#8fa08c]">
          Elige fecha y hora para ver mesas libres en tiempo real.
        </p>
      )}

      <Textarea
        label="Notas"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <Button
        disabled={busy || !name.trim() || !when || freeTables.length === 0}
        onClick={() => {
          void (async () => {
            try {
              setBusy(true);
              if (!freeTables.length) {
                throw new Error(
                  "No hay mesas libres en ese horario. Elige otra hora.",
                );
              }
              const picked =
                freeTables.find((t) => t.id === tableId) ?? freeTables[0]!;
              await bookTable({
                customerName: name,
                customerPhone: phone,
                customerEmail: email,
                partySize: partyNum,
                startsAt: when,
                notes,
                tableId: picked.id,
                tableName: picked.name,
                durationMinutes: duration,
              });
              toast(`Reserva enviada · mesa ${picked.name}`, "success");
              setName("");
              setPhone("");
              setEmail("");
              setNotes("");
              setWhen("");
              setTableId("");
            } catch (e) {
              toast(e instanceof Error ? e.message : "Error", "error");
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        Confirmar reserva
      </Button>
    </div>
  );
}

export function PromotionsPage() {
  const { promotions } = usePublicSite();
  return (
    <div className="space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-4xl">
        Promociones
      </h1>
      {!promotions.length ? (
        <p className="text-[#8fa08c]">No hay promociones activas ahora.</p>
      ) : (
        <ul className="space-y-4">
          {promotions.map((p) => (
            <li key={p.id} className="border-b border-white/10 pb-4">
              <p className="text-xl font-medium">{p.name}</p>
              <p className="mt-1 text-[#c5d0c2]">
                {p.personalizedMessage ||
                  (p.percentOff ? `${p.percentOff}% dto.` : p.type)}
              </p>
              <p className="mt-1 text-xs text-[#8fa08c]">
                Hasta {new Date(p.endsAt).toLocaleDateString("es")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BlogListPage() {
  const { posts, slug } = usePublicSite();
  return (
    <div className="space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-4xl">Blog</h1>
      {!posts.length ? (
        <p className="text-[#8fa08c]">Pronto publicaremos novedades.</p>
      ) : (
        <ul className="space-y-4">
          {posts.map((p) => (
            <li key={p.id}>
              <Link
                href={publicSitePath(slug, `/blog/${p.slug}`)}
                className="text-xl text-[var(--site-accent)] hover:underline"
              >
                {p.title}
              </Link>
              {p.excerpt ? (
                <p className="mt-1 text-[#c5d0c2]">{p.excerpt}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BlogPostPage({ postSlug }: { postSlug: string }) {
  const { posts } = usePublicSite();
  const post = posts.find((p) => p.slug === postSlug);
  if (!post) return <p>Entrada no encontrada.</p>;
  return (
    <article className="prose prose-invert max-w-2xl">
      <h1 className="font-[family-name:var(--font-display)] text-4xl">
        {post.title}
      </h1>
      <p className="text-sm text-[#8fa08c]">
        {post.publishedAt
          ? new Date(post.publishedAt).toLocaleDateString("es")
          : ""}
      </p>
      <div className="mt-6 whitespace-pre-wrap text-[#d5dfd2]">{post.body}</div>
    </article>
  );
}

export function EventsPage() {
  const { events, slug } = usePublicSite();
  return (
    <div className="space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-4xl">
        Eventos
      </h1>
      {!events.length ? (
        <p className="text-[#8fa08c]">No hay eventos publicados.</p>
      ) : (
        <ul className="space-y-4">
          {events.map((e) => (
            <li key={e.id} className="border-b border-white/10 pb-4">
              <Link
                href={publicSitePath(slug, `/eventos/${e.slug}`)}
                className="text-xl text-[var(--site-accent)] hover:underline"
              >
                {e.title}
              </Link>
              <p className="mt-1 text-sm text-[#c5d0c2]">
                {new Date(e.startsAt).toLocaleString("es")}
                {e.locationLabel ? ` · ${e.locationLabel}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EventDetailPage({ eventSlug }: { eventSlug: string }) {
  const { events } = usePublicSite();
  const event = events.find((e) => e.slug === eventSlug);
  if (!event) return <p>Evento no encontrado.</p>;
  return (
    <article className="max-w-2xl space-y-3">
      <h1 className="font-[family-name:var(--font-display)] text-4xl">
        {event.title}
      </h1>
      <p className="text-[#c5d0c2]">
        {new Date(event.startsAt).toLocaleString("es")}
        {event.endsAt
          ? ` → ${new Date(event.endsAt).toLocaleString("es")}`
          : ""}
      </p>
      <p className="whitespace-pre-wrap">{event.description}</p>
    </article>
  );
}

export function ReviewsPage() {
  const { reviews, leaveReview } = usePublicSite();
  const [name, setName] = useState("");
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const avg =
    reviews.length === 0
      ? 0
      : reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl">
          Opiniones
        </h1>
        <p className="mt-2 text-[#c5d0c2]">
          Media {avg.toFixed(1)} / 5 · {reviews.length} reseñas
        </p>
        <ul className="mt-6 space-y-4">
          {reviews.map((r) => (
            <li key={r.id} className="border-b border-white/10 pb-3">
              <p className="font-medium">
                {r.authorName} · {"★".repeat(r.rating)}
              </p>
              <p className="mt-1 text-[#c5d0c2]">{r.comment}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-3 rounded-xl border border-white/15 bg-white/5 p-4">
        <h2 className="text-lg font-medium">Deja tu opinión</h2>
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="Valoración (1-5)"
          type="number"
          min={1}
          max={5}
          value={rating}
          onChange={(e) => setRating(e.target.value)}
        />
        <Textarea
          label="Comentario"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <Button
          disabled={busy || !name.trim() || !comment.trim()}
          onClick={() => {
            void (async () => {
              try {
                setBusy(true);
                await leaveReview({
                  authorName: name,
                  rating: Number(rating) || 5,
                  comment,
                });
                toast("Gracias — pendiente de moderación", "success");
                setComment("");
              } catch (e) {
                toast(e instanceof Error ? e.message : "Error", "error");
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          Enviar
        </Button>
      </div>
    </div>
  );
}

export function LocationPage() {
  const { restaurant, branches, settings } = usePublicSite();
  const maps =
    settings?.social?.googleMapsUrl ||
    (restaurant?.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}`
      : null);

  return (
    <div className="space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-4xl">
        Ubicación
      </h1>
      <p className="text-lg text-[#c5d0c2]">
        {restaurant?.address || "Dirección próximamente"}
      </p>
      {restaurant?.phone ? <p>Tel. {restaurant.phone}</p> : null}
      {restaurant?.email ? <p>{restaurant.email}</p> : null}
      {branches.map((b) => (
        <div key={b.id} className="border-t border-white/10 pt-4">
          <p className="font-medium">{b.name}</p>
          <p className="text-[#c5d0c2]">{b.address || restaurant?.address}</p>
          {b.openingHours ? (
            <ul className="mt-2 text-sm text-[#8fa08c]">
              {Object.entries(b.openingHours).map(([day, hours]) => (
                <li key={day}>
                  {day}:{" "}
                  {hours ? `${hours.open} – ${hours.close}` : "Cerrado"}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
      {maps ? (
        <a
          href={maps}
          target="_blank"
          rel="noreferrer"
          className="inline-flex text-[var(--site-accent)] underline"
        >
          Abrir en Google Maps
        </a>
      ) : null}
    </div>
  );
}
