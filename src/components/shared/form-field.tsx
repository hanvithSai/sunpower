"use client";

/**
 * FormField — label + control + error/hint, wired to the surrounding <ActionForm>.
 *
 *   <FormField label="Mobile number" name="phone" required hint="10-digit Indian mobile">
 *     <Input id="phone" name="phone" inputMode="tel" />
 *   </FormField>
 *
 * Give the control `id={name}` so the label points at it. When the action returns
 * `fieldErrors[name]`, the message replaces the hint in red, and the control gets
 * `aria-invalid` + `aria-describedby` automatically (single-element children only).
 */
import { Children, Fragment, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { useFieldError } from "@/components/shared/action-form";

export type FormFieldProps = {
  label: string;
  name: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

type AriaProps = {
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
  "aria-required"?: boolean | "true" | "false";
};

export function FormField({ label, name, hint, required = false, className, children }: FormFieldProps) {
  const error = useFieldError(name);
  const messageId = `${name}-message`;
  const hasMessage = Boolean(error) || (hint !== undefined && hint !== null && hint !== false);

  // Wire accessibility attributes onto a single control child (Input, Select, Textarea …).
  let control = children;
  if (Children.count(children) === 1 && isValidElement(children) && children.type !== Fragment) {
    const child = children as ReactElement<AriaProps>;
    const describedBy = [child.props["aria-describedby"], hasMessage ? messageId : undefined]
      .filter(Boolean)
      .join(" ");
    control = cloneElement(child, {
      "aria-invalid": error ? true : child.props["aria-invalid"],
      "aria-describedby": describedBy || undefined,
      "aria-required": required ? true : child.props["aria-required"],
    });
  }

  return (
    <div data-slot="form-field" data-invalid={error ? "" : undefined} className={cn("grid gap-1.5", className)}>
      <Label htmlFor={name}>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-danger-foreground">
            *
          </span>
        ) : null}
      </Label>
      {control}
      {error ? (
        <p id={messageId} role="alert" className="text-[13px] leading-snug text-danger-foreground">
          {error}
        </p>
      ) : hasMessage ? (
        <div id={messageId} className="text-[13px] leading-snug text-muted-foreground">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
