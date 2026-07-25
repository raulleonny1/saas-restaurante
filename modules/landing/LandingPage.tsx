import {
  BILLING_PLANS,
  formatPlanPrice,
  type BillingPlanId,
} from "@/types/billing";
import Image from "next/image";
import Link from "next/link";

const PLAN_ORDER: BillingPlanId[] = [
  "trial",
  "starter",
  "business",
  "enterprise",
];

const FEATURES = [
  {
    title: "POS y sala",
    text: "Pedidos, mesas y tickets en tiempo real. Camareros y caja sincronizados.",
  },
  {
    title: "Cocina y barra",
    text: "Pantallas KDS claras: qué se cocina, qué sale y qué está listo.",
  },
  {
    title: "Caja y cobros",
    text: "Cobro rápido, cierre Z y control de turnos sin líos de fin de noche.",
  },
  {
    title: "Reservas y clientes",
    text: "Agenda, CRM y fidelización para que vuelvan a tu local.",
  },
  {
    title: "Web y pedidos",
    text: "Carta pública, reservas online y pedidos al cliente desde el móvil.",
  },
  {
    title: "IA y reportes",
    text: "Insights de ventas y operación para decidir con datos, no a ojo.",
  },
] as const;

export function LandingPage() {
  return (
    <div className="landing bg-bg text-fg">
      {/* â”€â”€ Hero: marca arriba (legible) + producto a pantalla completa abajo â”€â”€ */}
      <header className="landing-hero relative flex min-h-[100svh] flex-col overflow-hidden">
        <nav className="relative z-20 flex items-center justify-between px-6 pt-6 md:px-10 md:pt-8">
          <span className="font-display text-lg tracking-tight text-white/90 md:text-xl">
            SmartServe
          </span>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-[12px] px-3 py-2 text-sm text-white/85 transition hover:bg-white/10 hover:text-white"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="rounded-[12px] bg-accent px-3.5 py-2 text-sm font-medium text-accent-fg transition hover:opacity-90"
            >
              Empezar
            </Link>
          </div>
        </nav>

        <div className="relative z-20 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 pb-6 pt-10 md:px-10 md:pb-8 md:pt-14">
          <p className="landing-reveal font-display text-[clamp(3.5rem,11vw,7rem)] leading-[0.92] tracking-tight text-white">
            SmartServe
          </p>
          <h1 className="landing-reveal landing-reveal-delay-1 mt-4 max-w-xl font-display text-[clamp(1.35rem,3vw,1.85rem)] font-normal leading-snug tracking-tight text-white/90">
            El sistema operativo de tu restaurante
          </h1>
          <p className="landing-reveal landing-reveal-delay-2 mt-3 max-w-md text-base text-white/65 md:text-lg">
            POS, cocina, caja, reservas y web en una sola plataforma pensada
            para bares y restaurantes.
          </p>
          <div className="landing-reveal landing-reveal-delay-3 mt-8 flex flex-wrap gap-3">
            <Link
              href="/register?plan=trial"
              className="inline-flex h-12 items-center justify-center rounded-[12px] bg-accent px-6 text-base font-medium text-accent-fg transition hover:opacity-90"
            >
              Activar acceso
            </Link>
            <Link
              href="/#precios"
              className="inline-flex h-12 items-center justify-center rounded-[12px] border border-white/20 bg-white/8 px-6 text-base font-medium text-white transition hover:bg-white/14"
            >
              Ver precios
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-[12px] px-6 text-base font-medium text-white/80 underline-offset-4 transition hover:text-white hover:underline"
            >
              Entrar con PIN
            </Link>
          </div>
        </div>

        {/* Producto: franja inferior a ancho completo, sin texto encima */}
        <div className="landing-hero-product relative z-10 mt-auto h-[42svh] min-h-[240px] w-full md:h-[48svh]">
          <Image
            src="/marketing/hero-pos.png"
            alt="SmartServe POS en un restaurante"
            fill
            priority
            sizes="100vw"
            className="landing-hero-img object-cover object-[center_35%]"
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#07110e] to-transparent" />
        </div>
      </header>

      {/* â”€â”€ Capacidad principal + visual cocina â”€â”€ */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-2 md:items-center md:gap-14 md:py-28">
          <div>
            <h2 className="font-display text-[clamp(1.85rem,4vw,2.75rem)] leading-tight tracking-tight">
              De la mesa a la cocina sin fricción
            </h2>
            <p className="mt-4 max-w-md text-fg-muted md:text-lg">
              Cada pedido llega al instante a cocina y barra. Menos gritos, menos
              errores, servicio más rápido.
            </p>
          </div>
          <div className="landing-visual relative aspect-[4/3] overflow-hidden rounded-[20px]">
            <Image
              src="/marketing/kitchen.png"
              alt="Pantalla de cocina SmartServe"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* â”€â”€ Capacidad sala móvil â”€â”€ */}
      <section className="border-y border-border bg-bg-muted/50">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-2 md:items-center md:gap-14 md:py-28">
          <div className="landing-visual relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-[20px] md:order-1">
            <Image
              src="/marketing/waiter.png"
              alt="App de camareros SmartServe"
              fill
              sizes="(max-width: 768px) 100vw, 380px"
              className="object-cover"
            />
          </div>
          <div className="md:order-2">
            <h2 className="font-display text-[clamp(1.85rem,4vw,2.75rem)] leading-tight tracking-tight">
              Sala en el bolsillo del camarero
            </h2>
            <p className="mt-4 max-w-md text-fg-muted md:text-lg">
              Toma pedidos en mesa, mueve comandas y cobra sin volver al TPV.
              Pensado para el ritmo real del servicio.
            </p>
          </div>
        </div>
      </section>

      {/* Qué incluye */}
      <section id="funciones" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <h2 className="max-w-xl font-display text-[clamp(1.85rem,4vw,2.75rem)] leading-tight tracking-tight">
          Todo lo que necesitas para operar
        </h2>
        <p className="mt-4 max-w-lg text-fg-muted md:text-lg">
          Un solo login para dueño, gerente, camareros, cocina y caja. Cada rol ve
          solo lo suyo.
        </p>
        <ul className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="border-t border-border pt-5">
              <h3 className="font-display text-xl tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted md:text-base">
                {f.text}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Precios */}
      <section id="precios" className="border-y border-border bg-bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <h2 className="max-w-xl font-display text-[clamp(1.85rem,4vw,2.75rem)] leading-tight tracking-tight">
            Precios claros
          </h2>
          <p className="mt-4 max-w-lg text-fg-muted md:text-lg">
            Empieza gratis o elige el plan que encaje con tu local. Activas lo
            contratado desde la plataforma.
          </p>
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {PLAN_ORDER.map((id) => {
              const p = BILLING_PLANS[id];
              const price =
                id === "trial"
                  ? "0 €"
                  : `${formatPlanPrice(p.monthlyPriceCents)}/mes`;
              return (
                <li
                  key={id}
                  className={`flex flex-col border-t-2 pt-5 ${
                    p.recommended
                      ? "border-accent"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-display text-2xl tracking-tight">
                      {p.name}
                    </h3>
                    {p.recommended ? (
                      <span className="text-xs font-medium text-accent">
                        Recomendado
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 font-display text-3xl tracking-tight">
                    {price}
                  </p>
                  <p className="mt-1 text-sm text-fg-muted">{p.description}</p>
                  <ul className="mt-5 flex-1 space-y-2 text-sm text-fg-muted">
                    {p.features.map((f) => (
                      <li key={f} className="border-l-2 border-accent/30 pl-3">
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/register"
                    className={`mt-6 inline-flex h-11 items-center justify-center rounded-[12px] px-4 text-sm font-medium transition ${
                      p.recommended
                        ? "bg-accent text-accent-fg hover:opacity-90"
                        : "border border-border bg-bg-elevated hover:bg-bg-muted"
                    }`}
                  >
                    Activar acceso
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(700px 320px at 20% 0%, color-mix(in oklab, var(--accent) 28%, transparent), transparent 60%)",
          }}
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-20 md:flex-row md:items-end md:justify-between md:py-28">
          <div>
            <p className="font-display text-[clamp(2.25rem,5vw,3.5rem)] leading-none tracking-tight">
              Empieza hoy
            </p>
            <p className="mt-3 max-w-md text-fg-muted md:text-lg">
              Crea tu cuenta con el plan Gratis o el que hayas contratado.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center rounded-[12px] bg-accent px-6 text-base font-medium text-accent-fg transition hover:opacity-90"
            >
              Activar mi acceso
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-[12px] border border-border bg-bg-elevated px-6 text-base font-medium transition hover:bg-bg-muted"
            >
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 text-sm text-fg-muted sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-fg">SmartServe</p>
          <p>Software para restaurantes, bares y cafeterías.</p>
          <div className="flex gap-4">
            <Link href="/#precios" className="hover:text-fg">
              Precios
            </Link>
            <Link href="/login" className="hover:text-fg">
              Acceder
            </Link>
            <Link href="/register?plan=trial" className="hover:text-fg">
              Registro
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
