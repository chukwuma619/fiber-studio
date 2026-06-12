export type FiberNetwork = "mainnet" | "testnet"

export type PublicConnectionMode = "official-relays" | "custom-public-node"

export type PublicRelayId = "node1" | "node2"

export type PublicRelayNode = {
  id: PublicRelayId
  label: string
  pubkey: string
  multiaddr?: string
}

export const PUBLIC_RELAYS: Record<FiberNetwork, PublicRelayNode[]> = {
  mainnet: [
    {
      id: "node1",
      label: "Public node1",
      pubkey:
        "03a8d7da8d0934363dbc17f52c872e8d833016415266eabb3527439c5dd17adc6b",
    },
    {
      id: "node2",
      label: "Public node2",
      pubkey:
        "033a69e5be369dab43aefa96fa729d83c571ccb066f312136c6ab2d354fcc028f9",
    },
  ],
  testnet: [
    {
      id: "node1",
      label: "Public node1",
      pubkey:
        "02b6d4e3ab86a2ca2fad6fae0ecb2e1e559e0b911939872a90abdda6d20302be71",
      multiaddr:
        "/ip4/18.162.235.225/tcp/8119/p2p/QmXen3eUHhywmutEzydCsW4hXBoeVmdET2FJvMX69XJ1Eo",
    },
    {
      id: "node2",
      label: "Public node2",
      pubkey:
        "0291a6576bd5a94bd74b27080a48340875338fff9f6d6361fe6b8db8d0d1912fcc",
      multiaddr:
        "/ip4/18.163.221.211/tcp/8119/p2p/QmbKyzq9qUmymW2Gi8Zq7kKVpPiNA1XUJ6uMvsUC4F3p89",
    },
  ],
}

export const PUBLIC_CHANNEL_FUNDING_CKB = 499

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
