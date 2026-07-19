import Link from "next/link";
import { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 font-display text-3xl tracking-tight">
        SmartServe
      </Link>
      <h1 className="font-display text-3xl tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-fg-muted">{subtitle}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}
