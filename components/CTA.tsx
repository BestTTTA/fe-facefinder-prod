import { ButtonLink } from "./Button";

export function CTA() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-navy px-6 py-16 text-center text-white sm:px-12 sm:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-3xl bg-orange"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-3xl bg-white/10"
          />
          <h2 className="relative text-3xl font-semibold tracking-tight sm:text-5xl">
            Start matching faces today
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-white/75">
            The Free tier includes 100 uploads, 100 searches and 500 MB of
            storage every month. Upgrade when you are ready.
          </p>
          <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/login" size="lg">
              Get started free
            </ButtonLink>
            <ButtonLink
              href="/pricing"
              size="lg"
              className="border border-white/30 bg-transparent text-white hover:bg-white/10"
            >
              See pricing
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
