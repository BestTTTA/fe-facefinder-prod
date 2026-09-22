import Link from "next/link";
import { SERVICES } from "@/lib/services";
import { Section } from "./Section";

const methodColor: Record<string, string> = {
  POST: "bg-orange/15 text-orange",
  GET: "bg-navy/10 text-navy",
  PATCH: "bg-amber-100 text-amber-700",
  DELETE: "bg-red-100 text-red-700",
};

export function Services() {
  const [register, search, ...rest] = SERVICES;
  return (
    <Section
      id="services"
      eyebrow="Services"
      title="Everything you need to ship face recognition"
      subtitle="Five focused services, one API key. Every response uses the same { success, data, meta } envelope."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {[register, search].map((s) => (
          <ServiceCard key={s.id} s={s} big />
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {rest.map((s) => (
          <ServiceCard key={s.id} s={s} />
        ))}
      </div>
    </Section>
  );
}

function ServiceCard({
  s,
  big = false,
}: {
  s: (typeof SERVICES)[number];
  big?: boolean;
}) {
  return (
    <Link
      href={`/docs#${s.id}`}
      className={`group flex flex-col rounded-3xl border border-line bg-surface p-6 transition-all hover:-translate-y-0.5 hover:border-navy/30 hover:shadow-lg hover:shadow-navy/5 ${big ? "sm:p-8" : ""}`}
    >
      <div className="flex items-center gap-2 font-mono text-xs">
        <span
          className={`rounded-md px-1.5 py-0.5 font-semibold ${methodColor[s.method]}`}
        >
          {s.method}
        </span>
        <span className="text-muted">{s.path}</span>
      </div>
      <h3 className={`mt-4 font-semibold tracking-tight ${big ? "text-2xl" : "text-lg"}`}>
        {s.name}
      </h3>
      <p className="mt-1 text-sm font-medium text-orange">{s.tagline}</p>
      <p className="mt-3 text-sm text-muted">{s.description}</p>
      <ul className="mt-5 space-y-1.5 text-sm">
        {s.bullets.slice(0, big ? 4 : 3).map((b) => (
          <li key={b} className="flex gap-2">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-sm bg-navy" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-6 text-xs text-muted">
        Scope: <span className="font-mono">{s.scope}</span>
        <span className="float-right text-foreground opacity-0 transition-opacity group-hover:opacity-100">
          View docs →
        </span>
      </div>
    </Link>
  );
}
