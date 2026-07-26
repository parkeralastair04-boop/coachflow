import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MarketingIntroBand() {
  return (
    <section
      id="product"
      className="scroll-mt-20 bg-[#030712] px-5 py-20 text-white sm:px-8 sm:py-28 lg:px-12"
      aria-labelledby="marketing-intro-heading"
    >
      <div className="mx-auto max-w-[90rem]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end lg:gap-20">
          <div>
            <p className="text-accent text-[11px] font-bold tracking-[0.35em] uppercase">
              Football intelligence
            </p>
            <h2
              id="marketing-intro-heading"
              className="mt-4 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl lg:text-6xl lg:leading-[1.05]"
            >
              Football intelligence that feels like your academy.
            </h2>
          </div>
          <div>
            <p className="text-lg leading-relaxed text-white/65">
              Every product screen below is captured from the real Awarix app.
              Explore the same flows in our{" "}
              <Link href="/demo" className="text-accent font-medium hover:underline">
                live demo
              </Link>{" "}
              — sample data, no signup required.
            </p>
            <Link
              href="/demo"
              className={cn(
                buttonVariants({ variant: "ghost", size: "lg" }),
                "mt-8 px-0 text-white hover:bg-transparent hover:text-accent",
              )}
            >
              Open live demo
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
