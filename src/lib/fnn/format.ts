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

export function isChannelPending(state: string): boolean {
  return (
    state !== "ChannelReady" &&
    state !== "ShuttingDown" &&
    state !== "Closed"
  )
}

export function canAbandonChannel(state: string): boolean {
  return isChannelPending(state)
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

export type InvoiceBadgeColor = "green" | "amber" | "red" | "zinc"

export function invoiceStatusTone(status: string): InvoiceBadgeColor {
  switch (status) {
    case "Open":
      return "green"
    case "Received":
      return "amber"
    case "Expired":
    case "Cancelled":
      return "zinc"
    case "Paid":
      return "green"
    default:
      return "zinc"
  }
}

export function invoiceStatusDisplayLabel(status: string): string {
  switch (status) {
    case "Open":
      return "Awaiting payment"
    case "Received":
      return "Payment incoming"
    case "Paid":
      return "Paid"
    case "Expired":
      return "Expired"
    case "Cancelled":
      return "Cancelled"
    default:
      return status
  }
}

export function invoiceStatusDescription(status: string): string | null {
  switch (status) {
    case "Open":
      return "Share the invoice string with the payer."
    case "Received":
      return "A payer started this payment — settlement may still be in progress."
    case "Paid":
      return "Payment settled on the Fiber network."
    case "Expired":
      return "This invoice expired before payment."
    case "Cancelled":
      return "This invoice was cancelled and can no longer be paid."
    default:
      return null
  }
}

export function truncateLockScriptArgs(args: string): string {
  const trimmed = args.startsWith("0x") ? args.slice(2) : args
  if (trimmed.length <= 12) return `0x${trimmed}`
  return `0x${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`
}

export function invoiceCurrencyLabel(
  network: string | null | undefined,
): string {
  return network === "mainnet" ? "Fibb" : "Fibt"
}

export function paymentRouteTitle(hopCount: number): string {
  if (hopCount > 1) return "Multi-hop route"
  if (hopCount === 1) return "Direct route"
  return "Route"
}

export function paymentRouteBadgeLabel(hopCount: number): string {
  return hopCount > 1 ? "Multi-hop" : "Direct"
}

export function paymentKindLabel(kind: string): string {
  switch (kind) {
    case "invoice":
      return "Invoice"
    case "keysend":
      return "Keysend"
    default:
      return "Payment"
  }
}

export type InvoiceListFilter = "active" | "paid" | "all"

export function filterInvoices<T extends { status: string }>(
  invoices: T[],
  filter: InvoiceListFilter,
): T[] {
  switch (filter) {
    case "active":
      return invoices.filter(
        (invoice) => invoice.status === "Open" || invoice.status === "Received",
      )
    case "paid":
      return invoices.filter((invoice) => invoice.status === "Paid")
    case "all":
      return invoices
    default: {
      const exhaustive: never = filter
      return exhaustive
    }
  }
}

export function formatRouteHopsShort(hops: string[], maxHops = 3): string {
  if (hops.length === 0) return "—"
  const truncated = hops.map((pubkey) =>
    pubkey.length > 12 ? `${pubkey.slice(0, 6)}…${pubkey.slice(-4)}` : pubkey,
  )
  if (truncated.length <= maxHops) {
    return truncated.join(" → ")
  }
  return `${truncated.slice(0, maxHops).join(" → ")} → …`
}
