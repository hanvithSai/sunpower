"use client";

/**
 * Enquiry fields shared by the public website form and the sales team's
 * "New enquiry" dialog, so both validate and look the same.
 */
import { FormField } from "@/components/shared/form-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CUSTOMER_TYPE_LABELS,
  LEAD_SOURCE_LABELS,
  REQUESTED_SYSTEM_TYPE_LABELS,
  options,
} from "@/lib/constants";

const CAPACITY_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10];

export type LeadFieldDefaults = { capacityKw?: number; systemType?: string };

export function LeadFields({ withSource = false, defaults = {} }: { withSource?: boolean; defaults?: LeadFieldDefaults }) {
  const capacity = CAPACITY_OPTIONS.includes(defaults.capacityKw ?? 0) ? defaults.capacityKw : 3;
  const systemType = defaults.systemType && defaults.systemType in REQUESTED_SYSTEM_TYPE_LABELS ? defaults.systemType : "on_grid";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Full name" name="name" required>
        <Input id="name" name="name" autoComplete="name" required maxLength={80} />
      </FormField>
      <FormField label="Mobile number" name="phone" required hint="10-digit Indian mobile number">
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder="98480 12345"
          pattern="[+0-9 \-]{10,16}"
        />
      </FormField>
      <FormField label="Email" name="email">
        <Input id="email" name="email" type="email" autoComplete="email" />
      </FormField>
      <FormField label="Property" name="customerType">
        <Select id="customerType" name="customerType" defaultValue="residential">
          {options(CUSTOMER_TYPE_LABELS).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Address" name="addressLine" className="sm:col-span-2">
        <Input id="addressLine" name="addressLine" autoComplete="street-address" maxLength={200} placeholder="House no., street, colony" />
      </FormField>
      <FormField label="City / locality" name="city" required>
        <Input id="city" name="city" autoComplete="address-level2" required maxLength={60} placeholder="Kukatpally, Hyderabad" />
      </FormField>
      <FormField label="PIN code" name="pincode" required>
        <Input
          id="pincode"
          name="pincode"
          inputMode="numeric"
          autoComplete="postal-code"
          required
          pattern="[1-9][0-9]{5}"
          maxLength={6}
          placeholder="500072"
        />
      </FormField>
      <FormField label="System size" name="capacityKw" required hint="Rule of thumb: 1 kW offsets about ₹1,000 of monthly bill.">
        <Select id="capacityKw" name="capacityKw" defaultValue={String(capacity)}>
          {CAPACITY_OPTIONS.map((kw) => (
            <option key={kw} value={kw}>
              {kw} kW
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="System type" name="systemType" required>
        <Select id="systemType" name="systemType" defaultValue={systemType}>
          {options(REQUESTED_SYSTEM_TYPE_LABELS).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Monthly electricity bill (₹)" name="monthlyBillRs">
        <Input id="monthlyBillRs" name="monthlyBillRs" type="number" inputMode="numeric" min={0} step={50} placeholder="2800" />
      </FormField>
      {withSource ? (
        <FormField label="Came in via" name="source" required>
          <Select id="source" name="source" defaultValue="whatsapp">
            {options(LEAD_SOURCE_LABELS).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormField>
      ) : null}
      <FormField label="Anything else we should know?" name="message" className="sm:col-span-2">
        <Textarea id="message" name="message" rows={3} maxLength={1000} placeholder="Roof type, best time to call, subsidy questions…" />
      </FormField>
      <div className="flex items-start gap-3 sm:col-span-2">
        <Checkbox id="wantsSubsidy" name="wantsSubsidy" defaultChecked className="mt-0.5" />
        <label htmlFor="wantsSubsidy" className="text-sm leading-snug text-foreground">
          Help me with the <span className="font-medium">PM Surya Ghar</span> subsidy (up to ₹78,000 for homes with on-grid systems)
        </label>
      </div>
    </div>
  );
}
