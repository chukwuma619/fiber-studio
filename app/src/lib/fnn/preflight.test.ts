import { describe, expect, it } from "vitest"
import type { PreviewSendPaymentResult } from "./types"
import { classifyPreflight, parseAmountRaw, parseDecimalToRaw } from "./preflight"
import { ckbHex, rawHex, testChannel, testSnapshot } from "../../test/fixtures"

const SELF =
  "02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
const PEER =
  "02bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
const PAYEE =
  "02cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"

function preview(
  hops: string[],
  feeShannons = "0x0",
): PreviewSendPaymentResult {
  return {
    feeShannons,
    feeDisplay: "0 CKB",
    amountDisplay: "1 CKB",
    assetSymbol: "CKB",
    routeHops: hops,
  }
}

describe("parseDecimalToRaw", () => {
  it("scales a human amount to the asset's smallest unit", () => {
    expect(parseDecimalToRaw("1.25", 8)).toBe(125_000_000n)
    expect(parseDecimalToRaw("1.2", 2)).toBe(120n)
    expect(parseDecimalToRaw("0.00000001", 8)).toBe(1n)
    expect(parseDecimalToRaw("5", 0)).toBe(5n)
  })

  it("accepts trailing zeroes past the precision and rejects extra value", () => {
    expect(parseDecimalToRaw("1.2300", 2)).toBe(123n)
    expect(parseDecimalToRaw("1.0", 0)).toBe(1n)
    expect(parseDecimalToRaw("1.2310", 2)).toBeNull()
    expect(parseDecimalToRaw("1.1", 0)).toBeNull()
  })

  it("rejects malformed amounts and still parses a literal zero", () => {
    expect(parseDecimalToRaw("", 8)).toBeNull()
    expect(parseDecimalToRaw(".5", 8)).toBeNull()
    expect(parseDecimalToRaw("1e2", 8)).toBeNull()
    expect(parseDecimalToRaw("-1", 8)).toBeNull()
    expect(parseDecimalToRaw("0.00", 2)).toBe(0n)
  })
})

describe("parseAmountRaw", () => {
  it("parses hex and ignores empty or invalid values", () => {
    expect(parseAmountRaw("0x10")).toBe(16n)
    expect(parseAmountRaw("")).toBeNull()
    expect(parseAmountRaw(null)).toBeNull()
    expect(parseAmountRaw("0xzz")).toBeNull()
  })
})

describe("classifyPreflight", () => {
  it("reports a ready route and the spare outbound on the first hop", () => {
    const report = classifyPreflight({
      ownPubkey: SELF,
      payeePubkey: PAYEE,
      amountRaw: 100_000_000n,
      assetSymbol: "CKB",
      routePreview: preview([SELF, PEER, PAYEE]),
      pathFindError: null,
      snapshot: testSnapshot({
        ownPubkey: SELF,
        graphReady: true,
        graphNodeCount: 8,
        channels: [
          testChannel({
            pubkey: PEER,
            localBalance: ckbHex(100n),
            localBalanceDisplay: "100 CKB",
          }),
        ],
      }),
    })

    expect(report.status).toBe("ready")
    expect(report.primary.code).toBe("route_ready")
    expect(report.summary.hopCount).toBe(3)
    expect(report.summary.liquidityHeadroomDisplay).toBe("99 CKB")
    expect(report.primary.recommendation).toMatch(/irreversible/)
  })

  it("warns when the first hop would be left with under 10 CKB", () => {
    const report = classifyPreflight({
      ownPubkey: SELF,
      payeePubkey: PAYEE,
      amountRaw: ckbHexAmount(5n),
      assetSymbol: "ckb",
      routePreview: preview([PEER]),
      pathFindError: null,
      snapshot: testSnapshot({
        channels: [
          testChannel({
            pubkey: `0x${PEER}`,
            localBalance: ckbHex(12n),
          }),
        ],
      }),
    })

    expect(report.status).toBe("risky")
    expect(report.primary.code).toBe("thin_liquidity_headroom")
    expect(report.findings.map((finding) => finding.code)).toEqual([
      "route_ready",
      "thin_liquidity_headroom",
    ])
  })

  it("blocks a found route that no longer fits on the first hop", () => {
    const report = classifyPreflight({
      ownPubkey: SELF,
      payeePubkey: PAYEE,
      amountRaw: ckbHexAmount(10n),
      assetSymbol: "CKB",
      routePreview: preview([PEER], ckbHex(1n)),
      pathFindError: null,
      snapshot: testSnapshot({
        channels: [
          testChannel({
            pubkey: PEER,
            localBalance: ckbHex(5n),
          }),
        ],
      }),
    })

    expect(report.status).toBe("blocked")
    expect(report.primary.code).toBe("insufficient_local_liquidity")
    expect(report.primary.reason).toMatch(/11 CKB/)
    expect(report.primary.reason).toMatch(/5 CKB/)
  })

  it("blocks when no local channel can cover the amount", () => {
    const report = classifyPreflight({
      ownPubkey: SELF,
      payeePubkey: PAYEE,
      amountRaw: ckbHexAmount(20n),
      assetSymbol: "CKB",
      routePreview: null,
      pathFindError: "no path found",
      snapshot: testSnapshot({
        graphReady: true,
        graphNodeCount: 4,
        channels: [
          testChannel({
            pubkey: PEER,
            localBalance: ckbHex(5n),
          }),
        ],
        payee: {
          inGraph: true,
          neighborCount: 1,
          neighborPubkeys: [PEER],
          sharesOfficialRelay: true,
          isOfficialRelay: false,
          lookupComplete: true,
        },
      }),
    })

    expect(report.status).toBe("blocked")
    expect(report.primary.code).toBe("insufficient_local_liquidity")
    expect(report.findings.map((finding) => finding.code)).toEqual([
      "insufficient_local_liquidity",
    ])
  })

  it("blames a later hop when local balance is enough", () => {
    const report = classifyPreflight({
      ownPubkey: SELF,
      payeePubkey: PAYEE,
      amountRaw: ckbHexAmount(1n),
      assetSymbol: "CKB",
      routePreview: null,
      pathFindError: "Insufficient balance on an intermediate hop",
      snapshot: testSnapshot({
        graphReady: true,
        graphNodeCount: 4,
        channels: [
          testChannel({
            pubkey: PEER,
            localBalance: ckbHex(50n),
          }),
        ],
        payee: {
          inGraph: true,
          neighborCount: 1,
          neighborPubkeys: [PEER],
          sharesOfficialRelay: true,
          isOfficialRelay: false,
          lookupComplete: true,
        },
      }),
    })

    expect(report.primary.code).toBe("insufficient_hop_liquidity")
  })

  it("blocks a direct peer that is not connected", () => {
    const report = classifyPreflight({
      ownPubkey: SELF,
      payeePubkey: PAYEE,
      amountRaw: ckbHexAmount(1n),
      assetSymbol: "CKB",
      routePreview: null,
      pathFindError: "no path found",
      snapshot: testSnapshot({
        graphReady: true,
        graphNodeCount: 2,
        channels: [
          testChannel({
            pubkey: PAYEE.toUpperCase(),
            localBalance: ckbHex(10n),
          }),
        ],
        connectedPeerPubkeys: [PEER],
      }),
    })

    expect(report.status).toBe("blocked")
    expect(report.primary.code).toBe("direct_peer_offline")
  })

  it("names a closing direct channel and the lack of any ready channel", () => {
    const report = classifyPreflight({
      ownPubkey: SELF,
      payeePubkey: PAYEE,
      amountRaw: null,
      assetSymbol: "CKB",
      routePreview: null,
      pathFindError: "no path found",
      snapshot: testSnapshot({
        graphReady: true,
        graphNodeCount: 2,
        channels: [
          testChannel({
            pubkey: PAYEE,
            state: "ShuttingDown",
          }),
        ],
      }),
    })

    expect(report.findings.map((finding) => finding.code)).toEqual([
      "channel_not_ready",
      "no_ready_channels",
    ])
    expect(report.primary.reason).toMatch(/Closing/)
  })

  it("does not invent channel blockers when the snapshot itself failed", () => {
    const report = classifyPreflight({
      ownPubkey: null,
      payeePubkey: PAYEE,
      amountRaw: ckbHexAmount(1n),
      assetSymbol: "CKB",
      routePreview: null,
      pathFindError: "no path found",
      snapshotError: "rpc unavailable",
      snapshot: testSnapshot(),
    })

    expect(report.status).toBe("blocked")
    expect(report.findings.map((finding) => finding.code)).toEqual([
      "path_not_found",
      "snapshot_unavailable",
    ])
  })

  it("keeps a found route and warns that diagnostics are incomplete", () => {
    const report = classifyPreflight({
      ownPubkey: SELF,
      payeePubkey: PAYEE,
      amountRaw: ckbHexAmount(1n),
      assetSymbol: "CKB",
      routePreview: preview([PEER]),
      pathFindError: null,
      snapshotError: "rpc unavailable",
      snapshot: testSnapshot({
        channels: [
          testChannel({
            pubkey: PEER,
            localBalance: ckbHex(100n),
          }),
        ],
      }),
    })

    expect(report.status).toBe("risky")
    expect(report.primary.code).toBe("snapshot_unavailable")
    expect(report.findings[0]?.code).toBe("route_ready")
  })

  it("explains an empty node as both unfunded and unsynced", () => {
    const report = classifyPreflight({
      ownPubkey: SELF,
      payeePubkey: PAYEE,
      amountRaw: ckbHexAmount(1n),
      assetSymbol: "CKB",
      routePreview: null,
      pathFindError: "no path found",
      snapshot: testSnapshot({ graphReady: false, graphNodeCount: 0 }),
    })

    expect(report.findings.map((finding) => finding.code)).toEqual([
      "no_ready_channels",
      "empty_gossip_graph",
    ])
    expect(report.primary.code).toBe("no_ready_channels")
  })

  it("blocks a payee that does not share a relay with this node", () => {
    const report = classifyPreflight({
      ownPubkey: SELF,
      payeePubkey: PAYEE,
      amountRaw: 1n,
      assetSymbol: "CKB",
      routePreview: null,
      pathFindError: "no path found",
      snapshot: testSnapshot({
        graphReady: true,
        graphNodeCount: 6,
        localOfficialRelayChannelReady: true,
        channels: [
          testChannel({
            pubkey: PEER,
            localBalance: ckbHex(20n),
          }),
        ],
        payee: {
          inGraph: true,
          neighborCount: 1,
          neighborPubkeys: [PAYEE],
          sharesOfficialRelay: false,
          isOfficialRelay: false,
          lookupComplete: true,
        },
      }),
    })

    expect(report.primary.code).toBe("payee_no_common_relays")
  })

  it("uses jit wording when the route stops at a liquidity node", () => {
    const report = classifyPreflight({
      ownPubkey: SELF,
      payeePubkey: PAYEE,
      amountRaw: ckbHexAmount(1n),
      assetSymbol: "CKB",
      jit: true,
      routePreview: preview([PEER]),
      pathFindError: null,
      snapshot: testSnapshot({
        channels: [
          testChannel({
            pubkey: PEER,
            localBalance: ckbHex(100n),
          }),
        ],
      }),
    })

    expect(report.primary.recommendation).toMatch(/liquidity node/)
  })

  it("warns on a udt route whose spare balance is small relative to the send", () => {
    const report = classifyPreflight({
      ownPubkey: SELF,
      payeePubkey: PAYEE,
      amountRaw: 950n,
      assetSymbol: "USDI",
      routePreview: preview([PEER]),
      pathFindError: null,
      snapshot: testSnapshot({
        channels: [
          testChannel({
            pubkey: PEER,
            assetSymbol: "USDI",
            localBalance: rawHex(1000n),
          }),
        ],
      }),
    })

    expect(report.primary.code).toBe("thin_liquidity_headroom")
    expect(report.summary.liquidityHeadroomDisplay).toBe("50 USDI")
  })

  it("does not treat an existing payment session as a missing path", () => {
    const report = classifyPreflight({
      ownPubkey: SELF,
      payeePubkey: PAYEE,
      amountRaw: 1n,
      assetSymbol: "CKB",
      routePreview: null,
      pathFindError:
        "Payment session already exists: Hash256(0xabc) with payment session status: Inflight",
      snapshot: testSnapshot(),
    })

    expect(report.findings.map((finding) => finding.code)).toEqual([
      "route_ready",
    ])
  })
})

function ckbHexAmount(ckb: bigint): bigint {
  return ckb * 100_000_000n
}
