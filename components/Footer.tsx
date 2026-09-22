import Link from "next/link";
import { Logo } from "./Logo";

const cols = [
  {
    title: "Product",
    links: [
      { href: "/#services", label: "Services" },
      { href: "/pricing", label: "Pricing" },
      { href: "/docs", label: "API reference" },
      { href: "/playground", label: "Playground" },
      { href: "/playground/video", label: "Photo & video scan" },
      { href: "/dashboard", label: "Dashboard" },
      { href: "/dashboard/people", label: "Registered people" },
    ],
  },
  {
    title: "Developers",
    links: [
      { href: "/docs#register", label: "Register a face" },
      { href: "/docs#search", label: "Search a face" },
      { href: "/docs#auth", label: "Authentication" },
      { href: "/docs#errors", label: "Error codes" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/pricing#enterprise", label: "Contact sales" },
      { href: "/login", label: "Log in" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm text-muted">
            Multi-tenant face recognition API. Register a person, search a face,
            get the match back — with quotas, rate limits and audit logs built in.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h4 className="mb-3 text-sm font-semibold">{c.title}</h4>
            <ul className="space-y-2 text-sm text-muted">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} FaceFinder. All rights reserved.</span>
          <span>Powered by InsightFace · pgvector · FastAPI</span>
        </div>
      </div>
    </footer>
  );
}
