import Link from "next/link";

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=2000&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-bg/30 via-bg/75 to-bg" />

      <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col justify-end px-6 pb-16 pt-24 md:justify-center md:pb-24">
        <p className="animate-fade-up font-display text-5xl tracking-tight md:text-7xl">
          SmartServe
        </p>
        <h1
          className="mt-4 max-w-xl animate-fade-up text-xl text-fg-muted md:text-2xl"
          style={{ animationDelay: "0.08s" }}
        >
          Arquitectura lista. El sistema operativo del restaurante, construido para escalar.
        </h1>
        <div
          className="mt-8 flex flex-wrap gap-3 animate-fade-up"
          style={{ animationDelay: "0.14s" }}
        >
          <Link
            href="/register"
            className="inline-flex h-12 items-center justify-center rounded-[12px] bg-accent px-5 text-base font-medium text-accent-fg transition hover:opacity-90"
          >
            Crear cuenta
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-[12px] border border-border bg-bg-elevated px-5 text-base font-medium transition hover:bg-bg-muted"
          >
            Iniciar sesión
          </Link>
        </div>
      </main>
    </div>
  );
}
