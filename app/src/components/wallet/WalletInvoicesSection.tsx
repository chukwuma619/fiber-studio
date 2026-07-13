import {
  filterInvoices,
  invoiceCurrencyLabel,
  invoiceStatusDisplayLabel,
  invoiceStatusDotTone,
  invoiceStatusTone,
  type InvoiceListFilter,
} from "../../lib/fnn/format"
import type { NodeStatusState, WalletInvoiceItem } from "../../lib/fnn/types"
import { nodeUnavailableEmptyState } from "../../lib/fnn/nodeEmptyState"
import { HomeEmptyState } from "../home/HomeEmptyState"
import { StatusDot } from "../layout/StatusDot"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Subheading } from "../ui/heading"
import { TableRowsSkeleton } from "../ui/skeleton"
import { Text } from "../ui/text"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table"

type WalletInvoicesSectionProps = {
  status: NodeStatusState | null
  running: boolean
  available: boolean
  isWalletLoading: boolean
  network: string | null
  invoices: WalletInvoiceItem[]
  invoiceFilter: InvoiceListFilter
  onInvoiceFilterChange: (filter: InvoiceListFilter) => void
  onSelectInvoice: (invoice: WalletInvoiceItem) => void
  onImport: () => void
  onCreate: () => void
}

export function WalletInvoicesSection({
  status,
  running,
  available,
  isWalletLoading,
  network,
  invoices,
  invoiceFilter,
  onInvoiceFilterChange,
  onSelectInvoice,
  onImport,
  onCreate,
}: WalletInvoicesSectionProps) {
  const invoiceCurrency = invoiceCurrencyLabel(network)
  const filteredInvoices = filterInvoices(invoices, invoiceFilter)
  const nodeUnavailable = !running
    ? nodeUnavailableEmptyState(
        status,
        "Start your node to create and manage invoices.",
      )
    : null

  return (
    <section className="rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <div>
          <Subheading level={3}>Receive & invoices</Subheading>
          <Text className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Invoices you create to receive CKB over Fiber.
          </Text>
        </div>
        <div className="flex gap-2">
          <Button outline className="text-xs" onClick={onImport} disabled={!running}>
            Import
          </Button>
          <Button outline className="text-xs" onClick={onCreate} disabled={!running}>
            Create invoice
          </Button>
        </div>
      </div>

      {available && invoices.length > 0 ? (
        <div
          role="tablist"
          aria-label="Invoice filters"
          className="flex gap-1 border-b border-zinc-200 px-5 py-3 dark:border-zinc-800"
        >
          {(
            [
              ["active", "Active"],
              ["paid", "Paid"],
              ["all", "All"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={invoiceFilter === value}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                invoiceFilter === value
                  ? "bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-white"
                  : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
              }`}
              onClick={() => onInvoiceFilterChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {isWalletLoading ? (
        <Table dense>
          <TableHead>
            <TableRow>
              <TableHeader>Amount</TableHeader>
              <TableHeader>Note</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Expires</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRowsSkeleton rows={4} cols={4} />
          </TableBody>
        </Table>
      ) : nodeUnavailable ? (
        <HomeEmptyState
          title={nodeUnavailable.title}
          description={nodeUnavailable.description}
        />
      ) : !available ? (
        <HomeEmptyState
          title="Wallet unavailable"
          description="Your node is running but wallet data could not be loaded."
        />
      ) : filteredInvoices.length === 0 ? (
        <HomeEmptyState
          title={
            invoiceFilter === "active"
              ? "No active invoices"
              : invoiceFilter === "paid"
                ? "No paid invoices"
                : "No invoices yet"
          }
          description={
            invoiceFilter === "active"
              ? `Create a ${invoiceCurrency} invoice to receive CKB over Fiber.`
              : invoiceFilter === "paid"
                ? "Paid invoices appear here after someone pays you."
                : `Create a ${invoiceCurrency} invoice to receive CKB over Fiber.`
          }
          actionLabel={invoiceFilter === "paid" ? undefined : "Create invoice"}
          onAction={invoiceFilter === "paid" ? undefined : onCreate}
        />
      ) : (
        <Table dense>
          <TableHead>
            <TableRow>
              <TableHeader>Amount</TableHeader>
              <TableHeader>Note</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Expires</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredInvoices.map((item) => (
              <TableRow
                key={item.paymentHash}
                tabIndex={0}
                role="button"
                aria-label={`Invoice ${item.amountCkb}, ${invoiceStatusDisplayLabel(item.status)}`}
                className={`cursor-pointer ${
                  item.status === "Received"
                    ? "bg-amber-50/80 hover:bg-amber-100/80 dark:bg-amber-950/25 dark:hover:bg-amber-950/40"
                    : ""
                }`}
                onClick={() => onSelectInvoice(item)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onSelectInvoice(item)
                  }
                }}
              >
                <TableCell className="tabular-nums font-medium">
                  {item.amountCkb}
                </TableCell>
                <TableCell className="text-zinc-600 dark:text-zinc-400">
                  {item.note}
                </TableCell>
                <TableCell>
                  <Badge color={invoiceStatusTone(item.status)}>
                    <StatusDot tone={invoiceStatusDotTone(item.status)} />
                    {invoiceStatusDisplayLabel(item.status)}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums text-zinc-600 dark:text-zinc-400">
                  {item.expiresIn ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
