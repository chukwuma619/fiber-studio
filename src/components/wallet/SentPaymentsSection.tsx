import {
  formatCkb,
  formatRelativeTime,
  parseHexU128,
  paymentStatusTone,
} from "../../lib/fnn/format"
import type { WalletPaymentItem } from "../../lib/fnn/types"
import { StatusDot } from "../layout/StatusDot"
import { Badge } from "../ui/badge"
import { Subheading } from "../ui/heading"
import { Text } from "../ui/text"

type SentPaymentsSectionProps = {
  payments: WalletPaymentItem[]
  available: boolean
}

function paymentDetail(payment: WalletPaymentItem): string {
  const fee = formatCkb(parseHexU128(payment.fee))
  if (payment.failedError) {
    return `${payment.failedError} · fee ${fee} CKB`
  }
  return `fee ${fee} CKB · ${payment.paymentHash.slice(0, 10)}…`
}

function paymentStatusBadgeColor(
  status: string,
): "green" | "amber" | "red" | "zinc" | "sky" {
  switch (status) {
    case "Success":
      return "green"
    case "Failed":
      return "red"
    case "Inflight":
      return "amber"
    case "Created":
      return "sky"
    default:
      return "zinc"
  }
}

export function SentPaymentsSection({
  payments,
  available,
}: SentPaymentsSectionProps) {
  return (
    <section className="rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
      <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <Subheading level={3}>Sent payments</Subheading>
        <Text className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Outbound payment history from FNN list_payments
        </Text>
      </div>

      {!available ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-medium text-zinc-950 dark:text-white">
            No payments yet
          </p>
          <Text className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Start your node to view sent payments.
          </Text>
        </div>
      ) : payments.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-medium text-zinc-950 dark:text-white">
            No payments yet
          </p>
          <Text className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Payments appear here after you send an invoice.
          </Text>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {payments.map((payment) => (
            <li
              key={payment.paymentHash}
              className="flex items-start gap-4 px-5 py-4"
            >
              <div className="mt-1.5">
                <StatusDot tone={paymentStatusTone(payment.status)} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <Badge color={paymentStatusBadgeColor(payment.status)}>
                    {payment.status}
                  </Badge>
                  <time className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                    {formatRelativeTime(payment.lastUpdatedAt)}
                  </time>
                </div>
                <Text className="mt-0.5 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                  {paymentDetail(payment)}
                </Text>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
