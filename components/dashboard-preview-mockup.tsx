import Image from "next/image";
import {
  BarChart3,
  Brain,
  CalendarClock,
  CreditCard,
  FileText,
  LayoutDashboard,
  PoundSterling,
  Sparkles,
  TrendingUp,
  UserSquare2,
  Users,
} from "lucide-react";
import { BRAND_LOGO_SRC } from "@/lib/brand";
import { cn } from "@/lib/utils";

const KPI_STATS = [
  { label: "Total Players", value: "128", hint: "+12 this month", icon: Users },
  { label: "Monthly Revenue", value: "£4,820", hint: "MRR · +8%", icon: PoundSterling },
  { label: "Reports Generated", value: "47", hint: "12 sent this week", icon: FileText },
  {
    label: "Active Subscriptions",
    value: "36",
    hint: "2 renewals due",
    icon: CreditCard,
  },
] as const;

const REVENUE_BARS = [
  { label: "Jan", value: 62 },
  { label: "Feb", value: 48 },
  { label: "Mar", value: 71 },
  { label: "Apr", value: 55 },
  { label: "May", value: 84 },
  { label: "Jun", value: 92 },
] as const;

const ACTIVITY = [
  { time: "2m ago", text: "New booking — U10 trial session", tone: "accent" },
  { time: "18m ago", text: "AI report sent to James Carter", tone: "default" },
  { time: "1h ago", text: "Parent payment received · £89", tone: "accent" },
  { time: "3h ago", text: "Referral converted to Pro plan", tone: "default" },
] as const;

const SESSIONS = [
  { title: "U12 Development — Skills", when: "Today · 17:30 · Pitch A" },
  { title: "1:1 Goalkeeper block", when: "Tomorrow · 18:15 · Annex" },
  { title: "U9 Mini kickers", when: "Wed · 09:00 · Dome" },
] as const;

const SIDEBAR_ICONS = [
  LayoutDashboard,
  BarChart3,
  Brain,
  UserSquare2,
  CalendarClock,
  FileText,
] as const;

function delayClass(index: number) {
  return { animationDelay: `${120 + index * 70}ms` };
}

function MockKpiCard({
  label,
  value,
  hint,
  icon: Icon,
  index,
}: (typeof KPI_STATS)[number] & { index: number }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-black/[0.06] bg-white/80 p-3 shadow-[0_1px_0_rgba(255,255,255,0.5)_inset] dark:border-white/[0.08] dark:bg-white/[0.04] sm:p-3.5",
        "animate-preview-fade-up",
      )}
      style={delayClass(index)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-muted truncate text-[10px] font-medium sm:text-xs">{label}</p>
          <p className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">{value}</p>
          <p className="text-muted mt-0.5 truncate text-[10px]">{hint}</p>
        </div>
        <div className="bg-accent/10 ring-accent/20 flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 sm:size-9">
          <Icon className="text-accent size-3.5 sm:size-4" aria-hidden />
        </div>
      </div>
    </div>
  );
}

export function DashboardPreviewMockup() {
  const maxBar = Math.max(...REVENUE_BARS.map((bar) => bar.value));

  return (
    <div
      className="animate-preview-fade-up mt-16"
      style={{ animationDelay: "80ms" }}
      aria-hidden
    >
      <div className="animate-preview-glow overflow-hidden rounded-2xl border border-black/[0.08] bg-[#0F172A] shadow-[0_24px_80px_-12px_rgba(15,23,42,0.45),0_0_0_1px_rgba(16,185,129,0.12)] dark:border-white/[0.1]">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-red-400/80" />
            <span className="size-2.5 rounded-full bg-amber-400/80" />
            <span className="size-2.5 rounded-full bg-emerald-400/80" />
          </div>
          <div className="mx-auto hidden max-w-xs flex-1 rounded-md bg-white/[0.06] px-3 py-1 text-center text-[10px] text-white/50 sm:block">
            app.coachflow.website/dashboard
          </div>
        </div>

        <div className="flex min-h-[420px] sm:min-h-[480px]">
          {/* Sidebar */}
          <aside className="hidden w-[52px] shrink-0 flex-col border-r border-white/[0.08] bg-[#0B1220] sm:flex lg:w-14">
            <div className="flex h-14 items-center justify-center border-b border-white/[0.06] lg:h-16">
              <Image
                src={BRAND_LOGO_SRC}
                alt=""
                width={80}
                height={54}
                className="h-7 w-auto object-contain opacity-95"
              />
            </div>
            <nav className="flex flex-1 flex-col gap-1 p-2">
              {SIDEBAR_ICONS.map((Icon, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg",
                    index === 0
                      ? "bg-accent/20 text-accent"
                      : "text-white/40",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </div>
              ))}
            </nav>
          </aside>

          {/* Main dashboard */}
          <div className="flex min-w-0 flex-1 flex-col bg-[#0F172A]/95 p-3 sm:p-4 lg:p-5">
            <div
              className="animate-preview-fade-up mb-3 sm:mb-4"
              style={{ animationDelay: "160ms" }}
            >
              <p className="text-[10px] font-medium tracking-wide text-emerald-400/90 uppercase sm:text-xs">
                Dashboard
              </p>
              <h3 className="mt-0.5 text-sm font-semibold text-white sm:text-base">
                Good afternoon, Coach
              </h3>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
              {KPI_STATS.map((stat, index) => (
                <MockKpiCard key={stat.label} {...stat} index={index} />
              ))}
            </div>

            <div className="mt-3 grid min-h-0 flex-1 gap-2 sm:mt-4 sm:gap-3 lg:grid-cols-5">
              {/* Revenue chart */}
              <div
                className={cn(
                  "rounded-xl border border-white/[0.08] bg-white/[0.04] p-3 sm:p-4 lg:col-span-3",
                  "animate-preview-fade-up",
                )}
                style={{ animationDelay: "420ms" }}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-white">Revenue over time</p>
                    <p className="text-[10px] text-white/45">Last 6 months</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                    <TrendingUp className="size-3" aria-hidden />
                    +18%
                  </div>
                </div>
                <div className="flex h-28 items-end gap-1.5 sm:h-32 sm:gap-2">
                  {REVENUE_BARS.map((bar, index) => (
                    <div
                      key={bar.label}
                      className="flex h-full flex-1 flex-col justify-end gap-1"
                    >
                      <div
                        className="flex flex-1 items-end rounded-md bg-white/[0.04] p-0.5"
                        title={`£${bar.value * 50}`}
                      >
                        <div
                          className="animate-preview-bar w-full rounded-md bg-gradient-to-t from-emerald-600 to-emerald-400"
                          style={{
                            height: `${(bar.value / maxBar) * 100}%`,
                            animationDelay: `${520 + index * 60}ms`,
                          }}
                        />
                      </div>
                      <span className="text-center text-[9px] text-white/40 sm:text-[10px]">
                        {bar.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Insights */}
              <div
                className={cn(
                  "rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent p-3 sm:p-4 lg:col-span-2",
                  "animate-preview-fade-up",
                )}
                style={{ animationDelay: "500ms" }}
              >
                <div className="flex items-start gap-2">
                  <div className="bg-accent/20 ring-accent/30 flex size-8 shrink-0 items-center justify-center rounded-lg ring-1">
                    <Brain className="text-accent size-4" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white">AI Insights</p>
                    <p className="text-[10px] text-emerald-300/80">High priority</p>
                  </div>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-white/75 sm:text-xs">
                  <span className="font-medium text-white">Camp occupancy is low</span> — May
                  half-term block is at 42%. Promote to recent triallists before Friday.
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-emerald-400">
                  <Sparkles className="size-3" aria-hidden />
                  Recommended action ready
                </div>
              </div>

              {/* Recent activity */}
              <div
                className={cn(
                  "rounded-xl border border-white/[0.08] bg-white/[0.04] p-3 sm:p-4 lg:col-span-3",
                  "animate-preview-fade-up",
                )}
                style={{ animationDelay: "580ms" }}
              >
                <p className="text-xs font-semibold text-white">Recent activity</p>
                <ul className="mt-2.5 space-y-2">
                  {ACTIVITY.map((item) => (
                    <li
                      key={item.text}
                      className="flex items-start gap-2 border-b border-white/[0.06] pb-2 last:border-0 last:pb-0"
                    >
                      <span
                        className={cn(
                          "mt-1 size-1.5 shrink-0 rounded-full",
                          item.tone === "accent" ? "bg-emerald-400" : "bg-white/30",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] text-white/85 sm:text-xs">
                          {item.text}
                        </p>
                        <p className="text-[10px] text-white/40">{item.time}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Upcoming sessions */}
              <div
                className={cn(
                  "rounded-xl border border-white/[0.08] bg-white/[0.04] p-3 sm:p-4 lg:col-span-2",
                  "animate-preview-fade-up",
                )}
                style={{ animationDelay: "640ms" }}
              >
                <div className="flex items-center gap-2">
                  <CalendarClock className="text-accent size-4 shrink-0" aria-hidden />
                  <p className="text-xs font-semibold text-white">Upcoming sessions</p>
                </div>
                <ul className="mt-2.5 space-y-2">
                  {SESSIONS.map((session) => (
                    <li
                      key={session.title}
                      className="rounded-lg bg-white/[0.04] px-2.5 py-2 ring-1 ring-white/[0.06]"
                    >
                      <p className="truncate text-[11px] font-medium text-white sm:text-xs">
                        {session.title}
                      </p>
                      <p className="text-[10px] text-white/45">{session.when}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
