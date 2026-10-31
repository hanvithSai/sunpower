"use client";

/**
 * ParamSelect — a dropdown that filters a list through the URL (?tech=…),
 * for filters with too many values for pills (e.g. 15 technicians).
 *
 *   <ParamSelect param="tech" label="Technician" allLabel="Everyone" options={[{ value: id, label: "Ravi Kumar" }]} />
 *
 * Keeps the other params, drops `page`. Carries its own <Suspense> boundary
 * because it reads `useSearchParams()`.
 */
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Select } from "@/components/ui/select";

export type ParamSelectProps = {
  param: string;
  label: string;
  options: { value: string; label: string }[];
  allLabel?: string;
};

export function ParamSelect(props: ParamSelectProps) {
  return (
    <Suspense fallback={<Select aria-label={props.label} disabled className="h-9 w-full sm:w-52" />}>
      <UrlParamSelect {...props} />
    </Suspense>
  );
}

function UrlParamSelect({ param, label, options, allLabel = "All" }: ParamSelectProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(param, value);
    else params.delete(param);
    params.delete("page");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <Select aria-label={label} value={searchParams.get(param) ?? ""} onChange={(e) => onChange(e.target.value)} className="h-9 w-full sm:w-52">
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
