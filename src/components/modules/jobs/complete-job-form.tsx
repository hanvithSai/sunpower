"use client";

/**
 * The crew's completion form on the roof (BR-14), built for a phone:
 * start/finish times, installed size (a reason if it differs from the order),
 * the generation test and checklist, whether the whole kit arrived, any extra
 * material used, photos of the finished roof, and the homeowner's signature.
 * Extra material posts as one JSON field; photos upload to GridFS as they are
 * taken; the server re-checks everything.
 *
 * Local draft (F23): once the crew starts filling it in, everything except the
 * signature is saved on the phone every few seconds. A reload, a dropped
 * signal or a closed tab brings the entries (and uploaded photos) back; the
 * customer always signs fresh. The draft is cleared when the job completes.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { CheckCircle2, History, Plus, Trash2 } from "lucide-react";
import { ActionForm, useFieldError } from "@/components/shared/action-form";
import { FormField } from "@/components/shared/form-field";
import { MediaUploader } from "@/components/shared/media-uploader";
import { SignaturePad } from "@/components/shared/signature-pad";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { INSTALL_CHECKLIST } from "@/lib/constants";
import { formatTime } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { completeJobAction } from "@/server/actions/jobs";

export type ExtraProduct = { id: string; sku: string; name: string; unit: string; costPaise: number };

type Props = {
  jobId: string;
  orderKw: number | null;
  customerName: string;
  /** IST `datetime-local` defaults computed on the server. */
  startedAt: string;
  now: string;
  extraProducts: ExtraProduct[];
};

type Extra = { key: number; productId: string; qty: number };
let nextKey = 1;

/* ------------------------------------------------------------------ */
/* Local draft (F23)                                                    */
/* ------------------------------------------------------------------ */

type JobDraft = { savedAt: number; fields: Record<string, string[]> };

const SAVE_EVERY_MS = 4000;
/** Never kept: the signature must be given fresh, and the rest is page state. */
const NOT_SAVED = new Set(["jobId", "signature", "photos__uploading"]);

const draftKey = (jobId: string) => `sunpower:job-draft:${jobId}`;

function readDraft(jobId: string): string | null {
  try {
    return window.localStorage.getItem(draftKey(jobId));
  } catch {
    return null;
  }
}

function writeDraft(jobId: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(draftKey(jobId));
    else window.localStorage.setItem(draftKey(jobId), value);
  } catch {
    // Private mode or storage full: the form still works, just without a draft.
  }
}

function parseDraft(raw: string | null): JobDraft | null {
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as JobDraft;
    return typeof draft.savedAt === "number" && draft.fields && typeof draft.fields === "object" ? draft : null;
  } catch {
    return null;
  }
}

function formFields(form: HTMLFormElement): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const [name, value] of new FormData(form)) {
    if (NOT_SAVED.has(name) || typeof value !== "string") continue;
    (fields[name] ??= []).push(value);
  }
  return fields;
}

/** The draft as it was when this form opened; the saves that follow don't change it. */
const openedWith = new Map<string, string | null>();
const noopSubscribe = () => () => {};

export function CompleteJobForm(props: Props) {
  const { jobId } = props;
  const raw = useSyncExternalStore(
    noopSubscribe,
    () => {
      if (!openedWith.has(jobId)) openedWith.set(jobId, readDraft(jobId));
      return openedWith.get(jobId) ?? null;
    },
    () => null,
  );
  const saved = useMemo(() => parseDraft(raw), [raw]);
  const [startOver, setStartOver] = useState(false);
  const draft = startOver ? null : saved;
  const formRef = useRef<HTMLDivElement>(null);
  const dirty = useRef(false);
  const done = useRef(false);

  // Coming back to this job later reads the storage again.
  useEffect(() => () => void openedWith.delete(jobId), [jobId]);

  // Photos finish uploading without an input event, so save on a timer as well.
  useEffect(() => {
    let last = "";
    const save = () => {
      const form = formRef.current?.querySelector("form");
      if (!form || !dirty.current || done.current) return;
      const fields = formFields(form);
      const serialized = JSON.stringify(fields);
      if (serialized === last) return;
      last = serialized;
      writeDraft(jobId, JSON.stringify({ savedAt: Date.now(), fields }));
    };
    const timer = window.setInterval(save, SAVE_EVERY_MS);
    window.addEventListener("pagehide", save);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [jobId]);

  function discard() {
    writeDraft(jobId, null);
    dirty.current = false;
    setStartOver(true);
  }

  return (
    <div className="space-y-4">
      {draft ? (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm">
          <History className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1">Restored what you entered at {formatTime(new Date(draft.savedAt))}. The customer still needs to sign.</span>
          <Button type="button" variant="outline" size="sm" onClick={discard}>
            Start over
          </Button>
        </div>
      ) : null}
      <CompleteJobFields
        key={draft ? "draft" : "fresh"}
        {...props}
        draft={draft}
        formRef={formRef}
        onEdit={() => {
          dirty.current = true;
        }}
        onCompleted={() => {
          done.current = true;
          writeDraft(jobId, null);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The form                                                             */
/* ------------------------------------------------------------------ */

type FieldsProps = Props & {
  draft: JobDraft | null;
  formRef: RefObject<HTMLDivElement | null>;
  onEdit: () => void;
  onCompleted: () => void;
};

function draftExtras(draft: JobDraft | null): Extra[] {
  try {
    const list = JSON.parse(draft?.fields.extras?.[0] ?? "[]") as { productId: string; qty: number }[];
    return list.map((e) => ({ key: nextKey++, productId: String(e.productId), qty: Number(e.qty) || 0 }));
  } catch {
    return [];
  }
}

function CompleteJobFields({ jobId, orderKw, customerName, startedAt, now, extraProducts, draft, formRef, onEdit, onCompleted }: FieldsProps) {
  const value = (name: string) => draft?.fields[name]?.[0];
  /** A checkbox posts "on" only when ticked; without a draft it keeps its usual default. */
  const ticked = (name: string, fallback: boolean) => (draft ? Boolean(draft.fields[name]) : fallback);
  const [kw, setKw] = useState(() => Number(value("confirmedKw")) || orderKw || 3);
  const [kitComplete, setKitComplete] = useState(() => ticked("kitComplete", true));
  const [extras, setExtras] = useState<Extra[]>(() => draftExtras(draft));
  const [hasExtraCost, setHasExtraCost] = useState(() => Boolean(value("extraCostRs")));
  const productById = new Map(extraProducts.map((p) => [p.id, p]));
  const kwDiffers = orderKw !== null && Math.abs(kw - orderKw) > 0.01;
  const extrasPaise = extras.reduce((sum, e) => sum + Math.round(e.qty * (productById.get(e.productId)?.costPaise ?? 0)), 0);

  return (
    // Edits bubble up here; the draft saver reads the form inside.
    <div ref={formRef} onInput={onEdit} onChange={onEdit}>
      <ActionForm action={completeJobAction} onSuccess={onCompleted} className="space-y-6">
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="extras" value={JSON.stringify(extras.filter((e) => e.productId && e.qty > 0).map(({ productId, qty }) => ({ productId, qty })))} />

        <fieldset className="space-y-4">
          <legend className="mb-2 text-sm font-semibold text-foreground">1. Time on site</legend>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Started" name="startedAt" required>
              <Input id="startedAt" name="startedAt" type="datetime-local" defaultValue={value("startedAt") ?? startedAt} max={now} required />
            </FormField>
            <FormField label="Finished" name="finishedAt" required>
              <Input id="finishedAt" name="finishedAt" type="datetime-local" defaultValue={value("finishedAt") ?? now} max={now} required />
            </FormField>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 text-sm font-semibold text-foreground">2. System and test</legend>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Installed size (kW)" name="confirmedKw" required hint={orderKw !== null ? `Order: ${orderKw} kW` : undefined}>
              <Input
                id="confirmedKw"
                name="confirmedKw"
                type="number"
                inputMode="decimal"
                min={0.5}
                max={10}
                step={0.01}
                required
                value={kw}
                onChange={(e) => setKw(Number(e.target.value))}
              />
            </FormField>
            <FormField label="Generation now (kW)" name="generationReadingKw" hint="Inverter display reading">
              <Input id="generationReadingKw" name="generationReadingKw" type="number" inputMode="decimal" min={0} max={15} step={0.01} defaultValue={value("generationReadingKw")} />
            </FormField>
          </div>
          {kwDiffers && (
            <FormField label="Why is the size different?" name="kwChangeReason" required>
              <Textarea id="kwChangeReason" name="kwChangeReason" rows={2} maxLength={300} required placeholder="e.g. Roof fitted 5 panels, customer agreed" defaultValue={value("kwChangeReason")} />
            </FormField>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {INSTALL_CHECKLIST.filter((c) => c.key !== "testing").map((c) => (
              <label key={c.key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
                <Checkbox name={c.key} defaultChecked={ticked(c.key, true)} />
                {c.label}
              </label>
            ))}
          </div>
          <TestedCheck defaultChecked={ticked("generationTested", false)} />
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-semibold text-foreground">3. Kit and extras</legend>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <Checkbox name="kitComplete" checked={kitComplete} onChange={(e) => setKitComplete(e.target.checked)} />
            Everything on the pick list arrived at site
          </label>
          {!kitComplete ? (
            <FormField label="What was missing?" name="missingItems" required>
              <Textarea id="missingItems" name="missingItems" rows={2} maxLength={300} required defaultValue={value("missingItems")} />
            </FormField>
          ) : null}

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Extra material used beyond the kit (taken from stock and charged to this job):</p>
            {extras.map((extra) => {
              const product = productById.get(extra.productId);
              return (
                <div key={extra.key} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label htmlFor={`extra-${extra.key}`} className="sr-only">
                      Material
                    </Label>
                    <Select
                      id={`extra-${extra.key}`}
                      value={extra.productId}
                      onChange={(e) => setExtras((c) => c.map((x) => (x.key === extra.key ? { ...x, productId: e.target.value } : x)))}
                    >
                      <option value="">Choose material…</option>
                      {extraProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-24 space-y-1">
                    <Label htmlFor={`extra-qty-${extra.key}`} className="sr-only">
                      Quantity {product ? `(${product.unit})` : ""}
                    </Label>
                    <Input
                      id={`extra-qty-${extra.key}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={extra.qty || ""}
                      placeholder={product?.unit ?? "qty"}
                      onChange={(e) => setExtras((c) => c.map((x) => (x.key === extra.key ? { ...x, qty: Number(e.target.value) || 0 } : x)))}
                    />
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove material" onClick={() => setExtras((c) => c.filter((x) => x.key !== extra.key))}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              );
            })}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setExtras((c) => [...c, { key: nextKey++, productId: "", qty: 0 }])} disabled={extras.length >= 10}>
                <Plus aria-hidden="true" />
                Add material
              </Button>
              {extrasPaise > 0 ? <span className="text-xs text-muted-foreground">At cost: {formatINR(extrasPaise)}</span> : null}
            </div>
            <ExtrasError />
          </div>

          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <Checkbox checked={hasExtraCost} onChange={(e) => setHasExtraCost(e.target.checked)} />
            Other site cost (crane, scaffolding, travel…)
          </label>
          {hasExtraCost ? (
            <div className="grid grid-cols-[120px_1fr] gap-3">
              <FormField label="Amount (₹)" name="extraCostRs" required>
                <Input id="extraCostRs" name="extraCostRs" type="number" inputMode="decimal" min={1} step="0.01" required defaultValue={value("extraCostRs")} />
              </FormField>
              <FormField label="For" name="extraCostNote" required>
                <Input id="extraCostNote" name="extraCostNote" maxLength={200} required defaultValue={value("extraCostNote")} />
              </FormField>
            </div>
          ) : null}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-semibold text-foreground">4. Photos of the finished roof</legend>
          <MediaUploader name="photos" accept="image" maxFiles={8} label="Panels, inverter, earthing, meter" defaultValue={draft?.fields.photos} />
          <PhotosError />
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-semibold text-foreground">5. Customer acceptance</legend>
          <FormField label="Customer remarks" name="customerRemarks">
            <Textarea id="customerRemarks" name="customerRemarks" rows={2} maxLength={500} defaultValue={value("customerRemarks")} />
          </FormField>
          <SignaturePad name="signature" required label="Customer signature" />
          <FormField label="Signed by" name="signedBy" required>
            <Input id="signedBy" name="signedBy" required maxLength={80} defaultValue={value("signedBy") ?? customerName} />
          </FormField>
        </fieldset>

        <FormField label="Notes for the office" name="notes">
          <Textarea id="notes" name="notes" rows={2} maxLength={1000} defaultValue={value("notes")} />
        </FormField>

        <SubmitButton size="lg" className="w-full" pendingText="Completing…">
          <CheckCircle2 aria-hidden="true" />
          Complete installation
        </SubmitButton>
      </ActionForm>
    </div>
  );
}

function TestedCheck({ defaultChecked }: { defaultChecked: boolean }) {
  const error = useFieldError("generationTested");
  return (
    <div>
      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 border-primary/40 bg-primary/5 px-3 py-2 text-sm font-medium">
        <Checkbox name="generationTested" required defaultChecked={defaultChecked} />
        The system is generating power (tested)
      </label>
      {error ? (
        <p role="alert" className="mt-1 text-sm text-danger-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PhotosError() {
  const error = useFieldError("photos");
  return error ? (
    <p role="alert" className="text-sm text-danger-foreground">
      {error}
    </p>
  ) : null;
}

function ExtrasError() {
  const error = useFieldError("extras");
  return error ? (
    <p role="alert" className="text-sm text-danger-foreground">
      {error}
    </p>
  ) : null;
}
