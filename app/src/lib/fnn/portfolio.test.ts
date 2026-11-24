import { describe, expect, it } from "vitest"
import {
  assetScriptKey,
  channelCapacityDisplay,
  defaultAsset,
  findAssetById,
  findAssetForScript,
} from "./assets"
import { buildPortfolioRows } from "./portfolio"
import type { AssetView } from "./types"
import { ckbHex, rawHex } from "../../test/fixtures"

const ckb: AssetView = {
  id: "ckb",
  name: "CKB",
  symbol: "CKB",
  decimals: 8,
}

const rusd: AssetView = {
  id: "rusd",
  name: "RUSD",
  symbol: "RUSD",
  decimals: 2,
  udtTypeScript: {
    codeHash: "0xabc",
    hashType: "type",
    args: "0xDEF",
  },
}

describe("asset lookup", () => {
  it("matches ids and script args without caring about case", () => {
    expect(findAssetById([ckb, rusd], "RUSD")?.symbol).toBe("RUSD")
    expect(findAssetById([ckb], "missing")).toBeUndefined()
    expect(assetScriptKey(rusd.udtTypeScript!)).toBe("0xdef")
    expect(
      findAssetForScript([ckb, rusd], {
        codeHash: "0xother",
        hashType: "type",
        args: "0xdef",
      })?.id,
    ).toBe("rusd")
  })

  it("falls back to CKB when the catalog has no match", () => {
    expect(defaultAsset([])).toMatchObject({ id: "ckb", decimals: 8 })
    expect(defaultAsset([rusd]).id).toBe("ckb")
    expect(defaultAsset([ckb, rusd]).symbol).toBe("CKB")
  })

  it("sums channel capacity in CKB decimals", () => {
    expect(channelCapacityDisplay(ckbHex(1n), ckbHex(2n), "CKB")).toBe("3 CKB")
    expect(channelCapacityDisplay(rawHex(150_000_000n), "0x0", "RUSD")).toBe(
      "1.5 RUSD",
    )
  })
})

describe("buildPortfolioRows", () => {
  it("keeps supported assets, drops empty unknown ones, and lists CKB first", () => {
    const rows = buildPortfolioRows(
      [rusd, ckb],
      [
        {
          assetId: "RUSD",
          symbol: "RUSD",
          amountDisplay: "1.50 RUSD",
          rawAmount: rawHex(150n),
        },
      ],
      [
        {
          assetId: "ckb",
          symbol: "CKB",
          localBalance: ckbHex(4n),
          remoteBalance: "0x0",
          localBalanceDisplay: "4 CKB",
          capacityDisplay: "4 CKB",
        },
        {
          assetId: "dust",
          symbol: "DUST",
          localBalance: "0x0",
          remoteBalance: "0x0",
          localBalanceDisplay: "0 DUST",
          capacityDisplay: "0 DUST",
        },
      ],
    )

    expect(rows.map((row) => row.symbol)).toEqual(["CKB", "RUSD"])
    expect(rows[0]).toMatchObject({
      onChainRaw: 0n,
      inChannelRaw: 400_000_000n,
      onChainDisplay: "0 CKB",
      inChannelDisplay: "4 CKB",
      isSupported: true,
    })
    expect(rows[1]).toMatchObject({
      onChainRaw: 150n,
      inChannelRaw: 0n,
      inChannelDisplay: "—",
    })
  })

  it("shows an unsupported asset only when it has a balance", () => {
    const rows = buildPortfolioRows(
      [],
      [
        {
          assetId: "0xunknown",
          symbol: "???",
          amountDisplay: "9 ???",
          rawAmount: rawHex(9n),
        },
      ],
      [],
    )

    expect(rows).toEqual([
      expect.objectContaining({
        assetId: "0xunknown",
        symbol: "???",
        name: "???",
        onChainRaw: 9n,
        isSupported: false,
      }),
    ])
  })
})
