import type { PreviewSendPaymentResult } from "../../lib/fnn/types"
import { paymentErrorSummary, paymentRouteTitle } from "../../lib/fnn/format"
import { truncatePubkey } from "../../lib/public-relays"
import { PageErrorBanner } from "../ui/page-error-banner"
import { Badge } from "../ui/badge"
import { Text } from "../ui/text"

type PaymentRoutePreviewProps = {
  preview: PreviewSendPaymentResult | null
  isLoading?: boolean
  error?: string | null
  compact?: boolean
  emptyHint?: string
  onDismissError?: () => void
}

export function PaymentRoutePreview({
  preview,
  isLoading = false,
  error = null,
  compact = false,
  emptyHint = "Enter payment details to preview the route",
  onDismissError,
}: PaymentRoutePreviewProps) {
  if (isLoading) {
    return (
      <div
        className={`rounded-lg bg-zinc-50 dark:bg-zinc-800/50 ${
          compact ? "px-3 py-2.5" : "px-4 py-3"
        }`}
      >
        <Text className="text-xs text-zinc-500 dark:text-zinc-400">
          Finding route…
        </Text>
      </div>
    )
  }

  if (error) {
    return (
      <PageErrorBanner
        message={paymentErrorSummary(error)}
        onDismiss={onDismissError}
        className={compact ? "px-3 py-2.5 text-xs" : undefined}
      />
    )
  }

  if (!preview || preview.routeHops.length === 0) {
    return (
      <div
        className={`rounded-lg bg-zinc-50 dark:bg-zinc-800/50 ${
          compact ? "px-3 py-2.5" : "px-4 py-3"
        }`}
      >
        <Text className="text-xs text-zinc-500 dark:text-zinc-400">
          {emptyHint}
        </Text>
      </div>
    )
  }

  const hops = preview.routeHops.map((pubkey) => truncatePubkey(pubkey))
  const routeTitle = paymentRouteTitle(preview.routeHops.length)

  return (
    <div
      className={`rounded-lg bg-zinc-50 dark:bg-zinc-800/50 ${
        compact ? "px-3 py-2.5" : "px-4 py-3"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          {routeTitle}
        </p>
        <div className="flex items-center gap-2">
          <Badge color="sky">Off-chain (Fiber)</Badge>
          <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            {preview.feeCkb}
          </span>
        </div>
      </div>
      <p className="mt-2 break-all font-mono text-xs text-zinc-600 dark:text-zinc-400">
        {hops.join(" → ")}
      </p>
      {!compact ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Route found via the Fiber network graph. Requires open channels and
          sufficient liquidity.
        </p>
      ) : null}
    </div>
  )
}
