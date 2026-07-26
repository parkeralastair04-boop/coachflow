import {
  BarChart3,
  Brain,
  CalendarClock,
  ClipboardList,
  FileText,
  Globe2,
  LayoutDashboard,
  PoundSterling,
  Shield,
  Sparkles,
  TrendingUp,
  UserSquare2,
  Users,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";

const KPI_STATS = [
  { label: "Players", value: "128", hint: "+12 this month", icon: Users },
  { label: "Attendance", value: "94%", hint: "This week", icon: ClipboardList },
  { label: "AI reports", value: "47", hint: "12 sent", icon: FileText },
  { label: "Finance", value: "£4,820", hint: "MRR · +8%", icon: PoundSterling },
] as const;

const TEAMS = [
  { name: "U12 Development", count: "18 players", color: "bg-emerald-400" },
  { name: "U10 Skills", count: "14 players", color: "bg-sky-400" },
  { name: "Goalkeeper Unit", count: "6 players", color: "bg-amber-400" },
] as const;

const SESSIONS = [
  { title: "U12 Development — Skills", when: "Today · 17:30" },
  { title: "1:1 Goalkeeper block", when: "Tomorrow · 18:15" },
  { title: "U9 Mini kickers", when: "Wed · 09:00" },
] as const;

const WEBSITE_LINKS = [
  "Home",
  "Teams",
  "Fixtures",
  "News",
  "Book",
] as const;

const SIDEBAR_ICONS = [
  LayoutDashboard,
  UserSquare2,
  Shield,
  CalendarClock,
  FileText,
  BarChart3,
  Globe2,
] as const;

function delayClass(index: number) {
  return { animationDelay: `${100 + index * 60}ms` };
}

/**
 * High-fidelity dashboard preview for the marketing hero.
 * Pure CSS/HTML mock — no screenshot asset required; retina-sharp at any DPR.
 */
export function DashboardPreviewMockup() {
  return (
    <div
      className="motion-fade-in mt-12 sm:mt-16 lg:mt-20"
      style={{ animationDelay: "60ms" }}
      aria-hidden
    >
      <div
        className={cn(
          "mx-auto max-w-5xl",
          "[perspective:1800px]",
        )}
      >
        <div
          className={cn(
            "animate-preview-glow origin-bottom",
            "overflow-hidden rounded-2xl sm:rounded-3xl",
            "border border-black/[0.08] bg-[#0F172A]",
            "shadow-[0_40px_100px_-20px_rgba(15,23,42,0.55),0_20px_40px_-24px_rgba(16,185,129,0.25)]",
            "dark:border-white/[0.1]",
            "sm:[transform:rotateX(4deg)_rotateY(-2deg)_translateZ(0)]",
          )}
        >
          {/* Browser chrome */}
          <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-2.5 sm:px-5">
            <div className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-red-400/80" />
              <span className="size-2.5 rounded-full bg-amber-400/80" />
              <span className="size-2.5 rounded-full bg-emerald-400/80" />
            </div>
            <div className="mx-auto hidden max-w-sm flex-1 rounded-md bg-white/[0.06] px-3 py-1 text-center text-[10px] text-white/50 sm:block">
              app.awarix.co.uk/dashboard
            </div>
          </div>

          <div className="flex min-h-[460px] sm:min-h-[520px]">
            <aside className="hidden w-12 shrink-0 flex-col border-r border-white/[0.08] bg-[#0B1220] sm:flex lg:w-14">
              <div className="flex h-14 items-center justify-center border-b border-white/[0.06]">
                <BrandMark className="size-7 text-white" />
              </div>
              <nav className="flex flex-1 flex-col gap-1 p-2">
                {SIDEBAR_ICONS.map((Icon, index) => (
                  <div
                    key={Icon.displayName ?? index}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg lg:size-9",
                      index === 0 ? "bg-accent/20 text-accent" : "text-white/40",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </div>
                ))}
              </nav>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col bg-[#0F172A]/95 p-3 sm:p-4 lg:p-5">
              <div
                className="animate-preview-fade-up mb-3 flex flex-wrap items-end justify-between gap-2"
                style={{ animationDelay: "120ms" }}
              >
                <div>
                  <p className="text-[10px] font-medium tracking-wide text-emerald-400/90 uppercase">
                    Dashboard
                  </p>
                  <h3 className="mt-0.5 text-sm font-semibold text-white sm:text-base">
                    Riverside Academy
                  </h3>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {WEBSITE_LINKS.map((link) => (
                    <span
                      key={link}
                      className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] font-medium text-white/55 ring-1 ring-white/[0.08]"
                    >
                      {link}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
                {KPI_STATS.map((stat, index) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={stat.label}
                      className={cn(
                        "animate-preview-fade-up rounded-xl border border-white/[0.08] bg-white/[0.05] p-3",
                      )}
                      style={delayClass(index)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[10px] text-white/50">{stat.label}</p>
                          <p className="mt-1 text-lg font-semibold tracking-tight text-white">
                            {stat.value}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] text-white/40">{stat.hint}</p>
                        </div>
                        <div className="bg-accent/15 ring-accent/25 flex size-8 shrink-0 items-center justify-center rounded-lg ring-1">
                          <Icon className="text-accent size-3.5" aria-hidden />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 grid min-h-0 flex-1 gap-2 sm:mt-4 sm:gap-3 lg:grid-cols-6">
                <div
                  className="animate-preview-fade-up rounded-xl border border-white/[0.08] bg-white/[0.04] p-3 lg:col-span-2"
                  style={{ animationDelay: "360ms" }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Shield className="text-accent size-3.5" aria-hidden />
                    <p className="text-xs font-semibold text-white">Teams</p>
                  </div>
                  <ul className="space-y-2">
                    {TEAMS.map((team) => (
                      <li
                        key={team.name}
                        className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2 py-1.5 ring-1 ring-white/[0.06]"
                      >
                        <span className={cn("size-2 shrink-0 rounded-full", team.color)} />
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-medium text-white">
                            {team.name}
                          </p>
                          <p className="text-[10px] text-white/45">{team.count}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div
                  className="animate-preview-fade-up rounded-xl border border-white/[0.08] bg-white/[0.04] p-3 lg:col-span-2"
                  style={{ animationDelay: "420ms" }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <CalendarClock className="text-accent size-3.5" aria-hidden />
                    <p className="text-xs font-semibold text-white">Upcoming sessions</p>
                  </div>
                  <ul className="space-y-2">
                    {SESSIONS.map((session) => (
                      <li
                        key={session.title}
                        className="rounded-lg bg-white/[0.04] px-2.5 py-2 ring-1 ring-white/[0.06]"
                      >
                        <p className="truncate text-[11px] font-medium text-white">
                          {session.title}
                        </p>
                        <p className="text-[10px] text-white/45">{session.when}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                <div
                  className={cn(
                    "animate-preview-fade-up rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent p-3 lg:col-span-2",
                  )}
                  style={{ animationDelay: "480ms" }}
                >
                  <div className="flex items-start gap-2">
                    <div className="bg-accent/20 ring-accent/30 flex size-8 shrink-0 items-center justify-center rounded-lg ring-1">
                      <Brain className="text-accent size-4" aria-hidden />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">AI Progress Reports</p>
                      <p className="text-[10px] text-emerald-300/80">Ready to send</p>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-white/75">
                    <span className="font-medium text-white">James Carter</span> — strong
                    first touch and pressing. Parent PDF drafted.
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-emerald-400">
                    <Sparkles className="size-3" aria-hidden />
                    Edit &amp; send in one click
                  </div>
                </div>

                <div
                  className="animate-preview-fade-up rounded-xl border border-white/[0.08] bg-white/[0.04] p-3 lg:col-span-3"
                  style={{ animationDelay: "540ms" }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-white">Finance summary</p>
                      <p className="text-[10px] text-white/45">Income this month</p>
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                      <TrendingUp className="size-3" aria-hidden />
                      +18%
                    </div>
                  </div>
                  <div className="flex h-16 items-end gap-1.5 sm:h-20">
                    {[42, 55, 48, 70, 62, 88, 76].map((value, index) => (
                      <div
                        key={index}
                        className="animate-preview-bar flex-1 rounded-md bg-gradient-to-t from-emerald-700 to-emerald-400"
                        style={{
                          height: `${value}%`,
                          animationDelay: `${600 + index * 40}ms`,
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div
                  className="animate-preview-fade-up rounded-xl border border-white/[0.08] bg-white/[0.04] p-3 lg:col-span-3"
                  style={{ animationDelay: "600ms" }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Globe2 className="text-accent size-3.5" aria-hidden />
                    <p className="text-xs font-semibold text-white">Academy website</p>
                  </div>
                  <p className="text-[11px] leading-relaxed text-white/70">
                    Public site live — fixtures, camps, news, and parent booking linked
                    from one branded domain.
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    {["Fixtures", "Camps", "Contact"].map((item) => (
                      <span
                        key={item}
                        className="rounded-lg bg-white/[0.05] px-2 py-2 text-center text-[10px] font-medium text-white/60 ring-1 ring-white/[0.06]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
