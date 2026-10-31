/**
 * Table view of leads — denser than the board, with every lead paginated.
 */
import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { REQUESTED_SYSTEM_TYPE_LABELS } from "@/lib/constants";
import { formatPhone, formatRelative } from "@/lib/format";
import type { LeadRow } from "@/server/services/leads";
import { SlaBadge, SourceLabel } from "./lead-badges";

export function LeadTable({ rows, now }: { rows: LeadRow[]; now: Date }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lead</TableHead>
          <TableHead className="hidden md:table-cell">Phone</TableHead>
          <TableHead>Requirement</TableHead>
          <TableHead className="hidden lg:table-cell">Source</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden lg:table-cell">Owner</TableHead>
          <TableHead className="text-right">Received</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((lead) => (
          <TableRow key={lead.id}>
            <TableCell>
              <Link href={`/leads/${lead.id}`} className="font-medium text-foreground hover:text-primary">
                {lead.name}
              </Link>
              <p className="text-xs text-muted-foreground">
                <span className="font-mono">{lead.number}</span> · {lead.city}
              </p>
            </TableCell>
            <TableCell className="hidden whitespace-nowrap md:table-cell">{formatPhone(lead.phone)}</TableCell>
            <TableCell className="whitespace-nowrap">
              {lead.capacityKw} kW · {REQUESTED_SYSTEM_TYPE_LABELS[lead.systemType].split(" (")[0]}
            </TableCell>
            <TableCell className="hidden lg:table-cell">
              <SourceLabel source={lead.source} />
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge kind="lead" status={lead.status} />
                <SlaBadge waitingHours={lead.waitingHours} />
              </div>
            </TableCell>
            <TableCell className="hidden lg:table-cell">{lead.assignedToName ?? <span className="text-muted-foreground">—</span>}</TableCell>
            <TableCell className="whitespace-nowrap text-right text-muted-foreground">{formatRelative(lead.createdAt, now)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
