import { useState } from "react"
import {
  formatCkb,
  formatRelativeTime,
  formatRouteHopsShort,
  parseHexU128,
  paymentKindLabel,
  paymentRouteBadgeLabel,
  paymentStatusTone,
} from "../../lib/fnn/format"
import type { WalletPaymentItem } from "../../lib/fnn/types"
import { StatusDot } from "../layout/StatusDot"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Subheading } from "../ui/heading"
import { Text } from "../ui/text"
import { PaymentDetailDialog } from "./PaymentDetailDialog"

type SentPaymentsSectionProps = {
  payments: WalletPaymentItem[]
  available: boolean
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
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

function paymentSummaryLine(payment: WalletPaymentItem): string {
  const fee = formatCkb(parseHexU128(payment.fee))
  const route =
    payment.routeHops.length > 0
      ? formatRouteHopsShort(payment.routeHops)
      : null

  if (payment.failedError) {
    return `${payment.failedError} · fee ${fee} CKB`
  }

  const parts = [
    payment.amountCkb ?? null,
    route ? `route ${route}` : null,
    `fee ${fee} CKB`,
  ].filter(Boolean)

  return parts.join(" · ")
}

export function SentPaymentsSection({
  payments,
  available,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: SentPaymentsSectionProps) {
  const [selectedPayment, setSelectedPayment] = useState<WalletPaymentItem | null>(
    null,
  )

  return (
    <>
      <section className="rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <Subheading level={3}>Sent payments</Subheading>
          <Text className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Outbound payments — click a row for amount, route, and fee details
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
              Payments appear here after you send one (invoice or keysend).
            </Text>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {payments.map((payment) => (
                <li key={payment.paymentHash}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                    onClick={() => setSelectedPayment(payment)}
                  >
                    <div className="mt-1.5">
                      <StatusDot tone={paymentStatusTone(payment.status)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {payment.amountCkb ? (
                            <span className="text-sm font-medium tabular-nums text-zinc-950 dark:text-white">
                              {payment.amountCkb}
                            </span>
                          ) : null}
                          <Badge color="sky">
                            {paymentKindLabel(payment.paymentKind)}
                          </Badge>
                          {payment.routeHops.length > 0 ? (
                            <Badge color="zinc">
                              {paymentRouteBadgeLabel(payment.routeHops.length)}
                            </Badge>
                          ) : null}
                          <Badge color={paymentStatusBadgeColor(payment.status)}>
                            {payment.status}
                          </Badge>
                        </div>
                        <time className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                          {formatRelativeTime(payment.lastUpdatedAt)}
                        </time>
                      </div>
                      <Text className="mt-0.5 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                        {paymentSummaryLine(payment)}
                      </Text>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            {hasMore ? (
              <div className="border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
                <Button
                  outline
                  className="w-full text-xs"
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? "Loading…" : "Load more payments"}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <PaymentDetailDialog
        open={selectedPayment !== null}
        payment={selectedPayment}
        onClose={() => setSelectedPayment(null)}
      />
    </>
  )
}
