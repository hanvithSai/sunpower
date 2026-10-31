/**
 * Button — the primary interactive control (shadcn/ui-compatible API).
 *
 * Variants follow Apple's web conventions: solid blue primary action, tinted grey
 * secondary, hairline outline, ghost for toolbars, red destructive and an inline link.
 * On touch devices (coarse pointer) every size grows to a 44px hit target.
 * Use `asChild` to give a Next.js <Link> button styling:
 *   <Button asChild><Link href="/leads">Leads</Link></Button>
 */
import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium select-none",
    "transition-[color,background-color,border-color,box-shadow,opacity] duration-150 ease-out",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover active:opacity-90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary-hover active:opacity-90",
        outline: "border border-input bg-card text-foreground shadow-xs hover:bg-accent active:opacity-90",
        ghost: "text-foreground hover:bg-accent active:opacity-90",
        destructive: "bg-danger text-white shadow-xs hover:bg-danger/90 active:opacity-90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 pointer-coarse:h-11",
        sm: "h-8 gap-1.5 px-3 text-[13px] pointer-coarse:h-11",
        lg: "h-11 px-6 text-[15px]",
        icon: "size-9 pointer-coarse:size-11",
      },
    },
    compoundVariants: [
      // Inline links size to their text rather than to a control height.
      { variant: "link", className: "h-auto px-0 pointer-coarse:h-auto" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the single child element (e.g. a <Link>) with button styles instead of a <button>. */
    asChild?: boolean;
  };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant ?? "default"}
      data-size={size ?? "default"}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants, type ButtonProps };
