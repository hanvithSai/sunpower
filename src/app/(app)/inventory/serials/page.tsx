/**
 * Serial register: every panel, inverter, battery and charge controller by
 * serial number — where it is, which goods receipt it came on, which customer
 * it went to and when its warranty ends, with every move it made. The
 * director can write off a damaged unit that is still on the shelf.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { ScanBarcode } from "lucide-react";
import { InventoryNav } from "@/components/modules/inventory/inventory-nav";
import { WriteOffSerialDialog } from "@/components/modules/inventory/stock-correction-dialogs";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SERIAL_STATUSES, statusMeta } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { first, type SearchParamsRecord } from "@/lib/query";
import { requireUser } from "@/server/auth/session";
import { listSerials } from "@/server/services/inventory";

export const metadata: Metadata = { title: "Serial register" };

export default async function SerialsPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireUser(["warehouse"]);
  const sp = await searchParams;
  const data = await listSerials({ status: first(sp.status), q: first(sp.q), page: Number(first(sp.page)) || 1 });

  return (
    <>
      <PageHeader title="Inventory" description="Every serial-tracked unit: where it is, who has it, and when its warranty ends." />
      <InventoryNav active="serials" />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs
          param="status"
          options={SERIAL_STATUSES.filter((s) => (data.counts[s] ?? 0) > 0).map((s) => ({ value: s, label: statusMeta("serial", s).label, count: data.counts[s] ?? 0 }))}
        />
        <div className="w-full lg:w-80">
          <SearchInput placeholder="Serial (or last 4), SKU or product" />
        </div>
      </div>

      {data.items.length === 0 ? (
        <EmptyState icon={ScanBarcode} title="No serials here" description="Serial numbers are registered when goods are received." />
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Customer</TableHead>
                  <TableHead className="hidden lg:table-cell">Received</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Warranty ends</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <p className="font-mono text-sm font-medium text-foreground">{u.serial}</p>
                      <p className="text-xs text-muted-foreground">{u.productName}</p>
                      {u.history.length ? (
                        <details className="mt-1 text-xs">
                          <summary className="cursor-pointer text-primary">History ({u.history.length})</summary>
                          <ol className="mt-1 space-y-1 border-l border-border pl-3">
                            {u.history.map((h, i) => (
                              <li key={i}>
                                <span className="text-foreground">{h.note ?? statusMeta("serial", h.status).label}</span>
                                <span className="block text-muted-foreground">
                                  {formatDateTime(h.at)}
                                  {h.by ? ` · ${h.by}` : ""}
                                </span>
                              </li>
                            ))}
                          </ol>
                        </details>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="serial" status={u.status} />
                      {user.role === "admin" && u.status === "in_stock" ? (
                        <div className="mt-1">
                          <WriteOffSerialDialog serial={u.serial} productName={u.productName} />
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {u.customerName ? (
                        <>
                          <p className="text-sm">{u.customerName}</p>
                          <p className="text-xs text-muted-foreground">
                            {u.orderId ? (
                              <Link href={`/orders/${u.orderId}`} className="font-mono hover:text-primary">
                                {u.orderNumber}
                              </Link>
                            ) : null}
                            {u.city ? ` · ${u.city}` : ""}
                          </p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <p className="font-mono text-xs">{u.purchaseNumber ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">Cost {formatINR(u.costPaise)}</p>
                    </TableCell>
                    <TableCell className="hidden text-right sm:table-cell">
                      {u.warrantyEndAt ? (
                        <>
                          <p className="tabular-nums">{formatDate(u.warrantyEndAt)}</p>
                          <p className="text-xs text-muted-foreground">from {formatDate(u.warrantyStartAt)}</p>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Starts on delivery</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} />
        </div>
      )}
    </>
  );
}
