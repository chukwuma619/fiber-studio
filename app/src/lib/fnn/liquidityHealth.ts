import { formatCkb, parseHexU128 } from "./format"
import type { AssetView, HomeChannel } from "./types"

/** Matches `CKB_REBALANCE_RESERVE` in the Rust rebalance planner. */
export const CKB_REBALANCE_RESERVE_SHANNONS = 100_000_000n
export const UDT_REBALANCE_RESERVE = 1n

export type LiquidityHealthKind =
  | "balanced"
  | "outbound_heavy"
  | "inbound_heavy"
  | "skewed_outbound"
  | "skewed_inbound"
  | "pending"

export type LiquidityHealth = {
  kind: LiquidityHealthKind
  score: number
  localPercent: number
  warning: boolean
  label: string
  description: string
}

export function channelLiquidityHealth(channel: HomeChannel): LiquidityHealth {
  if (channel.state !== "ChannelReady") {
    return {
      kind: "pending",
      score: 0,
      localPercent: channel.localPercent,
      warning: false,
      label: "—",
      description: "Liquidity health is available after the channel is ready.",
    }
  }

  const localPercent = channel.localPercent
  const score = Math.max(0, 100 - 2 * Math.abs(localPercent - 50))
  const kind = healthKindForPercent(localPercent)
  const warning = kind === "skewed_outbound" || kind === "skewed_inbound"

  return {
    kind,
    score,
    localPercent,
    warning,
    label: healthKindLabel(kind),
    description: healthKindDescription(kind),
  }
}

function healthKindForPercent(localPercent: number): Exclude<LiquidityHealthKind, "pending"> {
  if (localPercent > 85) return "skewed_outbound"
  if (localPercent < 15) return "skewed_inbound"
  if (localPercent > 65) return "outbound_heavy"
  if (localPercent < 35) return "inbound_heavy"
  return "balanced"
}

export function healthKindLabel(kind: LiquidityHealthKind): string {
  switch (kind) {
    case "balanced":
      return "Balanced"
    case "outbound_heavy":
      return "Outbound-heavy"
    case "inbound_heavy":
      return "Inbound-heavy"
    case "skewed_outbound":
      return "Low inbound"
    case "skewed_inbound":
      return "Low outbound"
    case "pending":
      return "—"
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

export function healthKindDescription(kind: LiquidityHealthKind): string {
  switch (kind) {
    case "balanced":
      return "Near a 50/50 split — this channel can send and receive."
    case "outbound_heavy":
      return "Most funds are on your side. You can send, but incoming payments are limited."
    case "inbound_heavy":
      return "Most funds are on the peer side. You can receive, but outgoing payments are limited."
    case "skewed_outbound":
      return "Almost no inbound capacity. Rebalance toward another channel so you can receive again."
    case "skewed_inbound":
      return "Almost no outbound capacity. Rebalance from another channel so you can send again."
    case "pending":
      return "Liquidity health is available after the channel is ready."
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

export function healthBadgeColor(
  kind: LiquidityHealthKind,
): "green" | "amber" | "sky" | "zinc" {
  switch (kind) {
    case "balanced":
      return "green"
    case "outbound_heavy":
    case "inbound_heavy":
      return "sky"
    case "skewed_outbound":
    case "skewed_inbound":
      return "amber"
    case "pending":
      return "zinc"
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

export function channelsShareAsset(left: HomeChannel, right: HomeChannel): boolean {
  if (left.assetSymbol !== right.assetSymbol) return false
  const leftScript = left.fundingUdtTypeScript
  const rightScript = right.fundingUdtTypeScript
  if (!leftScript && !rightScript) return true
  if (!leftScript || !rightScript) return false
  return (
    leftScript.codeHash.toLowerCase() === rightScript.codeHash.toLowerCase() &&
    leftScript.hashType.toLowerCase() === rightScript.hashType.toLowerCase() &&
    leftScript.args.toLowerCase() === rightScript.args.toLowerCase()
  )
}

export function readySameAssetChannels(
  channels: HomeChannel[],
  reference: HomeChannel,
): HomeChannel[] {
  return channels.filter(
    (channel) =>
      channel.state === "ChannelReady" && channelsShareAsset(channel, reference),
  )
}

export function suggestRebalanceCounterpart(
  focus: HomeChannel,
  channels: HomeChannel[],
): HomeChannel | null {
  const candidates = readySameAssetChannels(channels, focus).filter(
    (channel) => channel.channelId !== focus.channelId,
  )
  if (candidates.length === 0) return null

  const health = channelLiquidityHealth(focus)
  switch (health.kind) {
    case "inbound_heavy":
    case "skewed_inbound":
      return [...candidates].sort((left, right) => right.localPercent - left.localPercent)[0] ?? null
    case "outbound_heavy":
    case "skewed_outbound":
    case "balanced":
    case "pending":
      return [...candidates].sort((left, right) => left.localPercent - right.localPercent)[0] ?? null
    default: {
      const unreachable: never = health.kind
      return unreachable
    }
  }
}

export function rebalanceRolesForFocus(focus: HomeChannel): {
  sourceId: string
  targetId: string | null
} {
  const health = channelLiquidityHealth(focus)
  switch (health.kind) {
    case "inbound_heavy":
    case "skewed_inbound":
      return { sourceId: "", targetId: focus.channelId }
    case "outbound_heavy":
    case "skewed_outbound":
    case "balanced":
    case "pending":
      return { sourceId: focus.channelId, targetId: null }
    default: {
      const unreachable: never = health.kind
      return unreachable
    }
  }
}

export function rebalanceDisabledReason(
  channel: HomeChannel | null,
  channels: HomeChannel[],
  running: boolean,
): string | null {
  if (!running) {
    return "Start your node before rebalancing a channel."
  }
  if (!channel) {
    return "Select a channel to rebalance."
  }
  if (channel.state !== "ChannelReady") {
    return "Only ready channels can be rebalanced."
  }
  const sameAssetReady = readySameAssetChannels(channels, channel)
  if (sameAssetReady.length < 2) {
    return "Need at least two ready channels in this asset to rebalance."
  }
  return null
}

function channelReserve(balance: bigint, isCkb: boolean): bigint {
  if (isCkb) {
    if (balance > CKB_REBALANCE_RESERVE_SHANNONS * 2n) {
      return CKB_REBALANCE_RESERVE_SHANNONS
    }
    return balance > 0n ? 1n : 0n
  }
  return balance > UDT_REBALANCE_RESERVE ? UDT_REBALANCE_RESERVE : 0n
}

export function maxRebalanceAmountRaw(
  source: HomeChannel,
  target: HomeChannel,
): bigint {
  const isCkb = source.assetSymbol === "CKB"
  const sourceLocal = parseHexU128(source.localBalance)
  const targetRemote = parseHexU128(target.remoteBalance)
  const spendable = sourceLocal - channelReserve(sourceLocal, isCkb)
  const receivable = targetRemote - channelReserve(targetRemote, isCkb)
  if (spendable <= 0n || receivable <= 0n) return 0n
  return spendable < receivable ? spendable : receivable
}

export function suggestedRebalanceAmountRaw(
  source: HomeChannel,
  target: HomeChannel,
): bigint {
  const sourceLocal = parseHexU128(source.localBalance)
  const sourceRemote = parseHexU128(source.remoteBalance)
  const capacity = sourceLocal + sourceRemote
  const midpoint = capacity / 2n
  const excess = sourceLocal > midpoint ? sourceLocal - midpoint : 0n
  const maxAmount = maxRebalanceAmountRaw(source, target)
  if (excess === 0n) return maxAmount
  return excess < maxAmount ? excess : maxAmount
}

export function formatAssetAmount(raw: bigint, asset: AssetView): string {
  if (asset.decimals === 0) return raw.toString()
  if (asset.symbol === "CKB") return formatCkb(raw)

  const scale = 10n ** BigInt(asset.decimals)
  const whole = raw / scale
  const fraction = raw % scale
  const fractionStr = fraction.toString().padStart(asset.decimals, "0").replace(/0+$/, "")
  return fractionStr ? `${whole}.${fractionStr}` : whole.toString()
}

export function suggestedRebalanceAmount(
  source: HomeChannel,
  target: HomeChannel,
  asset: AssetView,
): string {
  const raw = suggestedRebalanceAmountRaw(source, target)
  if (raw === 0n) return ""
  return formatAssetAmount(raw, asset)
}

