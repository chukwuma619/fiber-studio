/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from "vitest"
import { createDefaultSetupConfig } from "./types"
import {
  completeSetup,
  getSetupComplete,
  loadSetupConfig,
  saveSetupConfig,
} from "./storage"

const KEY = "ab".repeat(32)
const CONFIG_KEY = "fiber-studio-setup-config"
const COMPLETE_KEY = "fiber-studio-setup-complete"

describe("setup storage", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("starts incomplete", () => {
    expect(getSetupComplete()).toBe(false)
  })

  it("never writes the wallet key or password", () => {
    saveSetupConfig({
      ...createDefaultSetupConfig(),
      importedPrivateKey: KEY,
      password: "hunter2",
      passwordConfirm: "hunter2",
      network: "testnet",
    })

    const raw = localStorage.getItem(CONFIG_KEY) ?? ""
    expect(raw).not.toContain(KEY)
    expect(raw).not.toContain("hunter2")
    expect(JSON.parse(raw)).toMatchObject({
      network: "testnet",
      publicConnectionMode: "official-relays",
    })
  })

  it("drops secrets that were already stored and rewrites the entry", () => {
    localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({
        ...createDefaultSetupConfig(),
        importedPrivateKey: KEY,
        password: "hunter2",
        passwordConfirm: "hunter2",
        network: "testnet",
      }),
    )

    const loaded = loadSetupConfig()
    expect(loaded?.importedPrivateKey).toBe("")
    expect(loaded?.password).toBe("")
    expect(loaded?.passwordConfirm).toBe("")
    expect(loaded?.network).toBe("testnet")

    const raw = localStorage.getItem(CONFIG_KEY) ?? ""
    expect(raw).not.toContain(KEY)
    expect(raw).not.toContain("hunter2")
  })

  it("returns null for corrupt storage", () => {
    localStorage.setItem(CONFIG_KEY, "{")
    expect(loadSetupConfig()).toBeNull()
  })

  it("marks setup complete without keeping the password", () => {
    completeSetup({
      ...createDefaultSetupConfig(),
      password: "hunter2",
      passwordConfirm: "hunter2",
      importedPrivateKey: KEY,
    })

    expect(getSetupComplete()).toBe(true)
    expect(localStorage.getItem(COMPLETE_KEY)).toBe("true")
    expect(localStorage.getItem(CONFIG_KEY)).not.toContain("hunter2")
  })
})
