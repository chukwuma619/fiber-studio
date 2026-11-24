import { describe, expect, it } from "vitest"
import {
  formatRelayStatus,
  formatRelayStatusLabel,
  getRelayContext,
  normalizePubkey,
  pubkeysEqual,
  relaySendPaymentWarning,
} from "./relay"
import type { HomeDashboardResponse } from "./types"
import { createDefaultSetupConfig } from "../setup/types"

const PUBKEY =
  "02eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"

function dashboard(
  overrides: Partial<HomeDashboardResponse>,
): HomeDashboardResponse {
  return {
    available: true,
    nodeInfo: null,
    channels: [],
    payments: [],
    incomingInvoices: [],
    activeChannelCount: 0,
    pendingChannelCount: 0,
    totalLocalBalance: "0x0",
    totalRemoteBalance: "0x0",
    savedPeerPubkeys: [],
    network: "testnet",
    relayStatus: "not_configured",
    needsRelayChannel: false,
    assets: [],
    channelTotals: [],
    onChainBalances: [],
    legacyChannelCount: 0,
    showLegacyChannelNudge: false,
    ...overrides,
  }
}

describe("pubkeys", () => {
  it("compares hex with or without a 0x prefix", () => {
    expect(normalizePubkey(` 0X${PUBKEY.toUpperCase()} `)).toBe(PUBKEY)
    expect(pubkeysEqual(`0x${PUBKEY}`, PUBKEY.toUpperCase())).toBe(true)
    expect(pubkeysEqual(PUBKEY, `${PUBKEY}00`)).toBe(false)
  })
})

describe("relay status", () => {
  it("prefers saved peers from the dashboard over setup", () => {
    const config = createDefaultSetupConfig()
    config.customPublicNodePubkey = "from-setup"

    expect(
      getRelayContext(
        dashboard({
          savedPeerPubkeys: ["  ", PUBKEY],
          network: "mainnet",
          relayStatus: "connected",
        }),
        config,
      ),
    ).toEqual({
      savedPeerPubkeys: [PUBKEY],
      network: "mainnet",
      relayStatus: "connected",
    })
  })

  it("falls back to the custom pubkey saved during setup", () => {
    const config = createDefaultSetupConfig()
    config.customPublicNodePubkey = PUBKEY
    config.network = "mainnet"

    expect(getRelayContext(null, config)).toMatchObject({
      savedPeerPubkeys: [PUBKEY],
      network: "mainnet",
      relayStatus: undefined,
    })
  })

  it("labels every connection state", () => {
    expect(formatRelayStatusLabel("connected")).toBe("Connected to saved peer")
    expect(formatRelayStatusLabel("connecting")).toMatch(/Connecting/)
    expect(formatRelayStatusLabel("failed")).toMatch(/not connected/)
    expect(formatRelayStatusLabel("not_configured")).toMatch(/No saved peers/)
  })

  it("warns before a send only when the saved peer is not ready", () => {
    expect(relaySendPaymentWarning("connected")).toBeNull()
    expect(relaySendPaymentWarning("connecting")).toMatch(/still connecting/)
    expect(relaySendPaymentWarning("failed")).toMatch(/Network page/)
    expect(relaySendPaymentWarning("not_configured")).toMatch(/add one/)
  })

  it("describes the header status from the live dashboard", () => {
    expect(
      formatRelayStatus(dashboard({ relayStatus: "connected" }), null),
    ).toMatch(/connected/)
    expect(
      formatRelayStatus(dashboard({ relayStatus: "failed" }), null),
    ).toMatch(/open Network/)
    expect(formatRelayStatus(null, null)).toBe("Not connected")
  })
})
