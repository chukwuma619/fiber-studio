import { describe, expect, it } from "vitest"
import {
  channelLiquidityHealth,
  channelsShareAsset,
  maxRebalanceAmountRaw,
  rebalanceDisabledReason,
  rebalanceRolesForFocus,
  suggestRebalanceCounterpart,
  suggestedRebalanceAmount,
} from "./liquidityHealth"
import type { AssetView } from "./types"
import { ckbHex, rawHex, testChannel } from "../../test/fixtures"

const ckbAsset: AssetView = {
  id: "ckb",
  name: "CKB",
  symbol: "CKB",
  decimals: 8,
}

describe("channelLiquidityHealth", () => {
  it("scores a ready channel by how far it sits from 50/50", () => {
    expect(channelLiquidityHealth(testChannel({ localPercent: 50 }))).toMatchObject({
      kind: "balanced",
      score: 100,
      warning: false,
      label: "Balanced",
    })
    expect(channelLiquidityHealth(testChannel({ localPercent: 66 })).kind).toBe(
      "outbound_heavy",
    )
    expect(channelLiquidityHealth(testChannel({ localPercent: 65 })).kind).toBe(
      "balanced",
    )
    expect(channelLiquidityHealth(testChannel({ localPercent: 34 })).kind).toBe(
      "inbound_heavy",
    )
    expect(channelLiquidityHealth(testChannel({ localPercent: 86 }))).toMatchObject({
      kind: "skewed_outbound",
      score: 28,
      warning: true,
      label: "Low inbound",
    })
    expect(channelLiquidityHealth(testChannel({ localPercent: 14 })).kind).toBe(
      "skewed_inbound",
    )
    expect(channelLiquidityHealth(testChannel({ localPercent: 15 })).kind).toBe(
      "inbound_heavy",
    )
  })

  it("does not score a channel that is not ready", () => {
    expect(
      channelLiquidityHealth(
        testChannel({ state: "NegotiatingFunding", localPercent: 100 }),
      ),
    ).toMatchObject({
      kind: "pending",
      score: 0,
      warning: false,
    })
  })
})

describe("rebalance planning", () => {
  const udtScript = {
    codeHash: "0xABC",
    hashType: "type",
    args: "0xDEF",
  }

  it("treats matching scripts as the same asset regardless of hex case", () => {
    const left = testChannel({
      assetSymbol: "RUSD",
      fundingUdtTypeScript: udtScript,
    })
    const right = testChannel({
      channelId: "channel-2",
      assetSymbol: "RUSD",
      fundingUdtTypeScript: {
        codeHash: "0xabc",
        hashType: "TYPE",
        args: "0xdef",
      },
    })
    const ckb = testChannel({ assetSymbol: "CKB" })

    expect(channelsShareAsset(left, right)).toBe(true)
    expect(channelsShareAsset(ckb, left)).toBe(false)
    expect(channelsShareAsset(ckb, testChannel())).toBe(true)
  })

  it("picks the counterpart that can absorb the skew", () => {
    const inbound = testChannel({
      channelId: "inbound",
      localPercent: 10,
    })
    const rich = testChannel({ channelId: "rich", localPercent: 90 })
    const poor = testChannel({ channelId: "poor", localPercent: 20 })

    expect(suggestRebalanceCounterpart(inbound, [inbound, poor, rich])?.channelId).toBe(
      "rich",
    )
    expect(suggestRebalanceCounterpart(rich, [rich, poor, inbound])?.channelId).toBe(
      "inbound",
    )
    expect(suggestRebalanceCounterpart(inbound, [inbound])).toBeNull()
  })

  it("sends from an outbound-heavy channel and into an inbound-heavy one", () => {
    expect(rebalanceRolesForFocus(testChannel({ localPercent: 90 }))).toEqual({
      sourceId: "channel-1",
      targetId: null,
    })
    expect(rebalanceRolesForFocus(testChannel({ localPercent: 10 }))).toEqual({
      sourceId: "",
      targetId: "channel-1",
    })
  })

  it("explains why rebalance is unavailable", () => {
    const ready = testChannel()
    expect(rebalanceDisabledReason(ready, [ready], false)).toMatch(/Start your node/)
    expect(rebalanceDisabledReason(null, [], true)).toMatch(/Select a channel/)
    expect(
      rebalanceDisabledReason(
        testChannel({ state: "ShuttingDown" }),
        [],
        true,
      ),
    ).toMatch(/Only ready/)
    expect(rebalanceDisabledReason(ready, [ready], true)).toMatch(/at least two/)
    expect(
      rebalanceDisabledReason(ready, [ready, testChannel({ channelId: "other" })], true),
    ).toBeNull()
  })

  it("keeps a 1 CKB reserve when both sides have more than 2 CKB", () => {
    const source = testChannel({
      localBalance: ckbHex(10n),
      remoteBalance: "0x0",
    })
    const target = testChannel({
      channelId: "target",
      localBalance: "0x0",
      remoteBalance: ckbHex(10n),
    })

    expect(maxRebalanceAmountRaw(source, target)).toBe(900_000_000n)
    expect(suggestedRebalanceAmount(source, target, ckbAsset)).toBe("5")
  })

  it("reserves a single shannon on a tiny ckb balance", () => {
    const source = testChannel({
      localBalance: rawHex(1n),
      remoteBalance: "0x0",
    })
    const target = testChannel({
      channelId: "target",
      remoteBalance: ckbHex(10n),
    })

    expect(maxRebalanceAmountRaw(source, target)).toBe(0n)
    expect(suggestedRebalanceAmount(source, target, ckbAsset)).toBe("")
  })

  it("reserves one unit of a udt and moves the smaller side", () => {
    const source = testChannel({
      assetSymbol: "RUSD",
      localBalance: rawHex(10n),
      remoteBalance: "0x0",
      fundingUdtTypeScript: udtScript,
    })
    const target = testChannel({
      channelId: "target",
      assetSymbol: "RUSD",
      localBalance: "0x0",
      remoteBalance: rawHex(4n),
      fundingUdtTypeScript: udtScript,
    })
    const asset: AssetView = {
      id: "rusd",
      name: "RUSD",
      symbol: "RUSD",
      decimals: 2,
      udtTypeScript: udtScript,
    }

    expect(maxRebalanceAmountRaw(source, target)).toBe(3n)
    expect(suggestedRebalanceAmount(source, target, asset)).toBe("0.03")
  })
})
