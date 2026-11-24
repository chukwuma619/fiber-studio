import liquidityManifest from "../../shared/liquidity.json"
import { getRelay, type FiberNetwork, type PublicRelayId } from "./public-relays"

export type LiquidityMode = "hub" | "lsp"

export type LiquidityProvider = {
  mode: LiquidityMode
  label: string
  pubkey: string
  multiaddr: string
}

type HubEntry = {
  mode: "hub"
  relayId: PublicRelayId
  label?: string
}

type LspEntry = {
  mode: "lsp"
  label?: string
  pubkey: string
  multiaddr?: string
  maxAmountShannons: string
  maxOpenFeeShannons: string
}

type LiquidityEntry = HubEntry | LspEntry

type LiquidityManifest = Record<FiberNetwork, LiquidityEntry>

const MANIFEST = liquidityManifest as LiquidityManifest

const DEFAULT_LABEL = "Fiber"

export function resolveLiquidityEntry(
  entry: LiquidityEntry,
  network: FiberNetwork,
): LiquidityProvider {
  if (entry.mode === "hub") {
    const relay = getRelay(network, entry.relayId)
    return {
      mode: "hub",
      label: entry.label?.trim() || DEFAULT_LABEL,
      pubkey: relay.pubkey,
      multiaddr: relay.multiaddr ?? "",
    }
  }

  return {
    mode: "lsp",
    label: entry.label?.trim() || DEFAULT_LABEL,
    pubkey: entry.pubkey.trim(),
    multiaddr: entry.multiaddr?.trim() ?? "",
  }
}

export function liquidityForNetwork(
  network: string | null | undefined,
): LiquidityProvider | null {
  if (network !== "mainnet" && network !== "testnet") return null
  return resolveLiquidityEntry(MANIFEST[network], network)
}

export function serviceOpensInbound(
  network: string | null | undefined,
): boolean {
  return liquidityForNetwork(network)?.mode === "lsp"
}
