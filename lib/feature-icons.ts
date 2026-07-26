import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  Building2,
  ClipboardCheck,
  Clapperboard,
  Cone,
  CreditCard,
  Flag,
  Goal,
  HelpCircle,
  LandPlot,
  Megaphone,
  NotebookPen,
  PoundSterling,
  Share2,
  Shirt,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";
import type { FeatureInfoKey } from "@/lib/feature-info";

/** Football-themed icons for coach-facing modules. */
export const FEATURE_ICONS: Record<FeatureInfoKey, LucideIcon> = {
  players: Shirt,
  teams: Flag,
  sessions: Cone,
  registers: ClipboardCheck,
  camps: Trophy,
  matches: Trophy,
  training: LandPlot,
  video: Clapperboard,
  news: Megaphone,
  enquiries: NotebookPen,
  reports: Activity,
  analytics: Activity,
  payments: CreditCard,
  finance: PoundSterling,
  automations: Zap,
  notifications: Bell,
  referrals: Share2,
  academy: Building2,
  insights: Sparkles,
  "booking-portal": Goal,
  "help-support": HelpCircle,
};

export function getFeatureIcon(key: FeatureInfoKey): LucideIcon {
  return FEATURE_ICONS[key];
}
