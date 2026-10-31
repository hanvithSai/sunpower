"use client";

/**
 * Service desk forms: raise a ticket, book the visit, override billing, resolve
 * (parts, labour, replacement unit), record the customer's confirmation, and
 * "Not fixed". Each posts to a Server Action that re-checks the rules
 * (BR-04 to BR-06, BR-15); the copy says what will happen before it does.
 */
import { useState, type ReactNode } from "react";
import { CalendarClock, CheckCircle2, Plus, RotateCcw, Scale, Trash2, Wrench } from "lucide-react";
import { ActionForm, useFieldError } from "@/components/shared/action-form";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CONFIRMATION_CHANNEL_LABELS,
  RESOLUTION_TYPE_LABELS,
  SERVICE_LABOUR_RATE_RS,
  TICKET_CATEGORY_LABELS,
  TICKET_CHANNEL_LABELS,
  TICKET_PRIORITIES,
  options,
  statusMeta,
  type ResolutionType,
  type TicketCategory,
} from "@/lib/constants";
import { formatINR } from "@/lib/money";
import {
  assignTicketAction,
  confirmTicketAction,
  createTicketAction,
  overrideBillingAction,
  reopenTicketAction,
  resolveTicketAction,
} from "@/server/actions/service";

/* ------------------------------------------------------------------ */

export function CreateTicketForm({ serial, customerId, defaultCategory }: { serial?: string; customerId?: string; defaultCategory: TicketCategory }) {
  return (
    <ActionForm action={createTicketAction} className="space-y-4">
      {serial ? <input type="hidden" name="serial" value={serial} /> : null}
      {customerId ? <input type="hidden" name="customerId" value={customerId} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Problem" name="category" required>
          <Select id="category" name="category" defaultValue={defaultCategory}>
            {options(TICKET_CATEGORY_LABELS).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Fault code on display" name="faultCode" hint="If the inverter shows one">
          <Input id="faultCode" name="faultCode" maxLength={40} placeholder="e.g. E-30" autoCapitalize="characters" />
        </FormField>
        <FormField label="What the customer says" name="description" required className="sm:col-span-2">
          <Textarea id="description" name="description" rows={3} maxLength={1000} required placeholder="Zero power since this morning's rain…" />
        </FormField>
        <FormField label="Priority" name="priority" required>
          <Select id="priority" name="priority" defaultValue="high">
            {TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {statusMeta("priority", p).label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Came in by" name="channel" required>
          <Select id="channel" name="channel" defaultValue="phone">
            {options(TICKET_CHANNEL_LABELS).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <SubmitButton pendingText="Raising…">Raise ticket</SubmitButton>
    </ActionForm>
  );
}

/* ------------------------------------------------------------------ */

function DialogShell({ trigger, title, description, children }: { trigger: ReactNode; title: string; description?: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children(() => setOpen(false))}
      </DialogContent>
    </Dialog>
  );
}

function Footer({ submit, pending }: { submit: string; pending: string }) {
  return (
    <DialogFooter>
      <DialogClose asChild>
        <Button type="button" variant="outline">
          Cancel
        </Button>
      </DialogClose>
      <SubmitButton pendingText={pending}>{submit}</SubmitButton>
    </DialogFooter>
  );
}

export function AssignTicketDialog({
  ticketId,
  technicians,
  defaultTechnicianId,
  defaultVisitAt,
  minVisitAt,
  rebook,
}: {
  ticketId: string;
  technicians: { id: string; name: string; skills: string[] }[];
  defaultTechnicianId?: string;
  defaultVisitAt: string;
  minVisitAt: string;
  rebook: boolean;
}) {
  const service = technicians.filter((t) => t.skills.includes("service"));
  const others = technicians.filter((t) => !t.skills.includes("service"));
  return (
    <DialogShell
      trigger={
        <Button variant={rebook ? "outline" : "default"}>
          <CalendarClock aria-hidden="true" />
          {rebook ? "Rebook visit" : "Book visit"}
        </Button>
      }
      title={rebook ? "Rebook the service visit" : "Book a service visit"}
      description="The visit appears on the technician's calendar and in My work straight away."
    >
      {(close) => (
        <ActionForm action={assignTicketAction} onSuccess={close} className="space-y-4">
          <input type="hidden" name="ticketId" value={ticketId} />
          <FormField label="Technician" name="technicianId" required>
            <Select id="technicianId" name="technicianId" defaultValue={defaultTechnicianId ?? service[0]?.id}>
              <optgroup label="Service technicians">
                {service.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Others">
                {others.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            </Select>
          </FormField>
          <FormField label="Visit at" name="visitAt" required>
            <Input id="visitAt" name="visitAt" type="datetime-local" min={minVisitAt} defaultValue={defaultVisitAt} required />
          </FormField>
          <Footer submit={rebook ? "Rebook" : "Book visit"} pending="Booking…" />
        </ActionForm>
      )}
    </DialogShell>
  );
}

export function BillingOverrideDialog({ ticketId, billable }: { ticketId: string; billable: boolean }) {
  return (
    <DialogShell
      trigger={
        <Button variant="ghost" size="sm">
          <Scale aria-hidden="true" />
          {billable ? "Make free of charge" : "Make billable"}
        </Button>
      }
      title={billable ? "Waive the charges?" : "Bill this repair?"}
      description="The reason is recorded on the ticket's timeline."
    >
      {(close) => (
        <ActionForm action={overrideBillingAction} onSuccess={close} className="space-y-4">
          <input type="hidden" name="ticketId" value={ticketId} />
          <input type="hidden" name="billable" value={billable ? "false" : "true"} />
          <FormField label="Reason" name="reason" required>
            <Textarea
              id="reason"
              name="reason"
              rows={2}
              maxLength={300}
              required
              placeholder={billable ? "Goodwill: second visit for the same fault" : "Physical damage is not covered by warranty"}
            />
          </FormField>
          <Footer submit="Save" pending="Saving…" />
        </ActionForm>
      )}
    </DialogShell>
  );
}

/* ------------------------------------------------------------------ */

type PartOption = { id: string; sku: string; name: string; unit: string; pricePaise: number; stockQty: number };
type Part = { key: number; productId: string; qty: number };
let nextKey = 1;

export function ResolveTicketForm({
  ticketId,
  billable,
  hasSerial,
  parts,
  replacements,
}: {
  ticketId: string;
  billable: boolean;
  hasSerial: boolean;
  parts: PartOption[];
  replacements: string[];
}) {
  const [type, setType] = useState<ResolutionType>("repair");
  const [hours, setHours] = useState(1);
  const [lines, setLines] = useState<Part[]>([]);
  const byId = new Map(parts.map((p) => [p.id, p]));
  const partsPaise = lines.reduce((s, l) => s + l.qty * (byId.get(l.productId)?.pricePaise ?? 0), 0);
  const labourPaise = Math.round(hours * SERVICE_LABOUR_RATE_RS * 100);

  return (
    <ActionForm action={resolveTicketAction} className="space-y-4">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="parts" value={JSON.stringify(lines.filter((l) => l.productId && l.qty > 0).map(({ productId, qty }) => ({ productId, qty })))} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Outcome" name="type" required>
          <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value as ResolutionType)}>
            {options(RESOLUTION_TYPE_LABELS)
              .filter((o) => hasSerial || o.value !== "replacement")
              .map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
          </Select>
        </FormField>
        <FormField label="Labour (hours)" name="labourHours" required>
          <Input id="labourHours" name="labourHours" type="number" inputMode="decimal" min={0} max={24} step={0.25} value={hours} onChange={(e) => setHours(Number(e.target.value) || 0)} required />
        </FormField>
      </div>

      {type === "replacement" ? (
        <FormField label="Replacement unit serial" name="replacementSerial" required hint="Same model, from stock. Scan the box or pick one.">
          <Input id="replacementSerial" name="replacementSerial" list="replacement-serials" required autoCapitalize="characters" className="font-mono" />
        </FormField>
      ) : null}
      <datalist id="replacement-serials">
        {replacements.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <div className="space-y-2">
        <Label>Parts fitted</Label>
        {lines.map((line) => (
          <div key={line.key} className="flex items-end gap-2">
            <Select
              aria-label="Part"
              value={line.productId}
              onChange={(e) => setLines((c) => c.map((x) => (x.key === line.key ? { ...x, productId: e.target.value } : x)))}
              className="min-w-0 flex-1"
            >
              <option value="">Choose a part…</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id} disabled={p.stockQty <= 0}>
                  {p.name} ({p.stockQty} in stock)
                </option>
              ))}
            </Select>
            <Input
              aria-label="Quantity"
              type="number"
              inputMode="numeric"
              min={1}
              className="w-20"
              value={line.qty || ""}
              onChange={(e) => setLines((c) => c.map((x) => (x.key === line.key ? { ...x, qty: Math.max(0, Math.floor(Number(e.target.value) || 0)) } : x)))}
            />
            <Button type="button" variant="ghost" size="icon" aria-label="Remove part" onClick={() => setLines((c) => c.filter((x) => x.key !== line.key))}>
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setLines((c) => [...c, { key: nextKey++, productId: "", qty: 1 }])} disabled={lines.length >= 10}>
          <Plus aria-hidden="true" />
          Add part
        </Button>
        <FieldError name="parts" />
      </div>

      <FormField label="What was done" name="notes" required>
        <Textarea id="notes" name="notes" rows={3} maxLength={1000} required placeholder="Blown DC fuses replaced, generation back to 2.3 kW" />
      </FormField>

      <p className={billable ? "rounded-xl bg-warning/12 px-3 py-2 text-sm text-warning-foreground" : "rounded-xl bg-success/12 px-3 py-2 text-sm text-success-foreground"}>
        {billable
          ? `A GST invoice is issued on resolve: parts ${formatINR(partsPaise)} + labour ${formatINR(labourPaise)} + GST${type === "replacement" ? " + the replacement unit" : ""}.`
          : "₹0 to the customer. What it costs us is charged to the original installation's profit."}
      </p>
      <SubmitButton pendingText="Resolving…">
        <Wrench aria-hidden="true" />
        Resolve — then confirm with the customer
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

/* ------------------------------------------------------------------ */

export function ConfirmTicketDialog({ ticketId, customerName }: { ticketId: string; customerName: string }) {
  return (
    <DialogShell
      trigger={
        <Button>
          <CheckCircle2 aria-hidden="true" />
          Customer confirmed it works
        </Button>
      }
      title="Record the customer's confirmation"
      description="Only a confirmed ticket can be closed. Call or WhatsApp the customer first."
    >
      {(close) => (
        <ActionForm action={confirmTicketAction} onSuccess={close} className="space-y-4">
          <input type="hidden" name="ticketId" value={ticketId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Confirmed by" name="confirmedBy" required>
              <Input id="confirmedBy" name="confirmedBy" required maxLength={80} defaultValue={customerName} />
            </FormField>
            <FormField label="How" name="channel" required>
              <Select id="channel" name="channel" defaultValue="call">
                {options(CONFIRMATION_CHANNEL_LABELS).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <FormField label="Note" name="note">
            <Input id="note" name="note" maxLength={300} placeholder="Generating 2.1 kW at noon" />
          </FormField>
          <Footer submit="Record confirmation" pending="Saving…" />
        </ActionForm>
      )}
    </DialogShell>
  );
}

export function ReopenTicketDialog({ ticketId }: { ticketId: string }) {
  return (
    <DialogShell
      trigger={
        <Button variant="outline">
          <RotateCcw aria-hidden="true" />
          Not fixed
        </Button>
      }
      title="Reopen this ticket"
      description="It goes back to In progress with the same technician."
    >
      {(close) => (
        <ActionForm action={reopenTicketAction} onSuccess={close} className="space-y-4">
          <input type="hidden" name="ticketId" value={ticketId} />
          <FormField label="What's still wrong" name="reason" required>
            <Textarea id="reason" name="reason" rows={2} maxLength={300} required />
          </FormField>
          <Footer submit="Reopen" pending="Reopening…" />
        </ActionForm>
      )}
    </DialogShell>
  );
}
