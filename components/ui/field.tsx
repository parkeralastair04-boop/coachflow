import {
  forwardRef,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { FOCUS_RING, TYPE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

const controlBase = cn(
  "border-border bg-background text-foreground w-full rounded-xl border text-sm outline-none transition-colors",
  "placeholder:text-muted/80",
  "disabled:cursor-not-allowed disabled:opacity-60",
  FOCUS_RING,
);

export const inputClassName = cn(controlBase, "h-11 min-h-11 px-3");
export const textareaClassName = cn(controlBase, "min-h-24 px-3 py-2");
export const selectClassName = cn(controlBase, "h-11 min-h-11 px-3");

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  required?: boolean;
};

export function Label({ className, children, required, ...props }: LabelProps) {
  return (
    <label className={cn(TYPE.label, "mb-1.5 block", className)} {...props}>
      {children}
      {required ? (
        <span className="text-red-600 dark:text-red-400" aria-hidden>
          {" "}
          *
        </span>
      ) : null}
    </label>
  );
}

export function FieldHint({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <p id={id} className={cn(TYPE.helper, "mt-1.5", className)}>
      {children}
    </p>
  );
}

export function FieldError({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  if (!children) return null;
  return (
    <p
      id={id}
      role="alert"
      className={cn("mt-1.5 text-sm text-red-600 dark:text-red-400", className)}
    >
      {children}
    </p>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        inputClassName,
        invalid && "border-red-300 dark:border-red-800",
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        textareaClassName,
        invalid && "border-red-300 dark:border-red-800",
        className,
      )}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        selectClassName,
        invalid && "border-red-300 dark:border-red-800",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export const Checkbox = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type">
>(function Checkbox({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        "border-border text-accent size-4 shrink-0 rounded border accent-[var(--accent)]",
        FOCUS_RING,
        className,
      )}
      {...props}
    />
  );
});

export const Radio = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type">
>(function Radio({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="radio"
      className={cn(
        "border-border text-accent size-4 shrink-0 border accent-[var(--accent)]",
        FOCUS_RING,
        className,
      )}
      {...props}
    />
  );
});

export type SwitchProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "role"
> & {
  label?: string;
};

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  function Switch({ className, label, id, checked, ...props }, ref) {
    const switchId = id ?? props.name;
    return (
      <label
        htmlFor={switchId}
        className={cn("inline-flex cursor-pointer items-center gap-3", className)}
      >
        <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
          <input
            ref={ref}
            id={switchId}
            type="checkbox"
            role="switch"
            checked={checked}
            className="peer sr-only"
            {...props}
          />
          <span
            aria-hidden
            className="peer-focus-visible:ring-accent/40 peer-checked:bg-accent absolute inset-0 rounded-full bg-black/15 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background dark:bg-white/20"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute left-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"
          />
        </span>
        {label ? <span className="text-sm font-medium">{label}</span> : null}
      </label>
    );
  },
);
