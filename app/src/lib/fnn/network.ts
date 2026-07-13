import { truncatePubkey } from "../public-relays"
import type { RelayConnectionStatus } from "./types"
import type { StatusDotTone } from "../../components/layout/StatusDot"

export type RelayBadgeColor = "green" | "amber" | "red" | "zinc"

export function relayStatusBadgeColor(
  status: RelayConnectionStatus,
): RelayBadgeColor {
  switch (status) {
    case "connected":
      return "green"
    case "connecting":
      return "amber"
    case "failed":
      return "red"
    case "not_configured":
      return "zinc"
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

export function relayStatusDotTone(status: RelayConnectionStatus): StatusDotTone {
  switch (status) {
    case "connected":
      return "running"
    case "connecting":
      return "warning"
    case "failed":
      return "danger"
    case "not_configured":
      return "stopped"
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

export function graphStatusLabel(
  graphReady: boolean,
  relayStatus: RelayConnectionStatus,
): string {
  if (relayStatus !== "connected") {
    return "Needs saved peer"
  }
  if (graphReady) {
    return "Graph data available"
  }
  return "Syncing graph data"
}

export function graphStatusDotTone(
  graphReady: boolean,
  relayStatus: RelayConnectionStatus,
): StatusDotTone {
  if (relayStatus !== "connected") {
    return "stopped"
  }
  if (graphReady) {
    return "running"
  }
  return "warning"
}

export function graphStatusBadgeColor(
  graphReady: boolean,
  relayStatus: RelayConnectionStatus,
): RelayBadgeColor {
  if (relayStatus !== "connected") {
    return "zinc"
  }
  if (graphReady) {
    return "green"
  }
  return "amber"
}

export function savedPeersStatusLabel(
  connectedCount: number,
  totalCount: number,
): string {
  if (totalCount === 0) {
    return "Saved peers · none"
  }
  return `Saved peers · ${connectedCount}/${totalCount} connected`
}

export function truncateMultiaddr(address: string): string {
  const trimmed = address.trim()
  if (!trimmed) return "—"

  const ip4Match = trimmed.match(/\/ip4\/([^/]+)\/tcp\/(\d+)/)
  if (ip4Match) {
    return `${ip4Match[1]}:${ip4Match[2]}`
  }

  const ip6Match = trimmed.match(/\/ip6\/([^/]+)\/tcp\/(\d+)/)
  if (ip6Match) {
    const host =
      ip6Match[1].length > 16 ? `${ip6Match[1].slice(0, 8)}…` : ip6Match[1]
    return `[${host}]:${ip6Match[2]}`
  }

  if (trimmed.length <= 40) return trimmed
  return `${trimmed.slice(0, 22)}…${trimmed.slice(-10)}`
}

export function savedPeerStatLabel(
  relayStatus: RelayConnectionStatus,
  connectedCount: number,
  totalCount: number,
): string {
  const summary = savedPeersStatusLabel(connectedCount, totalCount)

  switch (relayStatus) {
    case "connected":
      return summary
    case "connecting":
      return `Connecting · ${summary}`
    case "failed":
      return `Not connected · ${summary}`
    case "not_configured":
      return summary
    default: {
      const _exhaustive: never = relayStatus
      return _exhaustive
    }
  }
}

export function savedPeerConnectionLabel(
  relayStatus: RelayConnectionStatus,
  pubkey: string | null | undefined,
): string {
  const name = pubkey?.trim() ? truncatePubkey(pubkey) : null
  if (!name) {
    return relayStatus === "connecting" ? "Connecting…" : "Not set"
  }

  switch (relayStatus) {
    case "connected":
      return `${name} · connected`
    case "connecting":
      return `Connecting to ${name}…`
    case "failed":
      return `${name} · connection failed`
    case "not_configured":
      return `${name} · not configured`
    default: {
      const _exhaustive: never = relayStatus
      return _exhaustive
    }
  }
}
