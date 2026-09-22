import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Services } from "@/components/Services";
import { HowItWorks } from "@/components/HowItWorks";
import { PricingGrid } from "@/components/Pricing";
import { Trust } from "@/components/Trust";
import { CTA } from "@/components/CTA";
import { Section } from "@/components/Section";
import { ButtonLink } from "@/components/Button";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Services />
        <HowItWorks />
        <Section
          id="pricing"
          eyebrow="Pricing"
          title="Simple monthly packages"
          subtitle="Start free, scale to Pro, or talk to us for custom limits. Prices in USD, billed monthly."
        >
          <PricingGrid compact />
          <div className="mt-8 text-center">
            <ButtonLink href="/pricing" variant="ghost">
              Compare all features →
            </ButtonLink>
          </div>
        </Section>
        <Trust />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
