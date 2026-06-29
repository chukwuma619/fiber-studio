import { ChevronDown, RefreshCw } from "lucide-react"
import { useCallback, useState } from "react"
import { OpenChannelDialog } from "../channels/OpenChannelDialog"
import { HomeEmptyState } from "../home/HomeEmptyState"
import { StatCard } from "../home/StatCard"
import { useNodeControlContext } from "../layout/NodeControlProvider"
import { StatusDot } from "../layout/StatusDot"
import {
  configuredRelayLabel,
  connectionModeLabel,
  graphStatusBadgeColor,
  graphStatusDotTone,
  graphStatusLabel,
  relayStatusBadgeColor,
  relayStatusDotTone,
} from "../../lib/fnn/network"
import { useChannelActions } from "../../lib/fnn/useChannelActions"
import { useNetworkActions } from "../../lib/fnn/useNetworkActions"
import { useNetworkPage } from "../../lib/fnn/useNetworkPage"
import type { NetworkRelayEntry, SetConfiguredPeerPayload } from "../../lib/fnn/types"
import { truncatePubkey, type FiberNetwork } from "../../lib/public-relays"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Heading, Subheading } from "../ui/heading"
import { Text } from "../ui/text"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table"
import { ConnectPeerDialog } from "./ConnectPeerDialog"
import { RelayCard } from "./RelayCard"

function networkDisplayLabel(network: string | null): string {
  if (network === "mainnet") return "Mainnet"
  if (network === "testnet") return "Testnet"
  return network ?? "—"
}

export function NetworkPage() {
  const { running, config } = useNodeControlContext()
  const { data, isLoading, isRefreshing, error, refresh } = useNetworkPage(running)
  const networkActions = useNetworkActions(refresh)
  const channelActions = useChannelActions(refresh)

  const [connectDialogOpen, setConnectDialogOpen] = useState(false)
  const [openChannelDialogOpen, setOpenChannelDialogOpen] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [actingRelayId, setActingRelayId] = useState<string | null>(null)

  const available = data?.available ?? false
  const network = (data?.network ?? config?.network ?? "testnet") as FiberNetwork
  const relays = data?.relays ?? []
  const customPeers = data?.customPeers ?? []
  const relayStatus = data?.relayStatus ?? "not_configured"
  const graphReady = data?.graphReady ?? false

  const nodePubkeyDisplay =
    available && data?.nodePubkey
      ? truncatePubkey(data.nodePubkey)
      : running && isLoading
        ? "…"
        : "—"

  const connectionModeDisplay = available
    ? connectionModeLabel(data?.connectionMode ?? "custom-public-node")
    : "—"

  const publicNetworkDisplay = available
    ? configuredRelayLabel(relays, relayStatus)
    : "Start node to connect"

  const setConfiguredPeerForRelay = useCallback(
    async (relay: NetworkRelayEntry) => {
      const payload: SetConfiguredPeerPayload = {
        pubkey: relay.pubkey,
        multiaddr: relay.multiaddr ?? undefined,
      }
      setActingRelayId(relay.id)
      try {
        await networkActions.handleSetConfiguredPeer(payload)
      } finally {
        setActingRelayId(null)
      }
    },
    [networkActions],
  )

  const handleRelayConnect = useCallback(
    async (relay: NetworkRelayEntry) => {
      networkActions.clearActionError()
      await setConfiguredPeerForRelay(relay)
    },
    [networkActions, setConfiguredPeerForRelay],
  )

  const handleRelayOpenChannel = useCallback(
    async (relay: NetworkRelayEntry) => {
      networkActions.clearActionError()
      channelActions.clearActionError()

      if (!relay.isConfigured) {
        await setConfiguredPeerForRelay(relay)
      }

      setOpenChannelDialogOpen(true)
    },
    [channelActions, networkActions, setConfiguredPeerForRelay],
  )

  const openConnectDialog = useCallback(() => {
    networkActions.clearActionError()
    setConnectDialogOpen(true)
  }, [networkActions])

  const relayBadgeColor = relayStatusBadgeColor(relayStatus)
  const relayDotTone = relayStatusDotTone(relayStatus)
  const graphBadgeColor = graphStatusBadgeColor(graphReady, relayStatus)
  const graphDotTone = graphStatusDotTone(graphReady, relayStatus)
  const graphLabel = graphStatusLabel(graphReady, relayStatus)

  const configuredRelay = relays.find((relay) => relay.isConfigured)
  const outboundRelayLabel =
    configuredRelay && (configuredRelay.connected || relayStatus === "connected")
      ? `${configuredRelay.label} connected`
      : relayStatus === "connecting"
        ? "Connecting…"
        : "Not connected"

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading level={1}>Network</Heading>
          <Text className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Connect outbound to Fiber&apos;s public relay network — no public IP or
            VPS required.
          </Text>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            outline
            onClick={() => void refresh()}
            disabled={!running || isRefreshing}
          >
            <RefreshCw
              className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
              data-slot="icon"
            />
            Refresh
          </Button>
          <Button onClick={openConnectDialog} disabled={!running}>
            Connect peer
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          Failed to load network: {error}
        </div>
      ) : null}

      {(networkActions.actionError || channelActions.actionError) && !connectDialogOpen ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {networkActions.actionError ?? channelActions.actionError}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Connection mode"
          value={isLoading && running ? "…" : connectionModeDisplay}
          subtext={
            available
              ? "How your node joins the public network"
              : "Start node to view connectivity"
          }
        />
        <StatCard
          label="Your node pubkey"
          value={nodePubkeyDisplay}
          subtext={
            available
              ? "Your node's public identity"
              : "Start node to view pubkey"
          }
        />
        <StatCard
          label="Public network"
          value={isLoading && running ? "…" : publicNetworkDisplay}
          subtext={
            available
              ? networkDisplayLabel(data?.network ?? null)
              : "Start node to connect"
          }
        />
      </div>

      {!available ? (
        <section className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
          <HomeEmptyState
            title="Node not running"
            description="Start your node to view relay status and manage peer connections."
          />
        </section>
      ) : (
        <>
          <section className="space-y-4">
            <div>
              <Subheading level={2}>Public relay network</Subheading>
              <Text className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Official Fiber relay nodes for multi-hop routing (node1 ⟺ node2)
              </Text>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {relays.map((relay) => (
                <RelayCard
                  key={relay.id}
                  relay={relay}
                  networkLabel={networkDisplayLabel(data?.network ?? null)}
                  disabled={!running}
                  isActing={
                    networkActions.isActing && actingRelayId === relay.id
                  }
                  onConnect={() => void handleRelayConnect(relay)}
                  onOpenChannel={() => void handleRelayOpenChannel(relay)}
                />
              ))}
            </div>
          </section>

          <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
            <Subheading level={2}>Your connectivity</Subheading>
            <dl className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-4 text-sm">
                <dt className="text-zinc-600 dark:text-zinc-400">Outbound relay</dt>
                <dd>
                  <Badge color={relayBadgeColor}>
                    <StatusDot tone={relayDotTone} />
                    {outboundRelayLabel}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <dt className="text-zinc-600 dark:text-zinc-400">Network graph</dt>
                <dd>
                  <Badge color={graphBadgeColor}>
                    <StatusDot tone={graphDotTone} />
                    {graphLabel}
                  </Badge>
                </dd>
              </div>
              {available && data ? (
                <div className="flex items-center justify-between gap-4 text-sm">
                  <dt className="text-zinc-600 dark:text-zinc-400">Graph nodes</dt>
                  <dd className="tabular-nums text-zinc-950 dark:text-white">
                    {data.graphNodeCount.toLocaleString()}
                  </dd>
                </div>
              ) : null}
            </dl>
            {!graphReady && relayStatus === "connected" ? (
              <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
                Wait a few minutes after your channel is ready before multi-hop
                payments.
              </p>
            ) : null}
          </section>

          <section className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
            <button
              type="button"
              className="flex w-full items-center justify-between border-b border-zinc-200 px-5 py-4 text-left dark:border-zinc-800"
              onClick={() => setShowAdvanced((prev) => !prev)}
            >
              <div>
                <Subheading level={2}>Advanced: custom peers</Subheading>
                <Text className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Optional direct peer connections (pubkey + multiaddr)
                </Text>
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                {showAdvanced ? "Hide" : "Show"}
                <ChevronDown
                  className={`size-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                />
              </span>
            </button>

            {showAdvanced ? (
              customPeers.length === 0 ? (
                <HomeEmptyState
                  title="No custom peers"
                  description="Most users only need public relay connections."
                  actionLabel="Connect peer"
                  onAction={openConnectDialog}
                />
              ) : (
                <Table dense>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Label</TableHeader>
                      <TableHeader>Pubkey</TableHeader>
                      <TableHeader>Status</TableHeader>
                      <TableHeader className="text-right">Channels</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {customPeers.map((peer) => (
                      <TableRow key={peer.pubkey}>
                        <TableCell className="text-zinc-950 dark:text-white">
                          {peer.label ?? "Custom peer"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                          {truncatePubkey(peer.pubkey)}
                        </TableCell>
                        <TableCell>
                          <Badge color="green">
                            <StatusDot tone="running" />
                            Connected
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {peer.channelCount}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            ) : null}
          </section>
        </>
      )}

      <ConnectPeerDialog
        open={connectDialogOpen}
        onClose={() => setConnectDialogOpen(false)}
        network={network}
        isActing={networkActions.isActing}
        actionError={networkActions.actionError}
        onConnect={async (payload) => {
          await networkActions.handleConnectPeer(payload)
        }}
        onClearError={networkActions.clearActionError}
      />

      <OpenChannelDialog
        open={openChannelDialogOpen}
        onClose={() => setOpenChannelDialogOpen(false)}
        configuredPeerPubkey={data?.configuredPeerPubkey ?? null}
        relayStatus={relayStatus}
        minFundingCkb={data?.minFundingCkb ?? 1000}
        hasChannelToConfiguredPeer={data?.hasChannelToConfiguredPeer ?? false}
        availableWalletCkb={data?.onChainWalletCkb ?? null}
        onChainWalletError={data?.onChainWalletError ?? null}
        isActing={channelActions.isActing}
        actionError={channelActions.actionError}
        onOpenChannel={channelActions.handleOpenChannel}
        onClearError={channelActions.clearActionError}
      />
    </div>
  )
}
