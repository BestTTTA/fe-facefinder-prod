import { ButtonLink } from "./Button";

const stats = [
  { value: "~400 ms", label: "search latency" },
  { value: "512-d", label: "ArcFace embeddings" },
  { value: "99.6%", label: "confidence on match" },
  { value: "0", label: "cross-tenant leaks" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* brand blocks in the background, echoing the logo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-10 hidden h-72 w-72 rotate-6 rounded-[2.5rem] bg-navy/[0.06] lg:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 top-72 hidden h-56 w-56 -rotate-6 rounded-[2.5rem] bg-orange/10 lg:block"
      />

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-20 sm:px-6 sm:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-orange" />
            Face Recognition API · v1
          </span>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            Register a face.
            <br />
            Find the person{" "}
            <span className="text-orange">instantly.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted sm:text-xl">
            One API to enroll people from a photo and search any face against
            your private index — with scoped API keys, monthly quotas and
            audit logs built in.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/login" size="lg">
              Try free — 100 searches / month
            </ButtonLink>
            <ButtonLink href="/docs" variant="outline" size="lg">
              Read the docs
            </ButtonLink>
          </div>
          <p className="mt-4 text-xs text-muted">
            No credit card. Sign in with Google and get an API key in 30 seconds.
          </p>
        </div>

        <DemoCard />

        <dl className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-6 border-t border-line pt-10 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <dt className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {s.value}
              </dt>
              <dd className="mt-1 text-sm text-muted">{s.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function DemoCard() {
  return (
    <div className="mx-auto mt-14 max-w-4xl overflow-hidden rounded-3xl border border-line bg-navy text-white shadow-2xl shadow-navy/20">
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3 text-xs text-white/60">
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-orange" />
        <span className="ml-3 font-mono">POST /api/v1/faces/search</span>
      </div>
      <div className="grid gap-0 md:grid-cols-2">
        <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-white/85">
{`curl -X POST $API/api/v1/faces/search \
  -H "X-API-Key: fr_live_…" \
  -F image=@query.jpg`}
        </pre>
        <pre className="overflow-x-auto border-t border-white/10 bg-black/20 p-5 font-mono text-[13px] leading-relaxed text-white/85 md:border-l md:border-t-0">
{`{
  "success": true,
  "data": {
    "match": true,
    "confidence": `}<span className="text-orange">0.9968</span>{`,
    "similarity": 0.9277,
    "person": {
      "external_user_id": "EMP-001",
      "name": "John Doe",
      "metadata": { "position": "Engineer" }
    },
    "processing_time_ms": 383
  }
}`}
        </pre>
      </div>
    </div>
  );
}
