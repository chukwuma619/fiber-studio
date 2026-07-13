import relaysManifest from "../../shared/relays.json"

export type FiberNetwork = "mainnet" | "testnet"

export type PublicConnectionMode = "official-relays" | "custom-public-node"

export type PublicRelayId = "node1" | "node2"

export type PublicRelayNode = {
  id: PublicRelayId
  label: string
  pubkey: string
  multiaddr?: string
}

type RelaysManifest = Record<FiberNetwork, PublicRelayNode[]>

const MANIFEST = relaysManifest as RelaysManifest

export const PUBLIC_RELAYS: Record<FiberNetwork, PublicRelayNode[]> = MANIFEST

export const FIBER_MIN_CHANNEL_FUNDING_CKB = 100

export const CHANNEL_OPEN_MIN_FUNDING_CKB = 1000

export const CHANNEL_RESERVE_CKB = 99

/** Example third-party public nodes — placeholders for custom mode only. */
export const EXAMPLE_CUSTOM_PUBLIC_NODES: Record<FiberNetwork, string> = {
  mainnet:
    "02f4a8e91c3d7b2e6a1098c4f5d7e3b2a1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6",
  testnet:
    "025c8b3a7f2e1d9c6b4a39281706f5e4d3c2b1a0987654321fedcba0987654321",
}

export function truncatePubkey(pubkey: string): string {
  if (pubkey.length <= 14) return pubkey
  return `${pubkey.slice(0, 6)}…${pubkey.slice(-4)}`
}

export function getRelay(
  network: FiberNetwork,
  id: PublicRelayId,
): PublicRelayNode {
  const relay = PUBLIC_RELAYS[network].find((node) => node.id === id)
  if (!relay) {
    throw new Error(`Relay ${id} not found for ${network}`)
  }
  return relay
}

export function findRelayByPubkey(
  network: FiberNetwork,
  pubkey: string,
): PublicRelayNode | null {
  const normalized = pubkey.trim().toLowerCase()
  return (
    PUBLIC_RELAYS[network].find(
      (node) => node.pubkey.toLowerCase() === normalized,
    ) ?? null
  )
}
