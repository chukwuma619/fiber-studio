import { describe, expect, it } from "vitest"
import { ckbToShannons, formatCkb, parseHexU128 } from "./ckbAmount"

describe("parseHexU128", () => {
  it("parses prefixed and bare hex", () => {
    expect(parseHexU128("0x5f5e100")).toBe(100_000_000n)
    expect(parseHexU128("5F5E100")).toBe(100_000_000n)
  })

  it("treats an empty payload as zero", () => {
    expect(parseHexU128("0x")).toBe(0n)
    expect(parseHexU128("")).toBe(0n)
  })

  it("rejects non-hex input", () => {
    expect(() => parseHexU128("0xzz")).toThrow()
    expect(() => parseHexU128("12ckb")).toThrow()
  })
})

describe("formatCkb", () => {
  it("drops a trailing zero fraction", () => {
    expect(formatCkb(0n)).toBe("0")
    expect(formatCkb(100_000_000n)).toBe("1")
    expect(formatCkb(250_000_000n)).toBe("2.5")
  })

  it("keeps a single shannon visible", () => {
    expect(formatCkb(1n)).toBe("0.00000001")
    expect(formatCkb("0x1")).toBe("0.00000001")
  })

  it("preserves significant fractional digits without padding", () => {
    expect(formatCkb(100_500_000n)).toBe("1.005")
    expect(formatCkb(100_000_001n)).toBe("1.00000001")
  })
})

describe("ckbToShannons", () => {
  it("converts whole and fractional CKB", () => {
    expect(ckbToShannons(0)).toBe(0n)
    expect(ckbToShannons(2)).toBe(200_000_000n)
    expect(ckbToShannons(1.25)).toBe(125_000_000n)
    expect(ckbToShannons(0.00000001)).toBe(1n)
  })

  it("rounds at the 8th decimal, including a carry", () => {
    expect(ckbToShannons(1.234567895)).toBe(123_456_790n)
    expect(ckbToShannons(-1.5)).toBe(-150_000_000n)
  })

  it("rejects amounts that cannot be represented", () => {
    expect(() => ckbToShannons(Number.NaN)).toThrow(RangeError)
    expect(() => ckbToShannons(Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })
})
