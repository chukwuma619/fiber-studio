import type { HomeChannel, PreflightSnapshot } from "../lib/fnn/types"

const SHANNONS_PER_CKB = 100_000_000n

export function rawHex(raw: bigint): string {
  return `0x${raw.toString(16)}`
}

export function ckbHex(ckb: bigint): string {
  return rawHex(ckb * SHANNONS_PER_CKB)
}

export function testChannel(overrides: Partial<HomeChannel> = {}): HomeChannel {
  return {
    channelId: "channel-1",
    pubkey: "02aa",
    isPublic: true,
    isAcceptor: false,
    isOneWay: false,
    state: "ChannelReady",
    localBalance: "0x0",
    remoteBalance: "0x0",
    localPercent: 50,
    assetSymbol: "CKB",
    localBalanceDisplay: "0 CKB",
    remoteBalanceDisplay: "0 CKB",
    isLegacy: false,
    channelVersion: "v2",
    ...overrides,
  }
}

export function testSnapshot(
  overrides: Partial<PreflightSnapshot> = {},
): PreflightSnapshot {
  return {
    ownPubkey: null,
    channels: [],
    connectedPeerPubkeys: [],
    graphNodeCount: 0,
    graphReady: false,
    officialRelayPubkeys: [],
    localOfficialRelayConnected: false,
    localOfficialRelayChannelReady: false,
    payee: null,
    ...overrides,
  }
}
