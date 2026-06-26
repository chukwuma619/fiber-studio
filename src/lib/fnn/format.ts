import { CHANNEL_RESERVE_CKB } from "../public-relays"

const SHANNONS_PER_CKB = 100_000_000n

export { CHANNEL_RESERVE_CKB }

export function parseHexU128(hex: string): bigint {
  const trimmed = hex.startsWith("0x") ? hex.slice(2) : hex
  if (!trimmed) return 0n
  return BigInt(`0x${trimmed}`)
}

export function formatCkb(shannons: bigint | string): string {
  const value = typeof shannons === "string" ? parseHexU128(shannons) : shannons
  const whole = value / SHANNONS_PER_CKB
  const fraction = value % SHANNONS_PER_CKB
  const fractionStr = fraction.toString().padStart(8, "0").replace(/0+$/, "")
  if (!fractionStr) {
    return whole.toString()
  }
  const decimals = fractionStr.slice(0, 2).padEnd(2, "0")
  return `${whole}.${decimals}`
}

export function formatRelativeTime(timestampMs: number): string {
  const deltaMs = Date.now() - timestampMs
  if (deltaMs < 0) return "just now"

  const minutes = Math.floor(deltaMs / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`

  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}

export function channelStatusLabel(state: string, localPercent: number): string {
  if (state !== "ChannelReady") {
    return channelStateDisplayLabel(state)
  }
  if (localPercent < 15) return "Low"
  return "Active"
}

export function channelStateDisplayLabel(state: string): string {
  switch (state) {
    case "ChannelReady":
      return "Ready"
    case "AwaitingTxSignatures":
      return "Awaiting signatures"
    case "NegotiatingFunding":
      return "Opening"
    case "ShuttingDown":
      return "Closing"
    default:
      return state.replace(/([A-Z])/g, " $1").trim()
  }
}

export function canAbandonChannel(state: string): boolean {
  return (
    state !== "ChannelReady" &&
    state !== "ShuttingDown" &&
    state !== "Closed"
  )
}

export function canCloseChannel(state: string): boolean {
  return state === "ChannelReady"
}

export type ChannelBadgeColor = "green" | "amber" | "red" | "zinc"

export function channelStateBadgeColor(
  state: string,
  localPercent: number,
): ChannelBadgeColor {
  if (state === "ShuttingDown") return "red"
  if (state !== "ChannelReady") return "amber"
  if (localPercent < 15) return "amber"
  return "green"
}

export function ckbToShannons(ckb: number): bigint {
  return BigInt(ckb) * SHANNONS_PER_CKB
}


export const CHANNEL_OPEN_FEE_BUFFER_CKB = 10

export function requiredWalletCkbForOpen(fundingCkb: number): number {
  return fundingCkb + CHANNEL_RESERVE_CKB + CHANNEL_OPEN_FEE_BUFFER_CKB
}

export function paymentStatusTone(
  status: string,
): "running" | "warning" | "danger" | "info" {
  switch (status) {
    case "Success":
      return "running"
    case "Failed":
      return "danger"
    case "Inflight":
      return "warning"
    case "Created":
      return "info"
    default:
      return "info"
  }
}

export function paymentActivityTitle(status: string): string {
  switch (status) {
    case "Success":
      return "Payment completed"
    case "Failed":
      return "Payment failed"
    case "Inflight":
      return "Payment in flight"
    case "Created":
      return "Payment created"
    default:
      return `Payment ${status.toLowerCase()}`
  }
}
