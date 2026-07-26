"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { MARKETING_FAQ } from "@/lib/marketing-homepage";
import { cn } from "@/lib/utils";

export function MarketingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="scroll-mt-20 border-border border-t bg-background px-5 py-20 sm:px-8 sm:py-28 lg:px-12"
      aria-labelledby="faq-heading"
    >
      <div className="mx-auto grid max-w-[90rem] gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-accent text-[11px] font-bold tracking-[0.35em] uppercase">
            FAQ
          </p>
          <h2
            id="faq-heading"
            className="mt-4 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl"
          >
            Questions coaches ask first.
          </h2>
          <p className="text-muted mt-4 max-w-md text-base leading-relaxed sm:text-lg">
            Straight answers — no feature exaggeration. Open the live demo if you
            want to see it yourself.
          </p>
        </div>

        <ul className="divide-border divide-y border-y border-border">
          {MARKETING_FAQ.map((item, index) => {
            const open = openIndex === index;
            return (
              <li key={item.question}>
                <button
                  type="button"
                  id={`faq-q-${index}`}
                  aria-expanded={open}
                  aria-controls={`faq-a-${index}`}
                  onClick={() => setOpenIndex(open ? null : index)}
                  className="flex w-full items-start justify-between gap-4 py-6 text-left transition-colors hover:text-accent sm:py-7"
                >
                  <span className="text-base font-semibold tracking-tight sm:text-lg">
                    {item.question}
                  </span>
                  <ChevronDown
                    className={cn(
                      "text-muted mt-1 size-5 shrink-0 transition-transform duration-200",
                      open && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
                <div
                  id={`faq-a-${index}`}
                  role="region"
                  aria-labelledby={`faq-q-${index}`}
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                    open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="text-muted pb-6 pr-8 text-sm leading-relaxed sm:pb-7 sm:text-base">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
