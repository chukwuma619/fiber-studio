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
    return "Connect to a relay first"
  }
  if (graphReady) {
    return "Ready for routing"
  }
  return "Network graph syncing"
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

export function connectionModeLabel(mode: "official-relays" | "custom-public-node"): string {
  if (mode === "official-relays") {
    return "Outbound via public relays"
  }
  return "Custom public node"
}

export function configuredRelayLabel(
  relays: Array<{ id: string; label: string; isConfigured: boolean; connected: boolean }>,
  relayStatus: RelayConnectionStatus,
): string {
  const configured = relays.find((relay) => relay.isConfigured)
  if (!configured) {
    return relayStatus === "connected" ? "Connected" : "Not connected"
  }
  if (configured.connected || relayStatus === "connected") {
    return `Connected to ${configured.label}`
  }
  return `Configured: ${configured.label}`
}
