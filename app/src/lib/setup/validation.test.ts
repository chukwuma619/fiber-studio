import { describe, expect, it } from "vitest"
import { createDefaultSetupConfig } from "./types"
import { validateSetupStep } from "./validation"

const KEY = "cd".repeat(32)

describe("validateSetupStep", () => {
  it("lets the welcome, network, and review steps pass", () => {
    const config = createDefaultSetupConfig()
    expect(validateSetupStep("welcome", config)).toBeNull()
    expect(validateSetupStep("network", config)).toBeNull()
    expect(validateSetupStep("review", config)).toBeNull()
  })

  it("requires a usable private key", () => {
    const config = createDefaultSetupConfig()
    expect(validateSetupStep("key-file", config)).toBe("Private key is required.")
    expect(
      validateSetupStep("key-file", { ...config, importedPrivateKey: "abc" }),
    ).toMatch(/64 hex/)
    expect(
      validateSetupStep("key-file", {
        ...config,
        importedPrivateKey: `0x${KEY}`,
      }),
    ).toBeNull()
  })

  it("requires the password to be entered twice", () => {
    const config = createDefaultSetupConfig()
    expect(validateSetupStep("password", config)).toBe("Password is required.")
    expect(
      validateSetupStep("password", { ...config, password: "secret" }),
    ).toBe("Confirm your password.")
    expect(
      validateSetupStep("password", {
        ...config,
        password: "secret",
        passwordConfirm: "other",
      }),
    ).toBe("Passwords do not match.")
    expect(
      validateSetupStep("password", {
        ...config,
        password: "secret",
        passwordConfirm: "secret",
      }),
    ).toBeNull()
  })
})
