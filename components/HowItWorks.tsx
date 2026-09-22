import { Section } from "./Section";

const steps = [
  {
    n: "01",
    title: "Sign in & create a key",
    body: "Google sign-in provisions your tenant with a Free package. Create an fr_live_ key scoped to faces:upload and faces:search.",
    code: `POST /api/v1/me/api-keys
{ "name": "prod", "scopes": ["faces:upload", "faces:search"] }`,
  },
  {
    n: "02",
    title: "Register people",
    body: "One photo per call. Attach an external_user_id and any metadata your app needs back on match.",
    code: `POST /api/v1/faces
-F image=@john.jpg -F external_user_id=EMP-001
-F name="John Doe" -F metadata='{"position":"Engineer"}'`,
  },
  {
    n: "03",
    title: "Search",
    body: "Send a query image and get the person plus confidence back. Every request is quota-checked atomically and logged.",
    code: `POST /api/v1/faces/search
-F image=@query.jpg
→ { "match": true, "confidence": 0.99, "person": { … } }`,
  },
];

export function HowItWorks() {
  return (
    <Section
      id="how"
      eyebrow="How it works"
      title="From zero to a working match in three calls"
      className="bg-surface"
    >
      <ol className="grid gap-4 md:grid-cols-3">
        {steps.map((s) => (
          <li
            key={s.n}
            className="flex flex-col rounded-3xl border border-line bg-background p-6"
          >
            <span className="font-mono text-sm font-semibold text-orange">{s.n}</span>
            <h3 className="mt-3 text-xl font-semibold tracking-tight">{s.title}</h3>
            <p className="mt-2 text-sm text-muted">{s.body}</p>
            <pre className="mt-5 overflow-x-auto rounded-2xl bg-navy p-4 font-mono text-[12px] leading-relaxed text-white/85">
              {s.code}
            </pre>
          </li>
        ))}
      </ol>
    </Section>
  );
}
