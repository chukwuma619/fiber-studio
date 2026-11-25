import { describe, expect, it } from "vitest"
import {
  liquidityForNetwork,
  resolveLiquidityEntry,
  serviceOpensInbound,
} from "./liquidity"
import { getRelay } from "./public-relays"

describe("liquidity provider", () => {
  it("uses an LSP on testnet and keeps mainnet on the official hub", () => {
    const testnet = liquidityForNetwork("testnet")
    const publicNode = getRelay("testnet", "node1")
    expect(testnet?.mode).toBe("lsp")
    expect(testnet?.pubkey).toMatch(/^[0-9a-f]{66}$/)
    expect(testnet?.multiaddr.startsWith("/")).toBe(true)
    expect(testnet?.pubkey).not.toBe(publicNode.pubkey)
    expect(serviceOpensInbound("testnet")).toBe(true)

    const relay = getRelay("mainnet", "node1")
    expect(liquidityForNetwork("mainnet")).toMatchObject({
      mode: "hub",
      label: "Fiber",
      pubkey: relay.pubkey,
      multiaddr: relay.multiaddr,
    })
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
