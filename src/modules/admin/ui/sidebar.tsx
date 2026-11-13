"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { ADMIN_NAV } from "../nav";

export function AdminSidebar({ role }: { role: "OWNER" | "EDITOR" }) {
  const pathname = usePathname();
  const items = ADMIN_NAV.filter((i) => !i.ownerOnly || role === "OWNER");
  const groups = [...new Set(items.map((i) => i.group))];
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  return (
    <>
      {/* Móvil: barra horizontal */}
      <nav className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-2 py-2 lg:hidden">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className={cn("shrink-0 rounded-md px-3 py-1.5 text-sm", isActive(i.href) ? "bg-primary text-on-primary" : "hover:bg-primary-soft")}>
            {i.label}
          </Link>
        ))}
      </nav>
      {/* Escritorio */}
      <nav className="hidden w-56 shrink-0 flex-col gap-5 border-r border-border bg-surface p-4 lg:flex">
        {groups.map((g) => (
          <div key={g}>
            <p className="mb-1 px-2 text-xs font-semibold tracking-wide text-muted uppercase">{g}</p>
            {items
              .filter((i) => i.group === g)
              .map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  aria-current={isActive(i.href) ? "page" : undefined}
                  className={cn("block rounded-md px-2 py-1.5 text-sm", isActive(i.href) ? "bg-primary font-semibold text-on-primary" : "hover:bg-primary-soft")}
                >
                  {i.label}
                </Link>
              ))}
          </div>
        ))}
      </nav>
    </>
  );
}
