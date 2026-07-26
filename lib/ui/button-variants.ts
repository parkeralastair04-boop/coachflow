import { cn } from "@/lib/utils";
import { FOCUS_RING } from "@/lib/ui/tokens";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost"
  | "accent"
  | "icon";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

const base = cn(
  "inline-flex shrink-0 items-center justify-center gap-2 font-medium transition-[opacity,background-color,color,border-color,transform,box-shadow] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-press disabled:pointer-events-none disabled:opacity-60",
  FOCUS_RING,
);

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-foreground text-background shadow-sm hover:shadow-md hover:brightness-[1.03] active:brightness-[0.97]",
  secondary:
    "border-border border bg-surface-subtle hover:bg-surface-hover hover:border-black/[0.12] dark:hover:border-white/[0.12]",
  destructive:
    "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60",
  outline:
    "border-border border bg-transparent hover:bg-surface-hover hover:border-black/[0.12] dark:hover:border-white/[0.12]",
  ghost:
    "bg-transparent text-muted hover:bg-surface-hover hover:text-foreground",
  accent:
    "bg-accent text-accent-foreground shadow-sm hover:shadow-[0_8px_24px_-8px_rgba(5,150,105,0.55)] hover:brightness-[1.04] active:brightness-[0.96]",
  icon:
    "border-border border bg-transparent hover:bg-surface-hover hover:border-black/[0.12] dark:hover:border-white/[0.12]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 min-h-9 rounded-full px-3.5 text-sm",
  md: "h-11 min-h-11 rounded-full px-5 text-sm",
  lg: "h-12 min-h-12 rounded-full px-6 text-sm font-semibold",
  icon: "size-11 min-h-11 min-w-11 rounded-full p-0",
};

/** Dashboard toolbars often use rounded-xl rather than pill. */
const shapeOverrides = {
  soft: "rounded-xl",
} as const;

export type ButtonShape = "pill" | "soft";

export function buttonVariants(options?: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  className?: string;
}): string {
  const variant = options?.variant ?? "primary";
  const size = options?.size ?? (variant === "icon" ? "icon" : "md");
  const shape = options?.shape ?? "pill";

  return cn(
    base,
    variants[variant],
    sizes[size],
    shape === "soft" && size !== "icon" ? shapeOverrides.soft : null,
    shape === "soft" && size === "icon" ? "rounded-xl" : null,
    options?.className,
  );
}
