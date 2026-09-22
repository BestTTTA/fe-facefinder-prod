import { Section } from "./Section";

const items = [
  {
    title: "Tenant isolation by design",
    body: "Every embedding, image and log is scoped to your tenant. Search never crosses tenants — enforced in the query, not just the API layer.",
  },
  {
    title: "Private storage, signed URLs",
    body: "Originals and thumbnails live in a private bucket and are only exposed through short-lived signed URLs.",
  },
  {
    title: "Atomic quotas",
    body: "Quota checks are single UPDATE … WHERE count + n <= limit statements, so concurrent requests cannot overspend.",
  },
  {
    title: "Rate limiting per package",
    body: "Redis-backed window per tenant with X-RateLimit-* headers on every response.",
  },
  {
    title: "Immutable audit trail",
    body: "usage_logs, upload_logs and search_logs are append-only; admin actions are recorded in audit_logs.",
  },
  {
    title: "Scoped, rotatable keys",
    body: "Keys carry only the scopes they need, can expire, and rotate with zero downtime.",
  },
];

export function Trust() {
  return (
    <Section
      id="trust"
      eyebrow="Built for production"
      title="Security and control you do not have to build yourself"
      className="bg-surface"
    >
      <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <div key={it.title} className="flex gap-4">
            <span className="mt-1 grid h-8 w-8 shrink-0 grid-cols-2 overflow-hidden rounded-lg">
              <span />
              <span className="bg-navy" />
              <span className="bg-orange" />
              <span />
            </span>
            <div>
              <h3 className="font-semibold">{it.title}</h3>
              <p className="mt-1 text-sm text-muted">{it.body}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
