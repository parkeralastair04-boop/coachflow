"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Bug,
  ChevronDown,
  ExternalLink,
  Lightbulb,
  LifeBuoy,
  Loader2,
  Mail,
  MessageCircle,
  Rocket,
  Send,
} from "lucide-react";
import {
  BUG_PAGE_FEATURES,
  BUG_PRIORITIES,
  FEATURE_OVERVIEW_URL,
  QUICK_START_STEPS,
  SUPPORT_EMAIL,
  SUPPORT_WHATSAPP_URL,
  USER_GUIDE_ARTICLES,
  getBugPriorityLabel,
  type BugPageFeature,
  type BugPriority,
  type UserGuideArticle,
} from "@/lib/help-support";
import { dispatchResumeOnboarding } from "@/components/onboarding-host";
import { FeatureInfoTooltip } from "@/components/feature-info-tooltip";
import { cn } from "@/lib/utils";

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

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

function GuideArticle({ article }: { article: UserGuideArticle }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-border rounded-xl border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
      >
        <div className="min-w-0">
          <p className="font-medium">{article.title}</p>
          <p className="text-muted mt-1 text-sm">{article.summary}</p>
        </div>
        <ChevronDown
          className={cn(
            "text-muted mt-1 size-4 shrink-0 transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          open ? "max-h-[28rem] opacity-100" : "max-h-0 opacity-0",
        )}
        aria-hidden={!open}
      >
        <div className="border-border border-t px-4 pb-4 pt-3">
          <ol className="text-muted list-decimal space-y-2 pl-4 text-sm leading-relaxed">
            {article.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <Link
            href={article.href}
            className="text-accent mt-4 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
          >
            Open {article.title}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}

function BugReportForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pageFeature, setPageFeature] = useState<BugPageFeature>("Other");
  const [priority, setPriority] = useState<BugPriority>("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/support/bug-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, pageFeature, priority }),
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        setupRequired?: boolean;
      };

      if (!response.ok) {
        setError(
          payload.setupRequired
            ? (payload.message ?? "Support tables are not set up yet.")
            : (payload.error ?? "Could not submit bug report."),
        );
        return;
      }

      setSuccess(true);
      setTitle("");
      setDescription("");
      setPageFeature("Other");
      setPriority("medium");
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
      <label className="block space-y-2">
        <span className="text-sm font-medium">Title</span>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Brief summary of the issue"
          required
          className="border-border bg-background h-11 w-full rounded-xl border px-3 text-sm"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium">Description</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What happened? Include steps to reproduce if possible."
          required
          rows={4}
          className="border-border bg-background w-full resize-y rounded-xl border px-3 py-2.5 text-sm"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium">Page / feature</span>
          <select
            value={pageFeature}
            onChange={(event) => setPageFeature(event.target.value as BugPageFeature)}
            className="border-border bg-background h-11 w-full rounded-xl border px-3 text-sm"
          >
            {BUG_PAGE_FEATURES.map((feature) => (
              <option key={feature} value={feature}>
                {feature}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium">Priority</span>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as BugPriority)}
            className="border-border bg-background h-11 w-full rounded-xl border px-3 text-sm"
          >
            {BUG_PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {getBugPriorityLabel(value)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {success ? (
        <p className="text-accent text-sm font-medium">
          Thank you — your bug report has been submitted. We will review it shortly.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="bg-foreground text-background hover:opacity-90 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            Submitting...
          </>
        ) : (
          <>
            <Send className="mr-2 size-4" aria-hidden />
            Submit bug report
          </>
        )}
      </button>
    </form>
  );
}

function FeatureRequestForm() {
  const [featureName, setFeatureName] = useState("");
  const [description, setDescription] = useState("");
  const [benefit, setBenefit] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/support/feature-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureName, description, benefit }),
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        setupRequired?: boolean;
      };

      if (!response.ok) {
        setError(
          payload.setupRequired
            ? (payload.message ?? "Support tables are not set up yet.")
            : (payload.error ?? "Could not submit feature request."),
        );
        return;
      }

      setSuccess(true);
      setFeatureName("");
      setDescription("");
      setBenefit("");
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
      <label className="block space-y-2">
        <span className="text-sm font-medium">Feature name</span>
        <input
          type="text"
          value={featureName}
          onChange={(event) => setFeatureName(event.target.value)}
          placeholder="e.g. Bulk SMS reminders"
          required
          className="border-border bg-background h-11 w-full rounded-xl border px-3 text-sm"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium">Description</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe the feature and how it would work."
          required
          rows={4}
          className="border-border bg-background w-full resize-y rounded-xl border px-3 py-2.5 text-sm"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium">Benefit</span>
        <textarea
          value={benefit}
          onChange={(event) => setBenefit(event.target.value)}
          placeholder="How would this help your coaching business or parents?"
          required
          rows={3}
          className="border-border bg-background w-full resize-y rounded-xl border px-3 py-2.5 text-sm"
        />
      </label>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {success ? (
        <p className="text-accent text-sm font-medium">
          Thank you — your feature request has been submitted for review.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="bg-foreground text-background hover:opacity-90 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            Submitting...
          </>
        ) : (
          <>
            <Send className="mr-2 size-4" aria-hidden />
            Submit feature request
          </>
        )}
      </button>
    </form>
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

      <SectionCard
        title="Getting Started"
        description="New to CoachFlow? Start here."
        icon={Rocket}
      >
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/dashboard#getting-started"
              className="bg-accent hover:opacity-90 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium text-white transition-opacity"
            >
              View onboarding checklist
              <ArrowRight className="ml-2 size-4" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={() => dispatchResumeOnboarding(1)}
              className="border-border hover:bg-surface-hover inline-flex h-11 items-center justify-center rounded-full border px-6 text-sm font-medium transition-colors"
            >
              Launch setup wizard
            </button>
          </div>

          <div>
            <h3 className="text-sm font-semibold tracking-tight">Quick start guide</h3>
            <ol className="mt-4 space-y-4">
              {QUICK_START_STEPS.map((item) => (
                <li key={item.step} className="flex gap-4">
                  <span className="bg-accent/12 text-accent flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                    {item.step}
                  </span>
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-muted mt-1 text-sm leading-relaxed">{item.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="User Guide"
        description="Step-by-step help for every major CoachFlow feature."
        icon={BookOpen}
      >
        <div className="space-y-3">
          {USER_GUIDE_ARTICLES.map((article) => (
            <GuideArticle key={article.id} article={article} />
          ))}
        </div>
        <a
          href={FEATURE_OVERVIEW_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted hover:text-foreground mt-6 inline-flex items-center gap-2 text-sm transition-colors"
        >
          View marketing feature overview
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </SectionCard>

      <SectionCard
        title="Contact Support"
        description="Typical response within 24 hours on business days."
        icon={LifeBuoy}
      >
        <div className="space-y-4">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="border-border bg-background/60 flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors hover:border-accent/30 hover:bg-accent/5"
          >
            <Mail className="text-accent size-5 shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-muted text-xs font-medium tracking-wide uppercase">Email</p>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Report a Bug"
          description="Something not working? Tell us what you expected to happen."
          icon={Bug}
        >
          <BugReportForm />
        </SectionCard>

        <SectionCard
          title="Feature Request"
          description="Share ideas that would help your coaching business run smoother."
          icon={Lightbulb}
        >
          <FeatureRequestForm />
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
