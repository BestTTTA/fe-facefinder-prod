"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/Button";
import { adminApi, AdminUnauthenticated, getAdminToken, setAdminToken, type AdminUser } from "@/lib/admin";

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/packages", label: "Packages" },
  { href: "/admin/audit-logs", label: "Audit logs" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<AdminUser | null>(null);

  useEffect(() => {
    if (!getAdminToken()) {
      router.replace("/admin/login");
      return;
    }
    adminApi<AdminUser>("/auth/me")
      .then(setAdmin)
      .catch((e) => {
        if (e instanceof AdminUnauthenticated) router.replace("/admin/login");
      });
  }, [router]);

  function logout() {
    void adminApi("/auth/logout", { method: "POST" }).catch(() => undefined);
    setAdminToken(null);
    router.replace("/admin/login");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <aside className="flex w-full flex-col border-b border-line bg-surface md:w-60 md:border-b-0 md:border-r">
        <div className="flex h-16 items-center justify-between px-5">
          <Logo />
          <span className="rounded-full bg-navy px-2 py-0.5 text-[11px] font-semibold text-white">Admin</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {nav.map((n) => {
            const active = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`whitespace-nowrap rounded-full px-3 py-2 text-sm md:rounded-xl ${
                  active ? "bg-navy text-white" : "text-muted hover:bg-black/5 hover:text-foreground"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden border-t border-line p-4 md:block">
          {admin && (
            <p className="truncate text-sm">
              <span className="font-medium">{admin.username}</span>
              <span className="block truncate text-xs text-muted">{admin.roles.join(", ")}</span>
            </p>
          )}
          <Button variant="outline" size="sm" className="mt-3 w-full" onClick={logout}>
            Log out
          </Button>
          <Link href="/" className="mt-3 block text-center text-xs text-muted hover:text-foreground">
            ← Back to site
          </Link>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">{admin ? children : <p className="text-sm text-muted">Loading…</p>}</main>
    </div>
  );
}
