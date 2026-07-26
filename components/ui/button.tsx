import { forwardRef, type ButtonHTMLAttributes } from "react";
import {
  buttonVariants,
  type ButtonShape,
  type ButtonSize,
  type ButtonVariant,
} from "@/lib/ui/button-variants";
import { cn } from "@/lib/utils";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "primary",
      size,
      shape = "pill",
      type = "button",
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          buttonVariants({
            variant,
            size: size ?? (variant === "icon" ? "icon" : "md"),
            shape,
            className,
          }),
        )}
        {...props}
      />
    );
  },
);

export { buttonVariants };
