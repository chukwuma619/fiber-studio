import { afterEach, describe, expect, it, vi } from "vitest"
import {
  canAbandonChannel,
  canCloseChannel,
  canForceCloseChannel,
  channelFundingDirectionLabel,
  channelPaymentDirectionLabel,
  channelStateBadgeColor,
  channelStateDisplayLabel,
  channelStatusLabel,
  comparePaymentsByRecentActivity,
  defaultChannelCloseMethod,
  filterInvoices,
  formatRelativeTime,
  formatRouteHopsShort,
  fundingTxHashFromOutpoint,
  invoiceCurrencyLabel,
  invoiceStatusDisplayLabel,
  isChannelPending,
  parseExistingPaymentSession,
  paymentErrorSuggestsOpenChannels,
  paymentErrorSummary,
  paymentKindLabel,
  paymentRouteBadgeLabel,
  paymentStatusBadgeColor,
  requiredWalletCkbForOpen,
  sanitizeRpcError,
  sortInvoicesForDisplay,
  sortPaymentsByRecentActivity,
  truncateLockScriptArgs,
  validateHumanAmount,
} from "./format"

const TX =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

describe("formatRelativeTime", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("buckets timestamps from the current clock", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-01T12:00:00Z"))
    const now = Date.now()

    expect(formatRelativeTime(now + 5_000)).toBe("just now")
    expect(formatRelativeTime(now - 30_000)).toBe("just now")
    expect(formatRelativeTime(now - 5 * 60_000)).toBe("5 min ago")
    expect(formatRelativeTime(now - 60 * 60_000)).toBe("1 hr ago")
    expect(formatRelativeTime(now - 24 * 60 * 60_000)).toBe("1 day ago")
    expect(formatRelativeTime(now - 3 * 24 * 60 * 60_000)).toBe("3 days ago")
  })
})

describe("channel state", () => {
  it("labels ready channels by which side is running out of funds", () => {
    expect(channelStatusLabel("ChannelReady", 10)).toBe("Low outbound")
    expect(channelStatusLabel("ChannelReady", 90)).toBe("Low inbound")
    expect(channelStatusLabel("ChannelReady", 50)).toBe("Active")
    expect(channelStatusLabel("NegotiatingFunding", 50)).toBe("Opening")
    expect(channelStatusLabel("AwaitingFundingTx", 0)).toBe("Awaiting Funding Tx")
  })

  it("describes funding and payment direction independently", () => {
    expect(channelFundingDirectionLabel(true)).toBe("Inbound")
    expect(channelFundingDirectionLabel(false)).toBe("Outbound")
    expect(channelPaymentDirectionLabel(false, false)).toBe("Two-way")
    expect(channelPaymentDirectionLabel(true, true)).toBe("Receive only")
    expect(channelPaymentDirectionLabel(false, true)).toBe("Send only")
  })

  it("colors badges from state before balance skew", () => {
    expect(channelStateBadgeColor("ShuttingDown", 50)).toBe("red")
    expect(channelStateBadgeColor("Stale", 50)).toBe("amber")
    expect(channelStateBadgeColor("NegotiatingFunding", 50)).toBe("amber")
    expect(channelStateBadgeColor("ChannelReady", 10)).toBe("amber")
    expect(channelStateBadgeColor("ChannelReady", 50)).toBe("green")
  })

  it("uses the same display names the channel list shows", () => {
    expect(channelStateDisplayLabel("AwaitingTxSignatures")).toBe(
      "Awaiting signatures",
    )
    expect(channelStateDisplayLabel("Stale")).toBe("Needs sync")
  })
})

describe("channel close actions", () => {
  it("allows abandon only before funding is signed or broadcast", () => {
    expect(
      canAbandonChannel({ state: "NegotiatingFunding" }),
    ).toBe(true)
    expect(
      canAbandonChannel({
        state: "AwaitingChannelReady",
        channelOutpoint: "0xabc",
      }),
    ).toBe(false)
    expect(
      canAbandonChannel({
        state: "AwaitingChannelReady",
        latestCommitmentTransactionHash: "0xabc",
      }),
    ).toBe(false)
    expect(canAbandonChannel({ state: "ChannelReady" })).toBe(false)
    expect(canAbandonChannel({ state: "ShuttingDown" })).toBe(false)
    expect(canAbandonChannel({ state: "Closed" })).toBe(false)
    expect(canAbandonChannel({ state: "Stale" })).toBe(false)
  })

  it("force-closes a ready channel, a closing channel, or a funded stuck open", () => {
    expect(canForceCloseChannel({ state: "ChannelReady" })).toBe(true)
    expect(canForceCloseChannel({ state: "ShuttingDown" })).toBe(true)
    expect(
      canForceCloseChannel({
        state: "AwaitingChannelReady",
        latestCommitmentTransactionHash: "0xabc",
      }),
    ).toBe(true)
    expect(canForceCloseChannel({ state: "AwaitingChannelReady" })).toBe(false)
    expect(canForceCloseChannel({ state: "NegotiatingFunding" })).toBe(false)
  })

  it("offers cooperative close only when the channel is ready", () => {
    expect(canCloseChannel({ state: "ChannelReady" })).toBe(true)
    expect(defaultChannelCloseMethod({ state: "ChannelReady" })).toBe(
      "cooperative",
    )
    expect(
      defaultChannelCloseMethod({
        state: "AwaitingChannelReady",
        latestCommitmentTransactionHash: "0xabc",
      }),
    ).toBe("force")
    expect(canCloseChannel({ state: "NegotiatingFunding" })).toBe(false)
  })

  it("treats only in-progress opens as pending", () => {
    expect(isChannelPending("NegotiatingFunding")).toBe(true)
    expect(isChannelPending("AwaitingTxSignatures")).toBe(true)
    expect(isChannelPending("ChannelReady")).toBe(false)
    expect(isChannelPending("ShuttingDown")).toBe(false)
    expect(isChannelPending("Closed")).toBe(false)
    expect(isChannelPending("Stale")).toBe(false)
  })
})

describe("validateHumanAmount", () => {
  it("accepts a positive amount within the asset precision", () => {
    expect(validateHumanAmount("1.5", 8)).toBeNull()
    expect(validateHumanAmount(" 1.2300 ", 2)).toBeNull()
    expect(validateHumanAmount("0.00000001", 8)).toBeNull()
  })

  it("rejects empty, zero, junk, and extra non-zero decimals", () => {
    expect(validateHumanAmount("", 8)).toMatch(/greater than zero/)
    expect(validateHumanAmount("0", 8)).toMatch(/greater than zero/)
    expect(validateHumanAmount("0.000", 2)).toMatch(/greater than zero/)
    expect(validateHumanAmount("-1", 8)).toMatch(/greater than zero/)
    expect(validateHumanAmount("1e2", 8)).toMatch(/greater than zero/)
    expect(validateHumanAmount("1.231", 2)).toMatch(/2 decimal places/)
  })
})

describe("payments and invoices", () => {
  it("maps payment status onto badge color", () => {
    expect(paymentStatusBadgeColor("Success")).toBe("green")
    expect(paymentStatusBadgeColor("Failed")).toBe("red")
    expect(paymentStatusBadgeColor("Inflight")).toBe("amber")
    expect(paymentStatusBadgeColor("Created")).toBe("sky")
    expect(paymentStatusBadgeColor("Other")).toBe("zinc")
  })

  it("labels invoice currency from the selected network", () => {
    expect(invoiceCurrencyLabel("mainnet")).toBe("Fibb")
    expect(invoiceCurrencyLabel("testnet")).toBe("Fibt")
    expect(invoiceCurrencyLabel(null)).toBe("Fibt")
  })

  it("filters and sorts invoices by what the user needs to act on", () => {
    const invoices = [
      { id: "paid", status: "Paid" },
      { id: "open", status: "Open" },
      { id: "expired", status: "Expired" },
      { id: "incoming", status: "Received" },
    ]

    expect(filterInvoices(invoices, "active").map((item) => item.id)).toEqual([
      "open",
      "incoming",
    ])
    expect(filterInvoices(invoices, "paid").map((item) => item.id)).toEqual([
      "paid",
    ])
    expect(filterInvoices(invoices, "all")).toHaveLength(4)
    expect(
      sortInvoicesForDisplay(invoices).map((item) => item.status),
    ).toEqual(["Received", "Open", "Paid", "Expired"])
  })

  it("sorts payments by last update, then creation, then hash", () => {
    const older = {
      paymentHash: "0x2",
      createdAt: 10,
      lastUpdatedAt: 20,
    }
    const newer = {
      paymentHash: "0x1",
      createdAt: 5,
      lastUpdatedAt: 30,
    }
    const sameTimeLowHash = {
      paymentHash: "0x0",
      createdAt: 10,
      lastUpdatedAt: 20,
    }

    expect(comparePaymentsByRecentActivity(older, newer)).toBeGreaterThan(0)
    expect(
      comparePaymentsByRecentActivity(sameTimeLowHash, older),
    ).toBeLessThan(0)
    expect(
      sortPaymentsByRecentActivity([older, newer, sameTimeLowHash]).map(
        (payment) => payment.paymentHash,
      ),
    ).toEqual(["0x1", "0x0", "0x2"])
  })

  it("describes routes and payment kinds", () => {
    expect(paymentRouteBadgeLabel(2)).toBe("Multi-hop")
    expect(paymentRouteBadgeLabel(1)).toBe("Direct")
    expect(paymentKindLabel("keysend")).toBe("Keysend")
    expect(paymentKindLabel("rebalance")).toBe("Rebalance")
    expect(paymentKindLabel("other")).toBe("Payment")
    expect(invoiceStatusDisplayLabel("Open")).toBe("Awaiting payment")
    expect(invoiceStatusDisplayLabel("Received")).toBe("Payment incoming")
  })
})

describe("funding and script display", () => {
  it("reads the transaction hash from a cell outpoint", () => {
    expect(fundingTxHashFromOutpoint(`0x${TX}00000000`)).toBe(`0x${TX}`)
    expect(fundingTxHashFromOutpoint(`${TX.toUpperCase()}ffff`)).toBe(`0x${TX}`)
    expect(fundingTxHashFromOutpoint(null)).toBeNull()
    expect(fundingTxHashFromOutpoint("0xabc")).toBeNull()
    expect(fundingTxHashFromOutpoint(`0x${TX.slice(0, 32)}zz`)).toBeNull()
  })

  it("shortens lock-script args", () => {
    expect(truncateLockScriptArgs("0xabcd")).toBe("0xabcd")
    expect(truncateLockScriptArgs("abcdef1234567890")).toBe("0xabcdef…7890")
  })

  it("shortens a route and marks a longer path", () => {
    expect(formatRouteHopsShort([])).toBe("—")
    expect(formatRouteHopsShort(["abcd", "efgh"])).toBe("abcd → efgh")
    expect(
      formatRouteHopsShort(
        ["02aaaaaaaaaaaa", "02bbbbbbbbbbbb", "02cccccccccccc", "02dddddddddddd"],
        2,
      ),
    ).toBe("02aaaa…aaaa → 02bbbb…bbbb → …")
  })
})

describe("rpc errors", () => {
  it("strips transport wrappers down to the node message", () => {
    expect(
      sanitizeRpcError(
        "fnn RPC error: (-32000) channel funding failed [data: 0x01]",
      ),
    ).toBe("channel funding failed")
    expect(
      sanitizeRpcError("Could not reach the Fiber node RPC: connection refused"),
    ).toBe("connection refused")
    expect(sanitizeRpcError("   ")).toBe("")
  })

  it("recognizes a duplicate payment session", () => {
    const error =
      "Payment session already exists: Hash256(0xabc123) with payment session status: Inflight"
    expect(parseExistingPaymentSession(error)).toEqual({
      paymentHash: "0xabc123",
      status: "Inflight",
    })
    expect(paymentErrorSummary(error)).toBe(
      "This payment is already in progress.",
    )
    expect(paymentErrorSuggestsOpenChannels(error)).toBe(false)
    expect(paymentErrorSuggestsOpenChannels(null)).toBe(false)
  })

  it("turns path and liquidity failures into actions the user can take", () => {
    expect(paymentErrorSummary("no path found to payee")).toMatch(/No path/)
    expect(paymentErrorSummary("Insufficient balance")).toMatch(
      /spendable balance/,
    )
    expect(paymentErrorSummary("Failed to build route")).toMatch(/Add funds/)
    expect(paymentErrorSummary("allow_self_payment rejected")).toMatch(
      /two ready channels/,
    )
    expect(paymentErrorSuggestsOpenChannels("no path found")).toBe(true)
    expect(paymentErrorSuggestsOpenChannels("peer timed out")).toBe(false)
  })

  it("explains each finished session status", () => {
    expect(
      paymentErrorSummary(
        "Payment session already exists: Hash256(0xaa) with payment session status: Success",
      ),
    ).toMatch(/already completed/)
    expect(
      paymentErrorSummary(
        "Payment session already exists: Hash256(0xaa) with payment session status: Failed",
      ),
    ).toMatch(/new invoice/)
    expect(
      paymentErrorSummary(
        "Payment session already exists: Hash256(0xaa) with payment session status: Created",
      ),
    ).toMatch(/already in progress/)
  })
})

describe("requiredWalletCkbForOpen", () => {
  it("adds the channel reserve and the open fee buffer", () => {
    expect(requiredWalletCkbForOpen(1000)).toBe(1110)
    expect(requiredWalletCkbForOpen(0)).toBe(110)
  })
})
