import { describe, expect, it } from "vitest"
import { isLiquidityOpenedChannel } from "./jit"
import { testChannel } from "../../test/fixtures"

const LSP =
  "02dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"

describe("isLiquidityOpenedChannel", () => {
  it("matches a private inbound ckb channel from the liquidity node", () => {
    expect(
      isLiquidityOpenedChannel(
        testChannel({
          pubkey: `0x${LSP.toUpperCase()}`,
          isPublic: false,
          isAcceptor: true,
          isOneWay: false,
          assetSymbol: "ckb",
          fundingUdtTypeScript: null,
        }),
        LSP,
      ),
    ).toBe(true)
  })

  it("rejects channels the liquidity node did not open", () => {
    const opened = testChannel({
      pubkey: LSP,
      isPublic: false,
      isAcceptor: true,
    })

    expect(isLiquidityOpenedChannel(opened, null)).toBe(false)
    expect(isLiquidityOpenedChannel(opened, "")).toBe(false)
    expect(
      isLiquidityOpenedChannel({ ...opened, isPublic: true }, LSP),
    ).toBe(false)
    expect(
      isLiquidityOpenedChannel({ ...opened, isAcceptor: false }, LSP),
    ).toBe(false)
    expect(
      isLiquidityOpenedChannel({ ...opened, isOneWay: true }, LSP),
    ).toBe(false)
    expect(
      isLiquidityOpenedChannel({ ...opened, assetSymbol: "RUSD" }, LSP),
    ).toBe(false)
    expect(
      isLiquidityOpenedChannel(
        {
          ...opened,
          fundingUdtTypeScript: {
            codeHash: "0x1",
            hashType: "type",
            args: "0x2",
          },
        },
        LSP,
      ),
    ).toBe(false)
    expect(isLiquidityOpenedChannel(opened, `${LSP}ff`)).toBe(false)
  })
})
