import {
  formatCkb,
  formatRelativeTime,
  parseHexU128,
  paymentActivityTitle,
  paymentStatusTone,
} from "../../lib/fnn/format"
import type { HomePayment } from "../../lib/fnn/types"
import { Subheading } from "../ui/heading"
import { StatusDot } from "../layout/StatusDot"
import { Text } from "../ui/text"
import { HomeEmptyState } from "./HomeEmptyState"

type RecentActivitySectionProps = {
  payments: HomePayment[]
  available: boolean
}

function paymentDetail(payment: HomePayment): string {
  const fee = formatCkb(parseHexU128(payment.fee))
  if (payment.failedError) {
    return `${payment.failedError} · fee ${fee} CKB`
  }
  return `fee ${fee} CKB · ${payment.paymentHash.slice(0, 10)}…`
}

export function RecentActivitySection({
  payments,
  available,
}: RecentActivitySectionProps) {
  return (
    <section className="rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
      <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <Subheading level={3}>Recent activity</Subheading>
      </div>

      {!available ? (
        <HomeEmptyState
          title="No recent activity"
          description="Payment history appears here once your node is running."
        />
      ) : payments.length === 0 ? (
        <HomeEmptyState
          title="No payments yet"
          description="Send a payment to see activity here."
        />
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
                  <p className="text-sm font-medium text-zinc-950 dark:text-white">
                    {paymentActivityTitle(payment.status)}
                  </p>
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
