import {
  channelLiquidityHealth,
  healthBadgeColor,
} from "../../lib/fnn/liquidityHealth"
import type { HomeChannel } from "../../lib/fnn/types"
import { Badge } from "../ui/badge"
import { CapacityBar } from "../ui/capacity-bar"
import { HelpTooltip } from "../ui/help-tooltip"

type LiquidityHealthIndicatorProps = {
  channel: HomeChannel
  compact?: boolean
}

export function LiquidityHealthIndicator({
  channel,
  compact = false,
}: LiquidityHealthIndicatorProps) {
  const health = channelLiquidityHealth(channel)

  if (health.kind === "pending") {
    return <span className="text-xs text-zinc-500 dark:text-zinc-400">—</span>
  }

  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      <CapacityBar percent={channel.localPercent} />
      <div className="flex items-center gap-1">
        <Badge color={healthBadgeColor(health.kind)}>{health.label}</Badge>
        <HelpTooltip
          content={`${health.score}/100 toward a 50/50 split. ${health.description}`}
          label="Liquidity health"
        />
      </div>
    </div>
  )
}
