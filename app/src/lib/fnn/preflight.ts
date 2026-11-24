import { formatCkb, parseHexU128 } from "./ckbAmount"
import { parseExistingPaymentSession, sanitizeRpcError } from "./format"
import { pubkeysEqual } from "./relay"
import type {
  HomeChannel,
  PreflightPayeeGraph,
  PreflightSnapshot,
  PreviewSendPaymentResult,
} from "./types"

export type PreflightSeverity = "ok" | "warning" | "blocker"

export type PreflightStatus = "ready" | "risky" | "blocked"

export type PreflightFindingCode =
  | "route_ready"
  | "empty_gossip_graph"
  | "no_ready_channels"
  | "channel_not_ready"
  | "direct_peer_offline"
  | "insufficient_local_liquidity"
  | "insufficient_hop_liquidity"
  | "invoice_payee_mismatch"
  | "payee_no_common_relays"
  | "payee_no_inbound_path"
  | "thin_liquidity_headroom"
  | "snapshot_unavailable"
  | "path_not_found"

export type PreflightAction = {
  label: string
  href: string
}

export type PreflightFinding = {
  code: PreflightFindingCode
  severity: PreflightSeverity
  title: string
  reason: string
  recommendation: string
  action: PreflightAction | null
}

export type PreflightSummary = {
  hopCount: number
  feeDisplay: string | null
  liquidityHeadroomDisplay: string | null
  firstHopLocalDisplay: string | null
  routeHops: string[]
}

export type PreflightReport = {
  status: PreflightStatus
  findings: PreflightFinding[]
  primary: PreflightFinding
  summary: PreflightSummary
}

export type PreflightInput = {
  ownPubkey: string | null
  payeePubkey: string | null
  amountRaw: bigint | null
  assetSymbol: string
  routePreview: PreviewSendPaymentResult | null
  pathFindError: string | null
  snapshot: PreflightSnapshot
  /** Set when the snapshot RPC failed; do not infer graph/channel blockers from an empty snapshot. */
  snapshotError?: string | null
  jit?: boolean
}

const THIN_HEADROOM_CKB_SHANNONS = 1_000_000_000n // 10 CKB
const THIN_HEADROOM_RATIO = 10n

export const EMPTY_PREFLIGHT_SNAPSHOT: PreflightSnapshot = {
  ownPubkey: null,
  channels: [],
  connectedPeerPubkeys: [],
  graphNodeCount: 0,
  graphReady: false,
  officialRelayPubkeys: [],
  localOfficialRelayConnected: false,
  localOfficialRelayChannelReady: false,
  payee: null,
}

export function parseAmountRaw(hex: string | null | undefined): bigint | null {
  if (!hex || !hex.trim()) return null
  try {
    return parseHexU128(hex)
  } catch {
    return null
  }
}

/** Parse a human decimal into smallest units. Trailing zeroes may pad to `decimals`. */
export function parseDecimalToRaw(
  amount: string,
  decimals: number,
): bigint | null {
  const trimmed = amount.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null

  const [wholePart, fracPart = ""] = trimmed.split(".")
  if (fracPart.length > decimals) {
    const significant = fracPart.slice(decimals).replace(/0+$/, "")
    if (significant.length > 0) return null
  }

  const fracPadded = fracPart.padEnd(decimals, "0").slice(0, decimals)
  try {
    const whole = BigInt(wholePart)
    const frac = fracPadded.length > 0 ? BigInt(fracPadded) : 0n
    const scale = 10n ** BigInt(decimals)
    return whole * scale + frac
  } catch {
    return null
  }
}

export function classifyPreflight(input: PreflightInput): PreflightReport {
  const pathFindError = input.pathFindError
    ? sanitizeRpcError(input.pathFindError)
    : null
  const existing = pathFindError
    ? parseExistingPaymentSession(pathFindError)
    : null
  const routeHops = input.routePreview?.routeHops ?? []
  const pathFound = routeHops.length > 0
  const pathFindFailed = Boolean(pathFindError) && !existing && !pathFound

  const findings: PreflightFinding[] = []
  const summary = buildSummary(input)

  if (pathFindFailed) {
    if (input.snapshotError) {
      findings.push(findingForCode("path_not_found"))
      findings.push(findingForCode("snapshot_unavailable"))
    } else {
      findings.push(...classifyFailure(input, pathFindError ?? ""))
    }
  }

  if (pathFound) {
    const thinHeadroom = classifyThinHeadroom(input, summary)
    if (thinHeadroom) {
      findings.push(thinHeadroom)
    }
    if (input.snapshotError) {
      findings.push(findingForCode("snapshot_unavailable"))
    }
  }

  if (pathFound || findings.length === 0) {
    findings.unshift(
      findingForCode("route_ready", summary, input.payeePubkey, undefined, input.jit),
    )
  }

  const status = reportStatus(findings)
  const primary = selectPrimaryFinding(findings, pathFound)

  return {
    status,
    findings,
    primary,
    summary,
  }
}

function classifyFailure(
  input: PreflightInput,
  pathFindError: string,
): PreflightFinding[] {
  const findings: PreflightFinding[] = []
  const payee = input.payeePubkey
  const channels = input.snapshot.channels
  const payeeChannels = payee
    ? channels.filter((channel) => pubkeysEqual(channel.pubkey, payee))
    : []
  const payeeReady = payeeChannels.filter(
    (channel) => channel.state === "ChannelReady",
  )
  const payeeClosing = payeeChannels.filter(
    (channel) => channel.state === "ShuttingDown",
  )
  const payeeNegotiating = payeeChannels.filter((channel) =>
    isNegotiatingState(channel.state),
  )
  const payeeConnected =
    Boolean(payee) &&
    input.snapshot.connectedPeerPubkeys.some((peer) =>
      pubkeysEqual(peer, payee ?? ""),
    )
  const readyChannels = channels.filter(
    (channel) => channel.state === "ChannelReady",
  )
  const matchingReady = readyChannels.filter((channel) =>
    assetSymbolsMatch(channel.assetSymbol, input.assetSymbol),
  )
  const maxOutbound = matchingReady.reduce((max, channel) => {
    const local = parseAmountRaw(channel.localBalance) ?? 0n
    return local > max ? local : max
  }, 0n)
  const amount = input.amountRaw ?? 0n
  const isDirectChannelPeer = payeeChannels.length > 0
  const graph = input.snapshot.payee

  if (payeeChannels.length > 0 && payeeReady.length === 0) {
    findings.push(
      findingForCode(
        "channel_not_ready",
        undefined,
        payee,
        channelNotReadyDetail(payeeClosing, payeeNegotiating),
      ),
    )
  }

  if (payeeReady.length > 0 && !payeeConnected) {
    findings.push(findingForCode("direct_peer_offline", undefined, payee))
  }

  if (readyChannels.length === 0 && payeeReady.length === 0) {
    findings.push(findingForCode("no_ready_channels", undefined, payee, undefined, input.jit))
  }

  if (
    amount > 0n &&
    matchingReady.length > 0 &&
    maxOutbound < amount
  ) {
    findings.push(
      findingForCode("insufficient_local_liquidity", undefined, payee, {
        needed: formatAssetAmount(amount, input.assetSymbol),
        available: formatAssetAmount(maxOutbound, input.assetSymbol),
      }),
    )
  } else if (isLiquidityPathError(pathFindError)) {
    findings.push(findingForCode("insufficient_hop_liquidity"))
  }

  if (
    !input.snapshot.graphReady &&
    input.snapshot.graphNodeCount === 0 &&
    !isDirectChannelPeer
  ) {
    findings.push(findingForCode("empty_gossip_graph"))
  }

  if (payee && !isDirectChannelPeer) {
    if (isKnownPayeeMismatch(graph, payee, input.snapshot)) {
      findings.push(
        findingForCode("invoice_payee_mismatch", undefined, payee, undefined, input.jit),
      )
    } else if (graph?.lookupComplete && graph.inGraph && graph.neighborCount === 0) {
      findings.push(
        findingForCode("payee_no_inbound_path", undefined, payee, undefined, input.jit),
      )
    } else if (
      graph?.lookupComplete &&
      !graph.inGraph &&
      !graph.isOfficialRelay &&
      input.snapshot.channels.length === 0
    ) {
      findings.push(
        findingForCode("payee_no_inbound_path", undefined, payee, undefined, input.jit),
      )
    }

    if (lacksCommonRelay(input.snapshot, graph, isDirectChannelPeer)) {
      findings.push(
        findingForCode("payee_no_common_relays", undefined, payee, undefined, input.jit),
      )
    }
  }

  if (findings.length === 0) {
    findings.push(findingForCode("path_not_found", undefined, payee, undefined, input.jit))
  }

  return findings
}

function classifyThinHeadroom(
  input: PreflightInput,
  summary: PreflightSummary,
): PreflightFinding | null {
  const amount = input.amountRaw ?? 0n
  if (amount <= 0n || summary.liquidityHeadroomDisplay == null) {
    return null
  }

  const firstHop = firstHopPubkey(input)
  if (!firstHop) return null

  const channel = findReadyChannelToPeer(
    input.snapshot.channels,
    firstHop,
    input.assetSymbol,
  )
  if (!channel) return null

  const local = parseAmountRaw(channel.localBalance) ?? 0n
  const fee =
    input.assetSymbol.toUpperCase() === "CKB" && input.routePreview
      ? (parseAmountRaw(input.routePreview.feeShannons) ?? 0n)
      : 0n
  const headroom = local - amount - fee
  if (headroom < 0n) {
    return findingForCode("insufficient_local_liquidity", summary, input.payeePubkey, {
      needed: formatAssetAmount(amount + fee, input.assetSymbol),
      available: formatAssetAmount(local, input.assetSymbol),
    })
  }

  const thinAbsolute =
    input.assetSymbol.toUpperCase() === "CKB" &&
    headroom < THIN_HEADROOM_CKB_SHANNONS
  const thinRelative = headroom * THIN_HEADROOM_RATIO < amount
  if (!thinAbsolute && !thinRelative) {
    return null
  }

  return findingForCode("thin_liquidity_headroom", summary, input.payeePubkey)
}

function buildSummary(input: PreflightInput): PreflightSummary {
  const routeHops = input.routePreview?.routeHops ?? []
  const firstHop = firstHopPubkey(input)
  const firstHopChannel = firstHop
    ? findReadyChannelToPeer(
        input.snapshot.channels,
        firstHop,
        input.assetSymbol,
      )
    : null
  const amount = input.amountRaw ?? 0n
  const fee =
    input.assetSymbol.toUpperCase() === "CKB" && input.routePreview
      ? (parseAmountRaw(input.routePreview.feeShannons) ?? 0n)
      : 0n

  let liquidityHeadroomDisplay: string | null = null
  if (firstHopChannel && amount > 0n) {
    const local = parseAmountRaw(firstHopChannel.localBalance) ?? 0n
    const headroom = local - amount - fee
    if (headroom >= 0n) {
      liquidityHeadroomDisplay = formatAssetAmount(headroom, input.assetSymbol)
    }
  }

  return {
    hopCount: routeHops.length,
    feeDisplay: input.routePreview?.feeDisplay ?? null,
    liquidityHeadroomDisplay,
    firstHopLocalDisplay: firstHopChannel?.localBalanceDisplay ?? null,
    routeHops,
  }
}

function firstHopPubkey(input: PreflightInput): string | null {
  const hops = input.routePreview?.routeHops ?? []
  const own = input.ownPubkey ?? input.snapshot.ownPubkey
  for (const hop of hops) {
    if (!own || !pubkeysEqual(hop, own)) {
      return hop
    }
  }
  return hops[0] ?? input.payeePubkey
}

function findReadyChannelToPeer(
  channels: HomeChannel[],
  peer: string,
  assetSymbol: string,
): HomeChannel | null {
  return (
    channels.find(
      (channel) =>
        channel.state === "ChannelReady" &&
        pubkeysEqual(channel.pubkey, peer) &&
        assetSymbolsMatch(channel.assetSymbol, assetSymbol),
    ) ??
    channels.find(
      (channel) =>
        channel.state === "ChannelReady" && pubkeysEqual(channel.pubkey, peer),
    ) ??
    null
  )
}

function isNegotiatingState(state: string): boolean {
  return (
    state === "NegotiatingFunding" ||
    state === "AwaitingTxSignatures" ||
    state === "CollaboratingFundingTx"
  )
}

function assetSymbolsMatch(left: string, right: string): boolean {
  return left.trim().toUpperCase() === right.trim().toUpperCase()
}

function isLiquidityPathError(error: string): boolean {
  return /Insufficient balance|max outbound liquidity|outbound liquidity/i.test(
    error,
  )
}

function isKnownPayeeMismatch(
  graph: PreflightPayeeGraph | null,
  payee: string,
  snapshot: PreflightSnapshot,
): boolean {
  const knownChannelPeer = snapshot.channels.some((channel) =>
    pubkeysEqual(channel.pubkey, payee),
  )
  if (knownChannelPeer) return false
  if (snapshot.channels.length === 0) return false
  if (graph?.isOfficialRelay) return false
  if (graph && !graph.lookupComplete && !graph.inGraph) return false
  return !graph?.inGraph
}

function lacksCommonRelay(
  snapshot: PreflightSnapshot,
  graph: PreflightPayeeGraph | null,
  isDirectChannelPeer: boolean,
): boolean {
  if (isDirectChannelPeer) return false
  if (!graph?.lookupComplete) return false
  if (graph.isOfficialRelay || graph.sharesOfficialRelay) return false

  const localHubPubkeys = snapshot.channels
    .filter((channel) => channel.state === "ChannelReady")
    .map((channel) => channel.pubkey)
  const sharesLocalHub = graph.neighborPubkeys.some(
    (neighbor) =>
      localHubPubkeys.some((hub) => pubkeysEqual(hub, neighbor)) ||
      snapshot.connectedPeerPubkeys.some((peer) => pubkeysEqual(peer, neighbor)),
  )
  if (sharesLocalHub) return false

  // Only diagnose official-relay mismatch when this node is actually on one.
  if (
    snapshot.localOfficialRelayChannelReady ||
    snapshot.localOfficialRelayConnected
  ) {
    return !graph.sharesOfficialRelay && !graph.isOfficialRelay
  }

  return false
}

function channelNotReadyDetail(
  closing: HomeChannel[],
  negotiating: HomeChannel[],
): { stateLabel: string } {
  if (closing.length > 0) {
    return { stateLabel: "Closing" }
  }
  if (negotiating.length > 0) {
    return { stateLabel: "Opening" }
  }
  return { stateLabel: "not ready" }
}

function reportStatus(findings: PreflightFinding[]): PreflightStatus {
  if (findings.some((finding) => finding.severity === "blocker")) {
    return "blocked"
  }
  if (findings.some((finding) => finding.severity === "warning")) {
    return "risky"
  }
  return "ready"
}

function selectPrimaryFinding(
  findings: PreflightFinding[],
  pathFound: boolean,
): PreflightFinding {
  const blockers = findings.filter((finding) => finding.severity === "blocker")
  if (blockers[0]) return blockers[0]

  const warnings = findings.filter((finding) => finding.severity === "warning")
  if (warnings[0]) return warnings[0]

  const ready = findings.find((finding) => finding.code === "route_ready")
  if (ready) return ready

  if (pathFound) {
    return findingForCode("route_ready")
  }

  return findings[0] ?? findingForCode("path_not_found")
}

function formatAssetAmount(raw: bigint, symbol: string): string {
  if (symbol.toUpperCase() === "CKB") {
    return `${formatCkb(raw)} CKB`
  }
  return `${raw.toString()} ${symbol}`
}

type FindingDetail = {
  needed?: string
  available?: string
  stateLabel?: string
}

function findingForCode(
  code: PreflightFindingCode,
  summary?: PreflightSummary,
  payeePubkey?: string | null,
  detail?: FindingDetail,
  jit = false,
): PreflightFinding {
  switch (code) {
    case "route_ready": {
      const hops = summary?.hopCount ?? 0
      const hopLabel =
        hops > 1 ? `${hops}-hop route` : hops === 1 ? "Direct route" : "Route"
      const fee = summary?.feeDisplay ? ` · fee ${summary.feeDisplay}` : ""
      const headroom = summary?.liquidityHeadroomDisplay
        ? ` · ${summary.liquidityHeadroomDisplay} spare outbound`
        : ""
      return {
        code,
        severity: "ok",
        title: "Route ready",
        reason: `${hopLabel}${fee}${headroom}.`,
        recommendation: jit
          ? "The route reaches the liquidity node. That node opens a private channel to the recipient, which can take several minutes."
          : "This payment can be sent over Fiber. Off-chain sends are irreversible once confirmed.",
        action: null,
      }
    }
    case "empty_gossip_graph":
      return {
        code,
        severity: "blocker",
        title: "Network graph is empty",
        reason:
          "Your node has not synced public Fiber gossip yet, so it cannot discover multi-hop routes.",
        recommendation:
          "Connect to a public hub, then wait until the network graph appears.",
        action: { label: "Add funds", href: "/channels?action=open" },
      }
    case "no_ready_channels":
      return {
        code,
        severity: "blocker",
        title: "No spendable balance",
        reason:
          "There is no ready channel with spendable CKB to start this payment.",
        recommendation: jit
          ? "You still need a ready channel of your own to reach the liquidity node. The recipient does not need a channel yet."
          : "Add funds to open a channel with a public hub, then wait until it is ready.",
        action: { label: "Add funds", href: "/channels?action=open" },
      }
    case "channel_not_ready":
      return {
        code,
        severity: "blocker",
        title: "Direct channel is not ready",
        reason: `The channel with this peer is ${detail?.stateLabel ?? "not ready"} (Closing or still negotiating).`,
        recommendation:
          "Wait for the channel to become ready, or add funds if this one is closing.",
        action: { label: "Add funds", href: "/channels?action=open" },
      }
    case "direct_peer_offline":
      return {
        code,
        severity: "blocker",
        title: "Direct peer is offline",
        reason:
          "You have a ready channel with this node, but they are not connected right now.",
        recommendation:
          "Reconnect the peer on the Network page. Both nodes must be running for a direct payment.",
        action: { label: "Open Network", href: "/network" },
      }
    case "insufficient_local_liquidity":
      return {
        code,
        severity: "blocker",
        title: "Not enough outbound liquidity",
        reason: detail?.needed
          ? `This payment needs ${detail.needed}, but the best local channel only has ${detail.available ?? "less"} outbound.`
          : "No local channel has enough outbound balance for this amount.",
        recommendation:
          "Add funds or wait for a payment to settle so more CKB sits on your side.",
        action: { label: "Add funds", href: "/channels?action=open" },
      }
    case "insufficient_hop_liquidity":
      return {
        code,
        severity: "blocker",
        title: "A hop lacks outbound liquidity",
        reason:
          "Pathfinding found the recipient but a channel along the route does not have enough outbound capacity.",
        recommendation:
          "Try a smaller amount, wait for liquidity to rebalance, or send via a hub with more capacity.",
        action: { label: "View channels", href: "/channels" },
      }
    case "invoice_payee_mismatch":
      return {
        code,
        severity: "blocker",
        title: jit
          ? "Liquidity node is not in the graph"
          : "Invoice payee is not a known channel peer",
        reason: jit
          ? "This invoice names a liquidity node that is not in your gossip graph, so there is no route to the node that would open the channel."
          : payeePubkey
            ? "This invoice was issued by a node you do not have a channel with, and it is not in the local gossip graph."
            : "The invoice payee pubkey does not match a node you have channeled with.",
        recommendation: jit
          ? "Connect to that liquidity node, or wait until it appears in the network graph."
          : "Ask the recipient for an invoice from a node you already have a channel with, or add funds with a shared hub.",
        action: { label: "Add funds", href: "/channels?action=open" },
      }
    case "payee_no_common_relays":
      return {
        code,
        severity: "blocker",
        title: "No shared public relay",
        reason: jit
          ? "Your node and the liquidity node are not connected through a common public hub, so there is no route to the node that opens the channel."
          : "Your node and the recipient are not connected through a common public hub, so there is no multi-hop path.",
        recommendation: jit
          ? "Open a channel to a hub you share with the liquidity node, or connect to that node directly."
          : "Connect both sides to the same official relay or community hub, then open channels to that hub.",
        action: { label: "Open Network", href: "/network" },
      }
    case "payee_no_inbound_path":
      return {
        code,
        severity: "blocker",
        title: jit ? "Liquidity node has no inbound path" : "Receiver has no inbound path",
        reason: jit
          ? "The liquidity node does not appear to have a public channel that can receive this payment. The recipient does not need one yet."
          : "The payee does not appear to have a public channel that can accept this payment.",
        recommendation: jit
          ? "Wait for a route to the liquidity node, or connect to it through a shared hub."
          : "They need to open a channel to a public hub (or to you) and keep that peer online.",
        action: { label: "Open Network", href: "/network" },
      }
    case "thin_liquidity_headroom":
      return {
        code,
        severity: "warning",
        title: "Tight outbound headroom",
        reason: summary?.liquidityHeadroomDisplay
          ? `A route exists, but only ${summary.liquidityHeadroomDisplay} remains on the first hop after this send.`
          : "A route exists, but the first hop has little spare outbound liquidity.",
        recommendation:
          "You can still send. For a safer retry path, add outbound capacity before larger payments.",
        action: { label: "View channels", href: "/channels" },
      }
    case "snapshot_unavailable":
      return {
        code,
        severity: "warning",
        title: "Diagnostics incomplete",
        reason:
          "The node did not return a full channel/graph snapshot, so Fiber Studio cannot explain this route beyond PathFind.",
        recommendation:
          "Retry the preview. If it keeps failing, check that the node is running and try again.",
        action: null,
      }
    case "path_not_found":
      return {
        code,
        severity: "blocker",
        title: "No route found",
        reason: jit
          ? "Fiber could not build a path to the liquidity node. The recipient does not need an existing channel."
          : "Fiber could not build a path to the recipient from your local channels and gossip graph.",
        recommendation: jit
          ? "Connect to the liquidity node or a hub you share with it, then try again."
          : "Add funds with a public hub, then try again.",
        action: { label: "Add funds", href: "/channels?action=open" },
      }
    default: {
      const exhaustive: never = code
      return exhaustive
    }
  }
}
