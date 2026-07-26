import { MARKETING_TESTIMONIALS } from "@/lib/marketing-homepage";

export function MarketingTestimonials() {
  return (
    <section
      id="testimonials"
      className="scroll-mt-20 bg-[#030712] px-5 py-20 text-white sm:px-8 sm:py-28 lg:px-12"
      aria-labelledby="testimonials-heading"
    >
      <div className="mx-auto max-w-[90rem]">
        <div className="max-w-2xl">
          <p className="text-accent text-[11px] font-bold tracking-[0.35em] uppercase">
            Coaches on Awarix
          </p>
          <h2
            id="testimonials-heading"
            className="mt-4 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl"
          >
            Built with academies, not around them.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/60 sm:text-lg">
            Representative feedback from coaches in our beta programme and demo
            academy — real workflows, not marketing filler.
          </p>
        </div>

        <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {MARKETING_TESTIMONIALS.map((item) => (
            <li
              key={item.name}
              className="relative flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 sm:p-9"
            >
              <div className="bg-accent absolute left-8 top-0 h-1 w-12 -translate-y-px sm:left-9" aria-hidden />
              <blockquote className="flex flex-1 flex-col">
                <p className="text-base leading-relaxed text-white/85 sm:text-lg">
                  &ldquo;{item.quote}&rdquo;
                </p>
                <footer className="mt-8 border-t border-white/[0.08] pt-6">
                  <cite className="not-italic">
                    <p className="font-semibold text-white">{item.name}</p>
                    <p className="mt-1 text-sm text-white/50">
                      {item.role} · {item.academy}
                    </p>
                  </cite>
                </footer>
              </blockquote>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
