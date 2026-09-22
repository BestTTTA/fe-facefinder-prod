import { PACKAGES, fmtBytes, fmtLimit } from "@/lib/services";
import { ButtonLink } from "./Button";

export function PricingGrid({ compact = false }: { compact?: boolean }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {PACKAGES.map((p) => {
        const dark = p.highlight;
        const isEnterprise = p.price === -1;
        return (
          <div
            key={p.name}
            id={isEnterprise ? "enterprise" : undefined}
            className={`relative flex scroll-mt-24 flex-col rounded-3xl border p-6 ${
              dark
                ? "border-navy bg-navy text-white shadow-xl shadow-navy/20"
                : "border-line bg-surface"
            }`}
          >
            {dark && (
              <span className="absolute -top-3 left-6 rounded-full bg-orange px-3 py-1 text-xs font-semibold text-white">
                Most popular
              </span>
            )}
            <h3 className="text-lg font-semibold">{p.name}</h3>
            <p className={`mt-1 text-sm ${dark ? "text-white/70" : "text-muted"}`}>
              {p.description}
            </p>
            <div className="mt-5 flex items-baseline gap-1">
              {isEnterprise ? (
                <span className="text-3xl font-semibold tracking-tight">Custom</span>
              ) : (
                <>
                  <span className="text-4xl font-semibold tracking-tight">
                    ${p.price}
                  </span>
                  <span className={`text-sm ${dark ? "text-white/70" : "text-muted"}`}>
                    / month
                  </span>
                </>
              )}
            </div>
            <ButtonLink
              href={isEnterprise ? "mailto:sales@facefinder.io" : "/login"}
              variant={dark ? "primary" : p.price === 0 ? "outline" : "dark"}
              className="mt-6 w-full"
            >
              {p.cta}
            </ButtonLink>
            <ul className={`mt-6 space-y-2.5 text-sm ${dark ? "text-white/85" : ""}`}>
              <Row label="Face uploads" value={fmtLimit(p.uploadLimit, " / mo")} dark={dark} />
              <Row label="Face searches" value={fmtLimit(p.searchLimit, " / mo")} dark={dark} />
              <Row label="Storage" value={fmtBytes(p.storageBytes)} dark={dark} />
              <Row label="Rate limit" value={`${p.rateLimit.toLocaleString()} req / min`} dark={dark} />
              {!compact && (
                <>
                  <Row label="Team members" value={fmtLimit(p.maxUsers)} dark={dark} />
                  <Row label="API keys" value="Unlimited" dark={dark} />
                  <Row label="Signed image URLs" value="Included" dark={dark} />
                  <Row label="Usage history" value="12 months" dark={dark} />
                </>
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function Row({
  label,
  value,
  dark,
}: {
  label: string;
  value: string;
  dark?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className={dark ? "text-white/70" : "text-muted"}>{label}</span>
      <span className="font-medium">{value}</span>
    </li>
  );
}
