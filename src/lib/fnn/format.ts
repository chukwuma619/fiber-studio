const SHANNONS_PER_CKB = 100_000_000n

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
    return state.replace(/([A-Z])/g, " $1").trim()
  }
  if (localPercent < 15) return "Low"
  return "Active"
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
