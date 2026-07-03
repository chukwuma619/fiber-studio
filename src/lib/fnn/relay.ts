
import type { SetupConfig } from "../setup/types"
import type {
  HomeDashboardResponse,
  RelayConnectionStatus,
} from "./types"

export function normalizePubkey(pubkey: string): string {
  return pubkey.trim().replace(/^0x/i, "").toLowerCase()
}

export function pubkeysEqual(left: string, right: string): boolean {
  return normalizePubkey(left) === normalizePubkey(right)
}

export type RelayContext = {
  savedPeerPubkeys: string[]
  network: SetupConfig["network"] | string | null | undefined
  relayStatus: RelayConnectionStatus | null | undefined
}

export function getRelayContext(
  dashboard: HomeDashboardResponse | null,
  config: SetupConfig | null,
): RelayContext {
  const savedPeerPubkeys =
    dashboard?.savedPeerPubkeys?.filter((pubkey) => pubkey.trim()) ??
    (config?.customPublicNodePubkey?.trim()
      ? [config.customPublicNodePubkey.trim()]
      : [])

  const network =
    (dashboard?.network as SetupConfig["network"] | null) ?? config?.network

  return {
    savedPeerPubkeys,
    network,
    relayStatus: dashboard?.relayStatus,
  }
}

export function formatRelayStatusLabel(status: RelayConnectionStatus): string {
  switch (status) {
    case "failed":
      return "Saved peer not connected"
    case "connecting":
      return "Connecting to saved peers…"
    case "not_configured":
      return "No saved peers configured"
    case "connected":
      return "Connected to saved peer"
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

export function relaySendPaymentWarning(
  status: RelayConnectionStatus,
): string | null {
  switch (status) {
    case "connected":
      return null
    case "connecting":
      return "Saved peers are still connecting — route preview may fail until a connection is ready."
    case "failed":
      return "Saved peer not connected — connect on the Network page before sending."
    case "not_configured":
      return "No saved peers — add one on the Network page during setup or after."
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}

export function formatRelayStatus(
  dashboard: HomeDashboardResponse | null,
  config: SetupConfig | null,
): string {
  const context = getRelayContext(dashboard, config)

  switch (context.relayStatus) {
    case "failed":
      return "Saved peer not connected — open Network to connect"
    case "connecting":
      return `Connecting…`
    case "not_configured":
      return "No saved peers configured"
    case "connected":
      return "Saved peers connected (outbound)"
    default:
      return `Not connected`
  }
}
