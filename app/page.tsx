import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { MarketingHero } from "@/components/marketing/marketing-hero";
import { MarketingPillars } from "@/components/marketing/marketing-pillars";
import { MarketingWorkflowStrip } from "@/components/marketing/marketing-workflow-strip";
import { MarketingProductBento } from "@/components/marketing/marketing-product-bento";
import { MarketingTestimonials } from "@/components/marketing/marketing-testimonials";
import { MarketingPricingPreview } from "@/components/marketing/marketing-pricing-preview";
import { MarketingFaq } from "@/components/marketing/marketing-faq";
import { MarketingFinalCta } from "@/components/marketing/marketing-final-cta";
import { MARKETING_FEATURES } from "@/lib/marketing-homepage";

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <MarketingHero />
        <MarketingPillars />
        <MarketingWorkflowStrip />
        <MarketingProductBento features={MARKETING_FEATURES} />
        <MarketingTestimonials />
        <MarketingPricingPreview />
        <MarketingFaq />
        <MarketingFinalCta />
      </main>
      <Footer />
    </div>
  );
}
