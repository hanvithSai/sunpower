"use client";

/**
 * The technician's on-roof survey form — built for a phone in one hand:
 * big tap targets, a compass-style direction picker, numeric keypads, and
 * camera capture for roof photos/videos (uploaded straight to GridFS).
 */
import { Send } from "lucide-react";
import { ActionForm, useFieldError } from "@/components/shared/action-form";
import { FormField } from "@/components/shared/form-field";
import { MediaUploader } from "@/components/shared/media-uploader";
import { SubmitButton } from "@/components/shared/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ROOF_DIRECTIONS, ROOF_TYPE_LABELS, SYSTEM_TYPE_LABELS, options, type RoofType, type SystemType } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { submitSurveyAction } from "@/server/actions/surveys";

export type SurveyDefaults = {
  roofType?: RoofType;
  usableAreaSqft?: number;
  recommendedKw: number;
  recommendedSystemType: SystemType;
};

const KW_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10];

export function SurveyForm({ surveyId, defaults }: { surveyId: string; defaults: SurveyDefaults }) {
  return (
    <ActionForm action={submitSurveyAction} className="space-y-6">
      <input type="hidden" name="surveyId" value={surveyId} />

      <DirectionPicker />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Roof tilt (degrees)" name="tiltDeg" required hint="Flat RCC roofs: use the structure tilt, about 15–18° in Telangana">
          <Input id="tiltDeg" name="tiltDeg" type="number" inputMode="numeric" min={0} max={60} required defaultValue={15} />
        </FormField>
        <FormField label="Roof type" name="roofType" required>
          <Select id="roofType" name="roofType" defaultValue={defaults.roofType ?? "rcc"}>
            {options(ROOF_TYPE_LABELS).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Usable roof area (sq ft)" name="usableAreaSqft" required>
          <Input id="usableAreaSqft" name="usableAreaSqft" type="number" inputMode="numeric" min={10} required defaultValue={defaults.usableAreaSqft} />
        </FormField>
        <FormField label="Shading through the day (%)" name="shadingPct" required hint="Trees, water tanks, neighbouring buildings">
          <Input id="shadingPct" name="shadingPct" type="number" inputMode="numeric" min={0} max={100} required defaultValue={0} />
        </FormField>
        <FormField label="Cable distance to meter (m)" name="cableDistanceM" required>
          <Input id="cableDistanceM" name="cableDistanceM" type="number" inputMode="decimal" min={0} max={500} step={0.5} required />
        </FormField>
        <FormField label="Floors to the roof" name="floors" required>
          <Input id="floors" name="floors" type="number" inputMode="numeric" min={0} max={50} required defaultValue={1} />
        </FormField>
        <FormField label="Recommended size" name="recommendedKw" required>
          <Select id="recommendedKw" name="recommendedKw" defaultValue={String(defaults.recommendedKw)}>
            {KW_OPTIONS.map((kw) => (
              <option key={kw} value={kw}>
                {kw} kW
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Recommended system" name="recommendedSystemType" required>
          <Select id="recommendedSystemType" name="recommendedSystemType" defaultValue={defaults.recommendedSystemType}>
            {options(SYSTEM_TYPE_LABELS).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="flex items-center gap-3 sm:col-span-2">
          <Checkbox id="earthingPossible" name="earthingPossible" defaultChecked />
          <label htmlFor="earthingPossible" className="text-sm">
            Space available for earthing pits
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <MediaUploader name="photos" accept="image+video" maxFiles={8} label="Roof photos and short videos" />
        <FieldError name="photos" />
      </div>

      <FormField label="Notes for the sales team" name="notes">
        <Textarea id="notes" name="notes" rows={3} maxLength={2000} placeholder="Access, obstructions, customer requests…" />
      </FormField>

      <SubmitButton size="lg" className="w-full sm:w-auto" pendingText="Submitting…">
        <Send aria-hidden="true" />
        Submit survey
      </SubmitButton>
    </ActionForm>
  );
}

function FieldError({ name }: { name: string }) {
  const error = useFieldError(name);
  return error ? (
    <p role="alert" className="text-sm text-danger-foreground">
      {error}
    </p>
  ) : null;
}

/** Eight-point compass as large radio buttons; south is best in India. */
function DirectionPicker() {
  const error = useFieldError("roofDirection");
  return (
    <fieldset aria-describedby={error ? "roofDirection-error" : undefined}>
      <legend className="mb-2 text-sm font-medium text-foreground">
        Roof faces <span className="text-danger-foreground">*</span>
      </legend>
      <div className="grid grid-cols-4 gap-2">
        {ROOF_DIRECTIONS.map((dir) => (
          <label
            key={dir}
            className={cn(
              "relative flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-[10px] border border-input bg-card px-2 py-2 text-sm font-medium transition-colors",
              "has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
            )}
          >
            <input type="radio" name="roofDirection" value={dir} required defaultChecked={dir === "S"} className="sr-only" />
            {dir}
            {dir === "S" ? <span className="text-[11px] font-normal">best</span> : null}
          </label>
        ))}
      </div>
      {error ? (
        <p id="roofDirection-error" role="alert" className="mt-1.5 text-sm text-danger-foreground">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
