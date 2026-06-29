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
    return "Needs configured peer"
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

export function connectionModeLabel(
  mode: "official-relays" | "custom-public-node",
): string {
  if (mode === "official-relays") {
    return "Official Fiber relay"
  }
  return "Custom public node"
}

export function connectionModeSubtext(
  mode: "official-relays" | "custom-public-node",
): string {
  if (mode === "official-relays") {
    return "Saved peer is an official relay"
  }
  return "Saved peer is a custom public node"
}

export function configuredPeerPubkeyLabel(
  configuredPeerPubkey: string | null | undefined,
): string | null {
  const pubkey = configuredPeerPubkey?.trim()
  if (!pubkey) {
    return null
  }

  return truncatePubkey(pubkey)
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

export function configuredPeerStatLabel(
  relayStatus: RelayConnectionStatus,
  configuredPeerPubkey: string | null | undefined,
): string {
  const name = configuredPeerPubkeyLabel(configuredPeerPubkey)
  if (!name) {
    switch (relayStatus) {
      case "connected":
        return "Connected"
      case "connecting":
        return "Connecting…"
      case "failed":
        return "Connection failed"
      case "not_configured":
        return "Not set"
      default: {
        const _exhaustive: never = relayStatus
        return _exhaustive
      }
    }
  }

  switch (relayStatus) {
    case "connected":
      return `Connected · ${name}`
    case "connecting":
      return `Connecting to ${name}…`
    case "failed":
      return `Not connected · ${name}`
    case "not_configured":
      return name
    default: {
      const _exhaustive: never = relayStatus
      return _exhaustive
    }
  }
}

export function configuredPeerConnectionLabel(
  relayStatus: RelayConnectionStatus,
  configuredPeerPubkey: string | null | undefined,
): string {
  const name = configuredPeerPubkeyLabel(configuredPeerPubkey)
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
