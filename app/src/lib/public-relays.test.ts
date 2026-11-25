import { describe, expect, it } from "vitest"
import {
  CHANNEL_OPEN_MIN_FUNDING_CKB,
  CHANNEL_RESERVE_CKB,
  findRelayByPubkey,
  getRelay,
  truncatePubkey,
} from "./public-relays"

describe("public relays", () => {
  it("finds a relay by id or pubkey", () => {
    const node = getRelay("testnet", "node1")
    expect(node.label).toBe("Public node1")
    expect(node.multiaddr).toMatch(/\/p2p\//)
    expect(findRelayByPubkey("testnet", node.pubkey.toUpperCase())?.id).toBe(
      "node1",
    )
    expect(findRelayByPubkey("mainnet", node.pubkey)).toBeNull()
    expect(findRelayByPubkey("testnet", `  ${node.pubkey}  `)?.id).toBe("node1")
  })

  it("fails when a relay id is missing", () => {
    expect(() => getRelay("testnet", "node9" as "node1")).toThrow(/not found/)
  })

  it("shortens a pubkey for compact labels", () => {
    expect(truncatePubkey("02abcd")).toBe("02abcd")
    expect(truncatePubkey("02abcdef1234567890")).toBe("02abcd…7890")
  })

  it("keeps the funding floor above the reserve", () => {
    expect(CHANNEL_OPEN_MIN_FUNDING_CKB).toBeGreaterThan(CHANNEL_RESERVE_CKB)
    expect(CHANNEL_RESERVE_CKB).toBe(100)
  })
})
