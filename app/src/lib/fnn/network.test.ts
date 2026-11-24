import { describe, expect, it } from "vitest"
import {
  graphStatusBadgeColor,
  graphStatusDotTone,
  graphStatusLabel,
  relayStatusBadgeColor,
  relayStatusDotTone,
  savedPeerConnectionLabel,
  savedPeerStatLabel,
  savedPeersStatusLabel,
  truncateMultiaddr,
} from "./network"

describe("relay and graph status", () => {
  it("maps relay status onto color and the status dot", () => {
    expect(relayStatusBadgeColor("connected")).toBe("green")
    expect(relayStatusBadgeColor("connecting")).toBe("amber")
    expect(relayStatusBadgeColor("failed")).toBe("red")
    expect(relayStatusBadgeColor("not_configured")).toBe("zinc")
    expect(relayStatusDotTone("failed")).toBe("danger")
    expect(relayStatusDotTone("not_configured")).toBe("stopped")
  })

  it("keeps the graph offline until a saved peer is connected", () => {
    expect(graphStatusLabel(true, "failed")).toBe("Needs saved peer")
    expect(graphStatusLabel(false, "connected")).toBe("Syncing graph data")
    expect(graphStatusLabel(true, "connected")).toBe("Graph data available")
    expect(graphStatusDotTone(true, "connecting")).toBe("stopped")
    expect(graphStatusDotTone(false, "connected")).toBe("warning")
    expect(graphStatusBadgeColor(true, "connected")).toBe("green")
    expect(graphStatusBadgeColor(false, "connected")).toBe("amber")
  })
})

describe("saved peers", () => {
  it("counts connections and prefixes the live relay state", () => {
    expect(savedPeersStatusLabel(0, 0)).toBe("Saved peers · none")
    expect(savedPeersStatusLabel(1, 2)).toBe("Saved peers · 1/2 connected")
    expect(savedPeerStatLabel("connecting", 0, 2)).toBe(
      "Connecting · Saved peers · 0/2 connected",
    )
    expect(savedPeerStatLabel("failed", 0, 1)).toMatch(/^Not connected · /)
    expect(savedPeerStatLabel("connected", 1, 1)).toBe(
      "Saved peers · 1/1 connected",
    )
  })

  it("names the peer when a pubkey is known", () => {
    const pubkey = "02abcdef1234567890"
    expect(savedPeerConnectionLabel("connected", pubkey)).toBe(
      "02abcd…7890 · connected",
    )
    expect(savedPeerConnectionLabel("connecting", pubkey)).toMatch(
      /^Connecting to /,
    )
    expect(savedPeerConnectionLabel("failed", "  ")).toBe("Not set")
    expect(savedPeerConnectionLabel("connecting", null)).toBe("Connecting…")
    expect(savedPeerConnectionLabel("not_configured", pubkey)).toMatch(
      /not configured/,
    )
  })
})

describe("truncateMultiaddr", () => {
  it("shows host and port for ip4 and ip6 addresses", () => {
    expect(truncateMultiaddr("  /ip4/127.0.0.1/tcp/8119/p2p/Qmabc  ")).toBe(
      "127.0.0.1:8119",
    )
    expect(
      truncateMultiaddr("/ip6/2001:0db8:85a3:0000:0000:8a2e:0370:7334/tcp/443"),
    ).toBe("[2001:0db…]:443")
    expect(truncateMultiaddr("/ip6/::1/tcp/8119")).toBe("[::1]:8119")
  })

  it("keeps a short unknown address and clips a long one", () => {
    expect(truncateMultiaddr("")).toBe("—")
    expect(truncateMultiaddr("/dns4/fiber.local")).toBe("/dns4/fiber.local")
    const long = `/dns4/${"a".repeat(50)}/tcp/8119`
    expect(truncateMultiaddr(long)).toBe(
      `${long.slice(0, 22)}…${long.slice(-10)}`,
    )
  })
})
