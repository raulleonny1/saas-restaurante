"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { publicSitePath } from "@/modules/website/domain/slug";
import {
  claimSlug,
  ensureWebsiteSettings,
  markDomainActive,
  moderateReview,
  saveWebsiteSettings,
  setCustomDomain,
  subscribeBlogPosts,
  subscribeReviews,
  subscribeSiteEvents,
  subscribeWebsiteSettings,
  upsertBlogPost,
  upsertSiteEvent,
} from "@/modules/website/services/website-admin.service";
import type {
  BlogPost,
  Review,
  SiteEvent,
  WebsiteSettings,
} from "@/types/website";
import {
  Alert,
  Badge,
  Button,
  Input,
  PageHeader,
  Skeleton,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
} from "@/ui";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function WebsiteAdminView() {
  const { can } = useAuth();
  const { restaurant, restaurantId } = useRestaurant();
  const [settings, setSettings] = useState<WebsiteSettings | null>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [events, setEvents] = useState<SiteEvent[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("general");
  const [slugInput, setSlugInput] = useState("");
  const [domainInput, setDomainInput] = useState("");
  const [busy, setBusy] = useState(false);

  // content forms
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [eventStart, setEventStart] = useState("");

  useEffect(() => {
    if (!restaurantId || !restaurant) {
      setReady(true);
      return;
    }
    void ensureWebsiteSettings({
      restaurantId,
      restaurantName: restaurant.name,
      slug: restaurant.slug,
    })
      .then(async (s) => {
        setSettings(s);
        setDomainInput(s.customDomain || "");
        // Refresh slug from restaurant doc (may have been auto-created)
        const { getDoc, doc } = await import("firebase/firestore");
        const { getDb } = await import("@/lib/firebase");
        const snap = await getDoc(doc(getDb(), "restaurants", restaurantId));
        const liveSlug =
          (snap.data()?.slug as string | undefined) || restaurant.slug || "";
        setSlugInput(liveSlug);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));

    const u1 = subscribeWebsiteSettings(
      restaurantId,
      (s) => {
        setSettings(s);
        setReady(true);
      },
      (e) => setError(e.message),
    );
    const u2 = subscribeBlogPosts(restaurantId, setPosts);
    const u3 = subscribeSiteEvents(restaurantId, setEvents);
    const u4 = subscribeReviews(restaurantId, setReviews);
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [restaurantId, restaurant]);

  if (!ready) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-[50vh] w-full" />
      </div>
    );
  }

  if (!can("website.read") && !can("website.manage")) {
    return (
      <Alert tone="warning" title="Sin acceso">
        Necesitas `website.read`.
      </Alert>
    );
  }

  const slug = restaurant?.slug || slugInput;
  const siteUrl = slug ? publicSitePath(slug) : null;
  const canManage = can("website.manage");

  return (
    <div className="space-y-4 pb-16 lg:pb-0">
      <PageHeader
        title="Sitio web"
        description="Página automática del restaurante: menú, pedidos, reservas, opiniones, ubicación, promociones, blog, eventos, SEO y dominio."
        actions={
          <div className="flex flex-wrap gap-2">
            {settings?.published ? (
              <Badge tone="success">Publicado</Badge>
            ) : (
              <Badge tone="warning">Borrador</Badge>
            )}
            {siteUrl ? (
              <Link href={siteUrl} target="_blank">
                <Button size="sm" variant="secondary">
                  <ExternalLink className="h-3.5 w-3.5" /> Ver sitio
                </Button>
              </Link>
            ) : null}
          </div>
        }
      />

      {error ? (
        <Alert tone="danger" title="Error">
          {error}
        </Alert>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="general">General & SEO</TabsTrigger>
          <TabsTrigger value="domain">Dominio</TabsTrigger>
          <TabsTrigger value="blog">Blog</TabsTrigger>
          <TabsTrigger value="events">Eventos</TabsTrigger>
          <TabsTrigger value="reviews">Opiniones</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
              Home del cliente (sin registro)
            </p>
            <p className="mt-1 text-sm text-[#a8b5a4]">
              Esta es la página pública donde tus clientes ven la carta, reservan
              mesa y piden. No necesitan crear cuenta.
            </p>
            {slug ? (
              <>
                <p className="mt-3 break-all rounded-xl bg-black/30 px-3 py-2 font-mono text-sm text-emerald-100">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/r/${slug}`
                    : `/r/${slug}`}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/r/${slug}`} target="_blank">
                    <Button size="sm">
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir home del
                      cliente
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const url =
                        typeof window !== "undefined"
                          ? `${window.location.origin}/r/${slug}`
                          : `/r/${slug}`;
                      void navigator.clipboard.writeText(url).then(
                        () => toast("Enlace copiado", "success"),
                        () => toast(url, "info"),
                      );
                    }}
                  >
                    Copiar enlace
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-amber-200">
                Primero guarda un slug abajo (ej. nombre de tu bar) y pulsa
                «Guardar y publicar».
              </p>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Input
              label="Slug público (/r/…)"
              value={slugInput}
              disabled={!canManage}
              onChange={(e) => setSlugInput(e.target.value)}
              placeholder="ej. mi-bar"
            />
            <div className="flex items-end gap-2">
              <Button
                disabled={!canManage || busy}
                onClick={() => {
                  void (async () => {
                    if (!restaurantId || !restaurant) return;
                    try {
                      setBusy(true);
                      const next = await claimSlug({
                        restaurantId,
                        restaurantName: restaurant.name,
                        slug: slugInput,
                        previousSlug: restaurant.slug,
                        published: true,
                      });
                      setSlugInput(next);
                      await saveWebsiteSettings(restaurantId, {
                        published: true,
                      });
                      toast(
                        `Listo · home del cliente: /r/${next}`,
                        "success",
                      );
                    } catch (e) {
                      toast(e instanceof Error ? e.message : "Error", "error");
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                Guardar y publicar
              </Button>
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm">
            <Switch
              checked={settings?.published ?? false}
              disabled={!canManage}
              onCheckedChange={(published) => {
                if (!restaurantId || !settings) return;
                void saveWebsiteSettings(restaurantId, { published }).then(() =>
                  toast(published ? "Sitio publicado" : "Sitio en borrador", "info"),
                );
              }}
            />
            Sitio publicado (recomendado: ON)
          </label>

          <Input
            label="Tagline"
            value={settings?.tagline ?? ""}
            disabled={!canManage}
            onChange={(e) =>
              setSettings((s) => (s ? { ...s, tagline: e.target.value } : s))
            }
          />
          <Textarea
            label="Sobre nosotros"
            rows={3}
            value={settings?.about ?? ""}
            disabled={!canManage}
            onChange={(e) =>
              setSettings((s) => (s ? { ...s, about: e.target.value } : s))
            }
          />
          <Input
            label="SEO título"
            value={settings?.seo.title ?? ""}
            disabled={!canManage}
            onChange={(e) =>
              setSettings((s) =>
                s
                  ? { ...s, seo: { ...s.seo, title: e.target.value } }
                  : s,
              )
            }
          />
          <Textarea
            label="SEO descripción"
            rows={2}
            value={settings?.seo.description ?? ""}
            disabled={!canManage}
            onChange={(e) =>
              setSettings((s) =>
                s
                  ? { ...s, seo: { ...s.seo, description: e.target.value } }
                  : s,
              )
            }
          />
          <Input
            label="Imagen hero (URL)"
            value={settings?.heroImageUrl ?? ""}
            disabled={!canManage}
            onChange={(e) =>
              setSettings((s) =>
                s ? { ...s, heroImageUrl: e.target.value } : s,
              )
            }
          />
          <Input
            label="Color acento (hex)"
            value={settings?.accentColor ?? ""}
            disabled={!canManage}
            onChange={(e) =>
              setSettings((s) =>
                s ? { ...s, accentColor: e.target.value } : s,
              )
            }
          />

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                "menu",
                "orders",
                "reservations",
                "reviews",
                "location",
                "promotions",
                "blog",
                "events",
              ] as const
            ).map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <Switch
                  checked={settings?.sections[key] !== false}
                  disabled={!canManage}
                  onCheckedChange={(on) =>
                    setSettings((s) =>
                      s
                        ? {
                            ...s,
                            sections: { ...s.sections, [key]: on },
                          }
                        : s,
                    )
                  }
                />
                {key}
              </label>
            ))}
          </div>

          {canManage ? (
            <Button
              onClick={() => {
                if (!restaurantId || !settings) return;
                void saveWebsiteSettings(restaurantId, settings).then(() =>
                  toast("Sitio guardado", "success"),
                );
              }}
            >
              Guardar ajustes
            </Button>
          ) : null}
        </TabsContent>

        <TabsContent value="domain" className="space-y-4">
          <Alert tone="info" title="Dominio personalizado">
            Apunta un CNAME de tu dominio al host de SmartServe. Luego guarda el
            dominio aquí y marca como activo cuando el DNS propague.
          </Alert>
          <Input
            label="Dominio (ej. www.miresto.com)"
            value={domainInput}
            disabled={!canManage}
            onChange={(e) => setDomainInput(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!canManage || busy || !slug}
              onClick={() => {
                void (async () => {
                  if (!restaurantId || !slug) return;
                  try {
                    setBusy(true);
                    const res = await setCustomDomain({
                      restaurantId,
                      slug,
                      host: domainInput,
                      previousHost: settings?.customDomain,
                    });
                    toast(
                      res.host
                        ? `Dominio pendiente DNS · token ${res.token}`
                        : "Dominio eliminado",
                      "success",
                    );
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "Error", "error");
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              Guardar dominio
            </Button>
            {settings?.customDomain ? (
              <Button
                variant="secondary"
                disabled={!canManage}
                onClick={() => {
                  void markDomainActive({
                    restaurantId: restaurantId!,
                    host: settings.customDomain!,
                  }).then(() => toast("Dominio marcado activo", "success"));
                }}
              >
                Marcar activo
              </Button>
            ) : null}
          </div>
          {settings?.domainVerificationToken ? (
            <p className="text-sm text-fg-muted">
              Token verificación:{" "}
              <code>{settings.domainVerificationToken}</code>
              <br />
              Estado: {settings.domainStatus || "none"}
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="blog" className="space-y-4">
          <Input
            label="Título del post"
            value={postTitle}
            onChange={(e) => setPostTitle(e.target.value)}
            disabled={!canManage}
          />
          <Textarea
            label="Contenido"
            rows={4}
            value={postBody}
            onChange={(e) => setPostBody(e.target.value)}
            disabled={!canManage}
          />
          <Button
            disabled={!canManage || !postTitle.trim() || !postBody.trim()}
            onClick={() => {
              void upsertBlogPost({
                restaurantId: restaurantId!,
                title: postTitle,
                body: postBody,
                status: "published",
              }).then(() => {
                toast("Post publicado", "success");
                setPostTitle("");
                setPostBody("");
              });
            }}
          >
            Publicar post
          </Button>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {posts.map((p) => (
              <li key={p.id} className="px-3 py-2 text-sm">
                <Badge tone={p.status === "published" ? "success" : "neutral"}>
                  {p.status}
                </Badge>{" "}
                {p.title}
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Input
            label="Título"
            value={eventTitle}
            onChange={(e) => setEventTitle(e.target.value)}
            disabled={!canManage}
          />
          <Textarea
            label="Descripción"
            rows={3}
            value={eventDesc}
            onChange={(e) => setEventDesc(e.target.value)}
            disabled={!canManage}
          />
          <Input
            label="Inicio"
            type="datetime-local"
            value={eventStart}
            onChange={(e) => setEventStart(e.target.value)}
            disabled={!canManage}
          />
          <Button
            disabled={
              !canManage || !eventTitle.trim() || !eventDesc.trim() || !eventStart
            }
            onClick={() => {
              void upsertSiteEvent({
                restaurantId: restaurantId!,
                title: eventTitle,
                description: eventDesc,
                startsAt: new Date(eventStart).toISOString(),
                status: "published",
              }).then(() => {
                toast("Evento publicado", "success");
                setEventTitle("");
                setEventDesc("");
                setEventStart("");
              });
            }}
          >
            Publicar evento
          </Button>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {events.map((e) => (
              <li key={e.id} className="px-3 py-2 text-sm">
                {e.title} · {new Date(e.startsAt).toLocaleString("es")}
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="reviews" className="space-y-3">
          {!reviews.length ? (
            <p className="text-sm text-fg-muted">Sin opiniones aún.</p>
          ) : (
            reviews.map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {r.authorName} · {r.rating}/5{" "}
                    <Badge tone="neutral">{r.status}</Badge>
                  </p>
                  <p className="text-sm text-fg-muted">{r.comment}</p>
                </div>
                {canManage && r.status === "pending" ? (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={() =>
                        void moderateReview({
                          restaurantId: restaurantId!,
                          reviewId: r.id,
                          status: "approved",
                        })
                      }
                    >
                      Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void moderateReview({
                          restaurantId: restaurantId!,
                          reviewId: r.id,
                          status: "rejected",
                        })
                      }
                    >
                      Rechazar
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
