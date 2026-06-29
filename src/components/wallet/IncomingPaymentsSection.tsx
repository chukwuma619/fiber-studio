import {
  invoiceStatusDisplayLabel,
  invoiceStatusTone,
} from "../../lib/fnn/format"
import type { WalletInvoiceItem } from "../../lib/fnn/types"
import { StatusDot } from "../layout/StatusDot"
import { Badge } from "../ui/badge"
import { Subheading } from "../ui/heading"
import { Text } from "../ui/text"
import { HomeEmptyState } from "../home/HomeEmptyState"

type IncomingPaymentsSectionProps = {
  invoices: WalletInvoiceItem[]
  available: boolean
  onSelectInvoice: (invoice: WalletInvoiceItem) => void
}

function invoiceStatusDotTone(
  status: string,
): "running" | "warning" | "danger" | "info" {
  switch (status) {
    case "Paid":
      return "running"
    case "Received":
      return "warning"
    default:
      return "info"
  }
}

function sortIncomingInvoices(invoices: WalletInvoiceItem[]): WalletInvoiceItem[] {
  const priority = (status: string) => {
    if (status === "Received") return 0
    if (status === "Paid") return 1
    return 2
  }

  return [...invoices].sort((left, right) => priority(left.status) - priority(right.status))
}

function selectIncomingInvoices(invoices: WalletInvoiceItem[]): WalletInvoiceItem[] {
  const received = invoices.filter((invoice) => invoice.status === "Received")
  const recentlyPaid = invoices
    .filter((invoice) => invoice.status === "Paid")
    .slice(0, 8)

  return sortIncomingInvoices([...received, ...recentlyPaid])
}

export function IncomingPaymentsSection({
  invoices,
  available,
  onSelectInvoice,
}: IncomingPaymentsSectionProps) {
  const incoming = selectIncomingInvoices(invoices)
  const activeIncoming = incoming.filter((invoice) => invoice.status === "Received")

  return (
    <section className="rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
      <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <Subheading level={3}>Incoming payments</Subheading>
        <Text className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {activeIncoming.length > 0
            ? `${activeIncoming.length} payment${activeIncoming.length === 1 ? "" : "s"} settling — status refreshes automatically`
            : "Payments received on your invoices appear here"}
        </Text>
      </div>

      {!available ? (
        <HomeEmptyState
          title="No incoming payments"
          description="Start your node to track payments on your invoices."
        />
      ) : incoming.length === 0 ? (
        <HomeEmptyState
          title="No incoming payments yet"
          description="When someone pays one of your invoices, it shows up here as Payment incoming, then Paid."
        />
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {incoming.map((invoice) => (
            <li key={invoice.paymentHash}>
              <button
                type="button"
                className="flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                onClick={() => onSelectInvoice(invoice)}
              >
                <div className="mt-1.5">
                  <StatusDot tone={invoiceStatusDotTone(invoice.status)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium tabular-nums text-zinc-950 dark:text-white">
                        {invoice.amountCkb}
                      </span>
                      <Badge color={invoiceStatusTone(invoice.status)}>
                        {invoiceStatusDisplayLabel(invoice.status)}
                      </Badge>
                    </div>
                    <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                      {invoice.expiresIn ?? (invoice.status === "Paid" ? "Settled" : "—")}
                    </span>
                  </div>
                  <Text className="mt-0.5 truncate text-xs text-zinc-600 dark:text-zinc-400">
                    {invoice.note !== "—" ? invoice.note : "Invoice payment"}
                  </Text>
                  {invoice.status === "Received" ? (
                    <Text className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      Settlement in progress — click for invoice details and QR code
                    </Text>
                  ) : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
