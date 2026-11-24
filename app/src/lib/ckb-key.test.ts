import { describe, expect, it } from "vitest"
import { normalizeCkbPrivateKey, validateCkbPrivateKey } from "./ckb-key"

const KEY = "ab".repeat(32)

describe("ckb private key", () => {
  it("keeps the first non-empty line and strips a 0x prefix", () => {
    expect(normalizeCkbPrivateKey(`\n  0X${KEY.toUpperCase()} \nsecond`)).toBe(
      KEY,
    )
  })

  it("accepts a 64 character hex key and an empty field", () => {
    expect(validateCkbPrivateKey("")).toBeNull()
    expect(validateCkbPrivateKey(`0x${KEY}`)).toBeNull()
  })

  it("rejects the wrong length and non-hex characters", () => {
    expect(validateCkbPrivateKey("abc")).toMatch(/64 hex/)
    expect(validateCkbPrivateKey(`${KEY.slice(0, 63)}g`)).toMatch(
      /hex characters/,
    )
    expect(validateCkbPrivateKey(`${KEY}00`)).toMatch(/64 hex/)
  })
})
