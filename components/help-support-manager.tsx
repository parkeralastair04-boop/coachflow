"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Bug,
  ChevronDown,
  ExternalLink,
  Lightbulb,
  LifeBuoy,
  Mail,
  MessageCircle,
} from "lucide-react";
import {
  FAQ_ITEMS,
  FEATURE_OVERVIEW_URL,
  SUPPORT_EMAIL,
  SUPPORT_WHATSAPP_URL,
  USER_GUIDE_URL,
  supportMailto,
} from "@/lib/help-support";
import { FeatureInfoTooltip } from "@/components/feature-info-tooltip";
import { cn } from "@/lib/utils";

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: typeof LifeBuoy;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-panel rounded-2xl p-6 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-8">
      <div className="flex items-start gap-3">
        <div className="bg-accent/10 ring-accent/20 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
          <Icon className="text-accent size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="text-muted mt-1 text-sm leading-relaxed">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-black/[0.06] last:border-0 dark:border-white/[0.08]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 py-4 text-left text-sm font-medium transition-colors hover:text-accent"
      >
        <span>{question}</span>
        <ChevronDown
          className={cn(
            "text-muted size-4 shrink-0 transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          open ? "max-h-48 pb-4 opacity-100" : "max-h-0 opacity-0",
        )}
        aria-hidden={!open}
      >
        <p className="text-muted text-sm leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

function DocLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 rounded-xl border border-black/[0.06] bg-black/[0.02] p-4 transition-colors hover:border-accent/30 hover:bg-accent/5 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-accent/10"
    >
      <BookOpen className="text-accent mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium">
          {title}
          <ExternalLink className="text-muted size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
        </p>
        <p className="text-muted mt-1 text-sm">{description}</p>
      </div>
    </a>
  );
}

export function HelpSupportManager() {
  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Help & Support
          </h1>
          <FeatureInfoTooltip featureKey="help-support" />
        </div>
        <p className="text-muted mt-1 max-w-2xl text-sm">
          Guides, answers, and direct contact with the CoachFlow team.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Contact Support"
          description="Typical response within 24 hours."
          icon={LifeBuoy}
        >
          <div className="space-y-4">
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="flex items-center gap-3 rounded-xl border border-black/[0.06] bg-black/[0.02] px-4 py-3 transition-colors hover:border-accent/30 hover:bg-accent/5 dark:border-white/[0.08] dark:bg-white/[0.03]"
            >
              <Mail className="text-accent size-5 shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="text-muted text-xs font-medium uppercase tracking-wide">
                  Email
                </p>
                <p className="mt-0.5 truncate font-medium">{SUPPORT_EMAIL}</p>
              </div>
            </a>

            <a
              href={SUPPORT_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-accent inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-medium text-white transition-opacity hover:opacity-90 sm:w-auto sm:px-6"
            >
              <MessageCircle className="size-4" aria-hidden />
              Message on WhatsApp
            </a>
          </div>
        </SectionCard>

        <SectionCard
          title="Documentation"
          description="Step-by-step guides and a full tour of CoachFlow features."
          icon={BookOpen}
        >
          <div className="space-y-3">
            <DocLink
              href={USER_GUIDE_URL}
              title="CoachFlow User Guide"
              description="Onboarding, daily workflows, and best practices for your academy."
            />
            <DocLink
              href={FEATURE_OVERVIEW_URL}
              title="Feature Overview"
              description="Explore bookings, CRM, reports, payments, camps, and more."
            />
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Frequently Asked Questions"
        description="Quick answers to common coaching operations questions."
        icon={MessageCircle}
      >
        <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
          {FAQ_ITEMS.map((item) => (
            <FaqItem key={item.question} question={item.question} answer={item.answer} />
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 sm:grid-cols-2">
        <SectionCard
          title="Report a Bug"
          description="Tell us what broke — include steps to reproduce if you can."
          icon={Bug}
        >
          <a
            href={supportMailto("Bug Report")}
            className="border-border inline-flex h-11 w-full items-center justify-center rounded-full border px-6 text-sm font-medium transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.06] sm:w-auto"
          >
            Email bug report
          </a>
        </SectionCard>

        <SectionCard
          title="Request a Feature"
          description="Share ideas that would help your coaching business run smoother."
          icon={Lightbulb}
        >
          <a
            href={supportMailto("Feature Request")}
            className="bg-foreground text-background inline-flex h-11 w-full items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity hover:opacity-90 sm:w-auto"
          >
            Send feature request
          </a>
        </SectionCard>
      </div>

      <p className="text-muted text-center text-xs">
        Need to change your plan?{" "}
        <Link href="/dashboard/billing" className="text-accent font-medium hover:underline">
          Open Billing
        </Link>{" "}
        or{" "}
        <Link href="/pricing" className="text-accent font-medium hover:underline">
          view pricing
        </Link>
        .
      </p>
    </div>
  );
}
