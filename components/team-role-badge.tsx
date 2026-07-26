import { Crown, Shield } from "lucide-react";
import { getRoleLabel, type TeamRole } from "@/lib/team-management";
import { cn } from "@/lib/utils";

type TeamRoleBadgeProps = {
  role: TeamRole;
  className?: string;
};

export function TeamRoleBadge({ role, className }: TeamRoleBadgeProps) {
  const Icon = role === "captain" ? Crown : Shield;

  return (
    <span
      className={cn(
        "bg-accent/10 text-accent ring-accent/20 inline-flex min-h-6 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1",
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {getRoleLabel(role)}
    </span>
  );
}
