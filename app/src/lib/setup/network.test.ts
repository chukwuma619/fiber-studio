import { describe, expect, it } from "vitest"
import {
  canSwitchNetwork,
  enabledNetworks,
  switchTargetNetworks,
} from "./network"

describe("network choice", () => {
  it("only offers networks the app can provision", () => {
    expect(enabledNetworks()).toEqual(["testnet"])
  })

  it("has no switch target while mainnet is disabled", () => {
    expect(switchTargetNetworks("testnet")).toEqual([])
    expect(switchTargetNetworks("mainnet")).toEqual(["testnet"])
    expect(canSwitchNetwork("testnet")).toBe(false)
    expect(canSwitchNetwork("mainnet")).toBe(true)
  })
})
