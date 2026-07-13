import {
  formatCkb,
  formatRelativeTime,
  formatRouteHopsShort,
  invoiceStatusDisplayLabel,
  invoiceStatusTone,
  parseHexU128,
  paymentActivityTitle,
  paymentKindLabel,
  paymentRouteBadgeLabel,
  paymentStatusTone,
} from "../../lib/fnn/format"
import type { HomeIncomingInvoice, HomePayment, NodeStatusState } from "../../lib/fnn/types"
import { nodeDataEmptyState } from "../../lib/fnn/nodeEmptyState"
import { Subheading } from "../ui/heading"
import { StatusDot } from "../layout/StatusDot"
import { Badge } from "../ui/badge"
import { Text } from "../ui/text"
import { HomeEmptyState } from "./HomeEmptyState"
import { ActivityListSkeleton } from "../ui/skeleton"

type RecentActivitySectionProps = {
  payments: HomePayment[]
  incomingInvoices: HomeIncomingInvoice[]
  available: boolean
  status: NodeStatusState | null
  isLoading?: boolean
}

function paymentDetail(payment: HomePayment): string {
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

export function RecentActivitySection({
  payments,
  incomingInvoices,
  available,
  status,
  isLoading = false,
}: RecentActivitySectionProps) {
  const hasIncoming = incomingInvoices.length > 0
  const hasPayments = payments.length > 0
  const hasActivity = hasIncoming || hasPayments
  const unavailableState = nodeDataEmptyState(
    status,
    available,
    "Payment history appears here once your node is running.",
  )

  return (
    <section className="rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
      <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <Subheading level={3}>Recent activity</Subheading>
        <Text className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Incoming invoice payments and recent outbound sends
        </Text>
      </div>

      {isLoading ? (
        <ActivityListSkeleton rows={4} />
      ) : unavailableState ? (
        <HomeEmptyState
          title={unavailableState.title}
          description={unavailableState.description}
        />
      ) : !hasActivity ? (
        <HomeEmptyState
          title="No payments yet"
          description="Send a payment or receive on an invoice to see activity here."
        />
      ) : (
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {hasIncoming ? (
            <div>
              <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
                <Text className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Incoming
                </Text>
              </div>
              <ul>
                {incomingInvoices.map((invoice) => (
                  <li
                    key={invoice.paymentHash}
                    className="flex items-start gap-4 px-5 py-4"
                  >
                    <div className="mt-1.5">
                      <StatusDot
                        tone={invoice.status === "Received" ? "warning" : "running"}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium tabular-nums text-zinc-950 dark:text-white">
                            {invoice.amountCkb}
                          </p>
                          <Badge color={invoiceStatusTone(invoice.status)}>
                            {invoiceStatusDisplayLabel(invoice.status)}
                          </Badge>
                        </div>
                      </div>
                      <Text className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {invoice.note !== "—" ? invoice.note : "Invoice payment"}
                      </Text>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {hasPayments ? (
            <div>
              {hasIncoming ? (
                <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
                  <Text className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Sent
                  </Text>
                </div>
              ) : null}
              <ul>
                {payments.map((payment) => (
                  <li
                    key={payment.paymentHash}
                    className="flex items-start gap-4 px-5 py-4"
                  >
                    <div className="mt-1.5">
                      <StatusDot tone={paymentStatusTone(payment.status)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {payment.amountCkb ? (
                            <p className="text-sm font-medium tabular-nums text-zinc-950 dark:text-white">
                              {payment.amountCkb}
                            </p>
                          ) : (
                            <p className="text-sm font-medium text-zinc-950 dark:text-white">
                              {paymentActivityTitle(payment.status)}
                            </p>
                          )}
                          <Badge color="sky">{paymentKindLabel(payment.paymentKind)}</Badge>
                          {payment.routeHops.length > 0 ? (
                            <Badge color="zinc">
                              {paymentRouteBadgeLabel(payment.routeHops.length)}
                            </Badge>
                          ) : null}
                        </div>
                        <time
                          className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400"
                          dateTime={new Date(payment.lastUpdatedAt).toISOString()}
                        >
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
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
