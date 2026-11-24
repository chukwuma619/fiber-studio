import { describe, expect, it } from "vitest"
import {
  liquidityForNetwork,
  resolveLiquidityEntry,
  serviceOpensInbound,
} from "./liquidity"
import { getRelay } from "./public-relays"

describe("liquidity provider", () => {
  it("funds through the official hub until a service is configured", () => {
    const provider = liquidityForNetwork("testnet")
    const relay = getRelay("testnet", "node1")
    expect(provider).toMatchObject({
      mode: "hub",
      label: "Fiber",
      pubkey: relay.pubkey,
      multiaddr: relay.multiaddr,
    })
    expect(serviceOpensInbound("testnet")).toBe(false)
    expect(serviceOpensInbound("mainnet")).toBe(false)
    expect(liquidityForNetwork("devnet")).toBeNull()
  })

  it("resolves a future liquidity service without using the public hub", () => {
    const provider = resolveLiquidityEntry(
      {
        mode: "lsp",
        label: "Fiber",
        pubkey: "02aa",
        multiaddr: "/dns4/lsp.example/tcp/8119",
        maxAmountShannons: "1000",
        maxOpenFeeShannons: "0",
      },
      "testnet",
    )
    expect(provider).toEqual({
      mode: "lsp",
      label: "Fiber",
      pubkey: "02aa",
      multiaddr: "/dns4/lsp.example/tcp/8119",
    })
  })
})
