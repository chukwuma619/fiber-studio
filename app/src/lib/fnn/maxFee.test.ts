import { describe, expect, it } from "vitest"
import {
  buildSendOptions,
  formatEffectiveMaxFeeLabel,
  parseMaxFeeCkbInput,
} from "./maxFee"

describe("parseMaxFeeCkbInput", () => {
  it("leaves an empty field as the node default", () => {
    expect(parseMaxFeeCkbInput("")).toEqual({ status: "unset" })
    expect(parseMaxFeeCkbInput("   ")).toEqual({ status: "unset" })
  })

  it("accepts a positive fee and keeps at most 8 significant decimals", () => {
    expect(parseMaxFeeCkbInput("1.25")).toEqual({
      status: "ok",
      maxFeeCkb: 1.25,
    })
    expect(parseMaxFeeCkbInput("0.00000001")).toEqual({
      status: "ok",
      maxFeeCkb: 0.00000001,
    })
    expect(parseMaxFeeCkbInput("1.25000000")).toEqual({
      status: "ok",
      maxFeeCkb: 1.25,
    })
  })

  it("rejects zero instead of treating it as unset", () => {
    for (const input of ["0", "0.0", "0.00000000"]) {
      const parsed = parseMaxFeeCkbInput(input)
      expect(parsed.status).toBe("error")
      if (parsed.status === "error") {
        expect(parsed.message).toMatch(/not supported/)
      }
    }
  })

  it("rejects extra non-zero precision and non-numeric text", () => {
    expect(parseMaxFeeCkbInput("0.000000001").status).toBe("error")
    expect(parseMaxFeeCkbInput("1e-2").status).toBe("error")
    expect(parseMaxFeeCkbInput("-1").status).toBe("error")
    expect(parseMaxFeeCkbInput("1.2.3").status).toBe("error")
  })
})

describe("formatEffectiveMaxFeeLabel", () => {
  it("labels each parsed state", () => {
    expect(formatEffectiveMaxFeeLabel("")).toBe("Node default")
    expect(formatEffectiveMaxFeeLabel(" 0.5 ")).toBe("0.5 CKB")
    expect(formatEffectiveMaxFeeLabel("nope")).toBe("—")
  })
})

describe("buildSendOptions", () => {
  it("omits an unset fee and forwards a positive integer timeout", () => {
    expect(buildSendOptions("", " 90 ")).toEqual({
      ok: true,
      options: { maxFeeCkb: undefined, timeoutSeconds: 90 },
    })
    expect(buildSendOptions("0.25", "30")).toEqual({
      ok: true,
      options: { maxFeeCkb: 0.25, timeoutSeconds: 30 },
    })
  })

  it("drops a timeout that is not a positive integer", () => {
    expect(buildSendOptions("", "")).toEqual({
      ok: true,
      options: { maxFeeCkb: undefined, timeoutSeconds: undefined },
    })
    const zeroTimeout = buildSendOptions("", "0")
    const fractionalTimeout = buildSendOptions("", "1.5")
    const textTimeout = buildSendOptions("", "30s")
    expect(zeroTimeout.ok && zeroTimeout.options).toEqual({
      maxFeeCkb: undefined,
      timeoutSeconds: undefined,
    })
    expect(
      fractionalTimeout.ok && fractionalTimeout.options.timeoutSeconds,
    ).toBeUndefined()
    expect(textTimeout.ok && textTimeout.options.timeoutSeconds).toBeUndefined()
  })

  it("returns the fee error and does not build options", () => {
    const result = buildSendOptions("0", "30")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/not supported/)
    }
  })
})
