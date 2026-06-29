import { Badge } from "../ui/badge"
import { Text } from "../ui/text"
import type { PreviewSendPaymentResult } from "../../lib/fnn/types"
import { paymentRouteTitle } from "../../lib/fnn/format"
import { truncatePubkey } from "../../lib/public-relays"

type PaymentRoutePreviewProps = {
  preview: PreviewSendPaymentResult | null
  isLoading?: boolean
  error?: string | null
  compact?: boolean
  emptyHint?: string
}

export function PaymentRoutePreview({
  preview,
  isLoading = false,
  error = null,
  compact = false,
  emptyHint = "Enter payment details to preview the route",
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
      <div
        className={`rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 ${
          compact ? "px-3 py-2.5" : "px-4 py-3"
        }`}
      >
        <Text className="text-xs text-red-700 dark:text-red-300">{error}</Text>
      </div>
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
      <p className="mt-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
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
