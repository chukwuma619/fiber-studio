
import type { SetupConfig } from "../setup/types"
import type {
  HomeDashboardResponse,
  HomePeer,
  RelayConnectionStatus,
} from "./types"

export function normalizePubkey(pubkey: string): string {
  return pubkey.trim().replace(/^0x/i, "").toLowerCase()
}

export function pubkeysEqual(left: string, right: string): boolean {
  return normalizePubkey(left) === normalizePubkey(right)
}

export type RelayContext = {
  configuredRelayPubkey: string | null
  network: SetupConfig["network"] | string | null | undefined
  relayStatus: RelayConnectionStatus | null | undefined
}

export function getRelayContext(
  dashboard: HomeDashboardResponse | null,
  config: SetupConfig | null,
): RelayContext {
  const configuredRelayPubkey =
    dashboard?.configuredRelayPubkey?.trim() ||
    config?.customPublicNodePubkey?.trim() ||
    null

  const network =
    (dashboard?.network as SetupConfig["network"] | null) ?? config?.network

  return {
    configuredRelayPubkey,
    network,
    relayStatus: dashboard?.relayStatus,
  }
}

export function isRelayConnected(
  peers: HomePeer[],
  context: RelayContext,
): boolean {
  if (context.relayStatus === "connected") return true

  const configuredPubkey = context.configuredRelayPubkey
  if (!configuredPubkey) return false
  return peers.some((peer) => pubkeysEqual(peer.pubkey, configuredPubkey))
}

export function formatRelayStatus(
  dashboard: HomeDashboardResponse | null,
  config: SetupConfig | null,
): string {
  const context = getRelayContext(dashboard, config)

  switch (context.relayStatus) {
    case "failed":
      return `Connection failed — try restarting the node`
    case "connecting":
      return `Connecting…`
    case "not_configured":
      return "No peer configured in setup"
    case "connected":
      return `Connected (outbound)`
    default:
      return `Not connected`
  }
}
