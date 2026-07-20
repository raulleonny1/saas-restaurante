import Image from "next/image";
import Link from "next/link";

const FEATURES = [
  {
    title: "POS y sala",
    text: "Pedidos, mesas y tickets en tiempo real. Meseros y caja sincronizados.",
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
      {/* ── Hero: una sola composición ── */}
      <header className="relative min-h-[100svh] overflow-hidden">
        <Image
          src="/marketing/hero-pos.png"
          alt="SmartServe POS en un restaurante"
          fill
          priority
          sizes="100vw"
          className="landing-hero-img object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a1210]/95% via-[#0a1210]/55% to-[#0a1210]/25%" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a1210]/70% via-transparent to-transparent" />

        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-6 pb-14 pt-8 md:pb-20 md:pt-12">
          <nav className="absolute left-6 right-6 top-6 flex items-center justify-between md:left-8 md:right-8 md:top-8">
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

          <p className="landing-reveal font-display text-[clamp(3.25rem,12vw,7.5rem)] leading-[0.92] tracking-tight text-white">
            SmartServe
          </p>
          <h1 className="landing-reveal landing-reveal-delay-1 mt-5 max-w-xl font-display text-[clamp(1.35rem,3.2vw,2rem)] font-normal leading-snug tracking-tight text-white/92">
            El sistema operativo de tu restaurante
          </h1>
          <p className="landing-reveal landing-reveal-delay-2 mt-3 max-w-md text-base text-white/70 md:text-lg">
            POS, cocina, caja, reservas y web en una sola plataforma pensada
            para bares y restaurantes.
          </p>
          <div className="landing-reveal landing-reveal-delay-3 mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center rounded-[12px] bg-accent px-6 text-base font-medium text-accent-fg transition hover:opacity-90"
            >
              Crear cuenta gratis
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-[12px] border border-white/25 bg-white/10 px-6 text-base font-medium text-white backdrop-blur-sm transition hover:bg-white/16"
            >
              Acceder a la app
            </Link>
          </div>
        </div>
      </header>

      {/* ── Capacidad principal + visual cocina ── */}
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

      {/* ── Capacidad sala móvil ── */}
      <section className="border-y border-border bg-bg-muted/50">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-2 md:items-center md:gap-14 md:py-28">
          <div className="landing-visual relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-[20px] md:order-1">
            <Image
              src="/marketing/waiter.png"
              alt="App de meseros SmartServe"
              fill
              sizes="(max-width: 768px) 100vw, 380px"
              className="object-cover"
            />
          </div>
          <div className="md:order-2">
            <h2 className="font-display text-[clamp(1.85rem,4vw,2.75rem)] leading-tight tracking-tight">
              Sala en el bolsillo del mesero
            </h2>
            <p className="mt-4 max-w-md text-fg-muted md:text-lg">
              Toma pedidos en mesa, mueve comandas y cobra sin volver al TPV.
              Pensado para el ritmo real del servicio.
            </p>
          </div>
        </div>
      </section>

      {/* ── Qué incluye ── */}
      <section id="funciones" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <h2 className="max-w-xl font-display text-[clamp(1.85rem,4vw,2.75rem)] leading-tight tracking-tight">
          Todo lo que necesitas para operar
        </h2>
        <p className="mt-4 max-w-lg text-fg-muted md:text-lg">
          Un solo login para dueño, gerente, meseros, cocina y caja. Cada rol ve
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

      {/* ── CTA final ── */}
      <section className="relative overflow-hidden border-t border-border">
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
              Crea tu cuenta, elige plan gratis o de pago, y deja que tu equipo
              trabaje desde el primer día.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center rounded-[12px] bg-accent px-6 text-base font-medium text-accent-fg transition hover:opacity-90"
            >
              Registrarme
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
            <Link href="/login" className="hover:text-fg">
              Acceder
            </Link>
            <Link href="/register" className="hover:text-fg">
              Registro
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
