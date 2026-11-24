import { describe, expect, it } from "vitest"
import { parseSetupStartError } from "./errors"

describe("parseSetupStartError", () => {
  it("explains a rejected wallet key", () => {
    const parsed = parseSetupStartError("invalid private key length")
    expect(parsed.title).toMatch(/wallet key/)
    expect(parsed.hint).toMatch(/64 hex/)
    expect(parsed.details).toBe("invalid private key length")
  })

  it("explains a node that never became ready", () => {
    expect(parseSetupStartError("fnn did not become ready: timeout").title).toMatch(
      /did not start/,
    )
  })

  it("explains data directory and keychain failures", () => {
    expect(
      parseSetupStartError("Failed to prepare data directory: permission denied")
        .title,
    ).toMatch(/data folder/)
    expect(
      parseSetupStartError("Failed to store password in keychain: denied").hint,
    ).toMatch(/Keychain/)
  })

  it("keeps an unrecognized failure generic", () => {
    expect(parseSetupStartError("something else")).toEqual({
      title: "Setup could not be completed.",
      details: "something else",
    })
  })
})
