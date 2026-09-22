import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SERVICES } from "@/lib/services";

export const metadata: Metadata = {
  title: "API Reference",
  description: "Quick reference for the FaceFinder face recognition API v1.",
};

const errors: [string, string, string][] = [
  ["400", "INVALID_IMAGE", "File is not a decodable image or exceeds the size limit."],
  ["401", "UNAUTHORIZED", "Missing or invalid token / API key."],
  ["403", "FORBIDDEN", "Key lacks the required scope, or the subscription is not active."],
  ["404", "NOT_FOUND", "Person or face does not exist in your tenant."],
  ["409", "DUPLICATE_IMAGE", "Identical image already registered."],
  ["422", "NO_FACE_DETECTED", "No face found in the image."],
  ["422", "MULTIPLE_FACES_DETECTED", "More than one face — crop to a single face."],
  ["429", "RATE_LIMITED", "Per-minute rate limit hit. See X-RateLimit-* headers."],
  ["429", "UPLOAD_LIMIT_EXCEEDED", "Monthly upload quota reached."],
  ["429", "SEARCH_LIMIT_EXCEEDED", "Monthly search quota reached."],
  ["429", "STORAGE_LIMIT_EXCEEDED", "Storage quota reached — delete faces or upgrade."],
];

const examples: Record<string, string> = {
  register: `curl -X POST $API/api/v1/faces \\
  -H "X-API-Key: fr_live_..." \\
  -H "Idempotency-Key: 7d1f-..." \\
  -F image=@john.jpg \\
  -F external_user_id=EMP-001 \\
  -F name="John Doe" \\
  -F company="Example" \\
  -F metadata='{"position":"Engineer"}'`,
  search: `curl -X POST $API/api/v1/faces/search \\
  -H "X-API-Key: fr_live_..." \\
  -F image=@query.jpg

# → data.match, data.confidence, data.similarity,
#   data.person, data.candidates[], data.processing_time_ms`,
  persons: `# list / search persons
curl "$API/api/v1/persons?q=john&limit=50" -H "X-API-Key: fr_live_..."

# faces of a person — with_urls=true adds signed image_url + thumbnail_url
curl "$API/api/v1/faces?person_id=<uuid>&with_urls=true" -H "X-API-Key: fr_live_..."

# update / delete
curl -X PATCH  $API/api/v1/persons/<uuid> -d '{"name":"Jane"}'
curl -X DELETE $API/api/v1/faces/<face_id>`,
  keys: `# requires a user session (Supabase JWT)
curl -X POST $API/api/v1/me/api-keys \\
  -H "Authorization: Bearer <access_token>" \\
  -d '{"name":"prod","scopes":["faces:upload","faces:search"],"expires_at":null}'

# → data.api_key is shown ONCE
curl -X POST   $API/api/v1/me/api-keys/<id>/rotate
curl -X DELETE $API/api/v1/me/api-keys/<id>`,
  usage: `curl $API/api/v1/me/quota   -H "Authorization: Bearer <token>"
# → { "uploads": {"used","limit","remaining"}, "searches": {...}, "storage": {...} }

curl $API/api/v1/me/usage/history?limit=12
curl $API/api/v1/me/package
curl $API/api/v1/packages`,
};

export default function DocsPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto flex w-full max-w-6xl flex-1 gap-12 px-4 py-16 sm:px-6">
        <aside className="hidden w-52 shrink-0 lg:block">
          <nav className="sticky top-24 space-y-1 text-sm">
            <a href="#auth" className="block rounded-lg px-3 py-1.5 text-muted hover:bg-black/5 hover:text-foreground">Authentication</a>
            <a href="#envelope" className="block rounded-lg px-3 py-1.5 text-muted hover:bg-black/5 hover:text-foreground">Response envelope</a>
            {SERVICES.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="block rounded-lg px-3 py-1.5 text-muted hover:bg-black/5 hover:text-foreground">
                {s.name}
              </a>
            ))}
            <a href="#errors" className="block rounded-lg px-3 py-1.5 text-muted hover:bg-black/5 hover:text-foreground">Error codes</a>
          </nav>
        </aside>

        <article className="min-w-0 flex-1 space-y-16">
          <header>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-orange">API reference</p>
            <h1 className="text-4xl font-semibold tracking-tight">FaceFinder API v1</h1>
            <p className="mt-3 text-muted">
              Base URL <code className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-sm">https://api.your-domain.com</code>.
              Interactive Swagger UI is served at <code className="font-mono text-sm">/api/docs</code>.
            </p>
          </header>

          <Doc id="auth" title="Authentication">
            <p>
              Integrations authenticate with an API key sent as{" "}
              <code>X-API-Key: fr_live_…</code> (or <code>Authorization: Bearer fr_live_…</code>).
              Keys are scoped to <code>faces:upload</code>, <code>faces:search</code>,{" "}
              <code>faces:read</code> and <code>persons:read</code>.
            </p>
            <p>
              Account-level endpoints under <code>/api/v1/me</code> (profile, API keys, usage) require a
              user session token obtained through Google sign-in.
            </p>
          </Doc>

          <Doc id="envelope" title="Response envelope">
            <Code>{`// success
{ "success": true, "data": { ... }, "meta": { "request_id": "..." } }

// error
{ "success": false, "error": { "code": "NO_FACE_DETECTED", "message": "...", "details": null } }`}</Code>
            <p>
              Every response also carries <code>X-Request-Id</code> and, on authenticated routes,{" "}
              <code>X-RateLimit-Limit</code> / <code>X-RateLimit-Remaining</code> / <code>X-RateLimit-Reset</code>.
            </p>
          </Doc>

          {SERVICES.map((s) => (
            <Doc key={s.id} id={s.id} title={s.name} method={s.method} path={s.path}>
              <p>{s.description}</p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {s.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <Code>{examples[s.id]}</Code>
              <p className="text-sm text-muted">
                Required scope: <code>{s.scope}</code>
              </p>
            </Doc>
          ))}

          <Doc id="errors" title="Error codes">
            <div className="overflow-x-auto rounded-2xl border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-black/[0.03] text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Code</th>
                    <th className="px-4 py-2.5">Meaning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {errors.map(([status, code, meaning]) => (
                    <tr key={code}>
                      <td className="px-4 py-2.5 font-mono">{status}</td>
                      <td className="px-4 py-2.5 font-mono text-orange">{code}</td>
                      <td className="px-4 py-2.5 text-muted">{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Doc>
        </article>
      </main>
      <Footer />
    </>
  );
}

function Doc({
  id,
  title,
  method,
  path,
  children,
}: {
  id: string;
  title: string;
  method?: string;
  path?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4 [&_code]:rounded [&_code]:bg-black/5 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_p]:text-[15px] [&_p]:leading-relaxed">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {method && (
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="rounded-md bg-navy px-1.5 py-0.5 font-semibold text-white">{method}</span>
          <span className="text-muted">{path}</span>
        </div>
      )}
      {children}
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl bg-navy p-4 font-mono text-[12.5px] leading-relaxed text-white/85">
      {children}
    </pre>
  );
}
