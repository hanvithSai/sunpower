import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes, letting later utilities win (shadcn convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** `onInput` for phone fields: drop letters as they are typed or pasted, keep digits and + - ( ) . spaces. */
export function keepPhoneChars(event: { currentTarget: HTMLInputElement }) {
  const el = event.currentTarget;
  const clean = el.value.replace(/[^+\d\s().-]/g, "");
  if (clean !== el.value) el.value = clean;
}
