import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PricingGrid } from "@/components/Pricing";
import { CTA } from "@/components/CTA";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free, Basic, Pro and Enterprise packages for the FaceFinder face recognition API.",
};

const faqs = [
  {
    q: "What counts as an upload or a search?",
    a: "One successful POST /faces call is one upload; one POST /faces/search is one search. Rejected images (no face, multiple faces, invalid file) do not consume quota.",
  },
  {
    q: "When does my quota reset?",
    a: "Uploads and searches reset at the start of each calendar month. Storage carries over — deleting faces frees it up.",
  },
  {
    q: "What happens if I exceed a limit?",
    a: "You get a 429 with UPLOAD_LIMIT_EXCEEDED, SEARCH_LIMIT_EXCEEDED or STORAGE_LIMIT_EXCEEDED. Upgrade your package from the dashboard to continue immediately.",
  },
  {
    q: "Can I change packages mid-month?",
    a: "Yes. Limits apply to the current period as soon as the package changes.",
  },
  {
    q: "Is my data isolated from other customers?",
    a: "Every person, face, image and log is scoped to your tenant and search never crosses tenants.",
  },
];

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pb-6 pt-20 sm:px-6">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-orange">
              Pricing
            </p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Pay for what you match
            </h1>
            <p className="mt-4 text-lg text-muted">
              Every package includes the full API — register, search, persons,
              API keys and usage. Only the limits change.
            </p>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <PricingGrid />
        </section>
        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Questions</h2>
          <dl className="mt-6 divide-y divide-line">
            {faqs.map((f) => (
              <div key={f.q} className="py-5">
                <dt className="font-medium">{f.q}</dt>
                <dd className="mt-1.5 text-sm text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
        <CTA />
      </main>
      <Footer />
    </>
  );
}
