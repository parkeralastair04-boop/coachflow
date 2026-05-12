import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type UpgradePromptProps = {
  title?: string;
  description?: string;
  className?: string;
};

export function UpgradePrompt({
  title = "Unlock this feature",
  description = "Upgrade your CoachFlow plan to use this area and the rest of your coaching stack.",
  className,
}: UpgradePromptProps) {
  return (
    <div
      className={cn(
        "glass-panel flex flex-col items-center gap-4 rounded-2xl p-8 text-center sm:p-10",
        className,
      )}
    >
      <div className="bg-accent/12 ring-accent/25 flex size-14 items-center justify-center rounded-2xl ring-1">
        <Sparkles className="text-accent size-7" aria-hidden />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
        <p className="text-muted max-w-md text-sm leading-relaxed">{description}</p>
      </div>
      <Link
        href="/pricing"
        className="bg-foreground text-background hover:opacity-90 inline-flex h-11 items-center justify-center rounded-full px-8 text-sm font-medium transition-opacity"
      >
        View plans & upgrade
      </Link>
    </div>
  );
}
