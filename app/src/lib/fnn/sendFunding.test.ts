import { describe, expect, it } from "vitest"
import { getRelay } from "../public-relays"
import type { HomeChannel } from "./types"
import {
  planSendFunding,
  sendFundingCkb,
  waitForSpendableChannel,
} from "./sendFunding"

function channel(patch: Partial<HomeChannel> = {}): HomeChannel {
  return {
    channelId: "ch",
    pubkey: getRelay("testnet", "node1").pubkey,
    isPublic: false,
    isAcceptor: false,
    isOneWay: false,
    state: "ChannelReady",
    localBalance: "0x2540be400",
    remoteBalance: "0x0",
    localPercent: 100,
    assetSymbol: "CKB",
    localBalanceDisplay: "100 CKB",
    remoteBalanceDisplay: "0 CKB",
    isLegacy: false,
    channelVersion: "v2",
    ...patch,
  }
}

describe("planSendFunding", () => {
  it("opens a channel with the liquidity service when the wallet can cover the send", () => {
    const plan = planSendFunding({
      network: "testnet",
      amountRaw: 50n * 100_000_000n,
      spendableRaw: 0n,
      walletCkb: 5_000,
      assetIsCkb: true,
    })
    expect(plan).toMatchObject({
      providerLabel: "Fiber",
      providerPubkey: getRelay("testnet", "node1").pubkey,
      fundingCkb: 1000,
    })
  })

  it("sizes an LSP channel to the payment plus the reserve, and at least 200 CKB", () => {
    expect(sendFundingCkb(50n * 100_000_000n, "lsp")).toBe(200)
    expect(sendFundingCkb(1n * 100_000_000n, "lsp")).toBe(200)
    expect(sendFundingCkb(150n * 100_000_000n, "lsp")).toBe(250)
    expect(sendFundingCkb(50n * 100_000_000n, "hub")).toBe(1000)
  })

  it("skips the open when the channel can already spend the amount", () => {
    expect(
      planSendFunding({
        network: "testnet",
        amountRaw: 10n * 100_000_000n,
        spendableRaw: 10n * 100_000_000n,
        walletCkb: 5_000,
        assetIsCkb: true,
      }),
    ).toBeNull()
  })

  it("skips the open when the wallet cannot cover capacity, reserve, and fees", () => {
    expect(
      planSendFunding({
        network: "testnet",
        amountRaw: 10n * 100_000_000n,
        spendableRaw: 0n,
        walletCkb: 100,
        assetIsCkb: true,
      }),
    ).toBeNull()
  })
})

describe("waitForSpendableChannel", () => {
  it("resolves once the service channel can spend the payment", async () => {
    let calls = 0
    const ready = await waitForSpendableChannel({
      providerPubkey: getRelay("testnet", "node1").pubkey,
      amountRaw: 50n * 100_000_000n,
      fetchChannels: async () => {
        calls += 1
        return calls < 2 ? [channel({ state: "NegotiatingFunding" })] : [channel()]
      },
      timeoutMs: 10_000,
      intervalMs: 1,
      sleep: async () => undefined,
      now: () => 0,
    })
    expect(ready).toBe(true)
  })
})
