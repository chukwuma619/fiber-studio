import { RefreshCw } from "lucide-react"
import { useCallback, useState } from "react"
import { HomeEmptyState } from "../home/HomeEmptyState"
import { StatCard } from "../home/StatCard"
import { useNodeControlContext } from "../layout/NodeControlProvider"
import { StatusDot } from "../layout/StatusDot"
import {
  configuredPeerStatLabel,
  graphStatusBadgeColor,
  graphStatusDotTone,
  graphStatusLabel,
  relayStatusBadgeColor,
  relayStatusDotTone,
} from "../../lib/fnn/network"
import { useNetworkActions } from "../../lib/fnn/useNetworkActions"
import { useNetworkPage } from "../../lib/fnn/useNetworkPage"
import type { SetConfiguredPeerPayload } from "../../lib/fnn/types"
import { truncatePubkey, type FiberNetwork } from "../../lib/public-relays"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { CopyButton } from "../ui/copy-button"
import { Heading } from "../ui/heading"
import { Text } from "../ui/text"
import { ChangeConfiguredPeerDialog } from "./ChangeConfiguredPeerDialog"
import { ConnectPeerDialog } from "./ConnectPeerDialog"
import { ConnectedPeersSection } from "./ConnectedPeersSection"
import { GraphBrowserSection } from "./GraphBrowserSection"

function networkDisplayLabel(network: string | null): string {
  if (network === "mainnet") return "Mainnet"
  if (network === "testnet") return "Testnet"
  return network ?? "—"
}

export function NetworkPage() {
  const { running, config } = useNodeControlContext()
  const { data, isLoading, isRefreshing, error, refresh } = useNetworkPage(running)
  const networkActions = useNetworkActions(refresh)

  const [connectDialogOpen, setConnectDialogOpen] = useState(false)
  const [changePeerDialogOpen, setChangePeerDialogOpen] = useState(false)
  const [disconnectingPubkey, setDisconnectingPubkey] = useState<string | null>(null)

  const available = data?.available ?? false
  const network = (data?.network ?? config?.network ?? "testnet") as FiberNetwork
  const connectedPeers = data?.connectedPeers ?? []
  const connectedPeerCount = data?.connectedPeerCount ?? 0
  const relayStatus = data?.relayStatus ?? "not_configured"
  const graphReady = data?.graphReady ?? false

  const nodePubkeyDisplay =
    available && data?.nodePubkey
      ? truncatePubkey(data.nodePubkey)
      : running && isLoading
        ? "…"
        : "—"

  const configuredPeerDisplay = available
    ? configuredPeerStatLabel(relayStatus, data?.configuredPeerPubkey)
    : "Start node to view"

  const openConnectDialog = useCallback(() => {
    networkActions.clearActionError()
    setConnectDialogOpen(true)
  }, [networkActions])

  const openChangePeerDialog = useCallback(() => {
    networkActions.clearActionError()
    setChangePeerDialogOpen(true)
  }, [networkActions])

  const handleDisconnectPeer = useCallback(
    async (pubkey: string) => {
      networkActions.clearActionError()
      setDisconnectingPubkey(pubkey)
      try {
        await networkActions.handleDisconnectPeer({ pubkey })
      } finally {
        setDisconnectingPubkey(null)
      }
    },
    [networkActions],
  )

  const relayBadgeColor = relayStatusBadgeColor(relayStatus)
  const relayDotTone = relayStatusDotTone(relayStatus)
  const graphBadgeColor = graphStatusBadgeColor(graphReady, relayStatus)
  const graphDotTone = graphStatusDotTone(graphReady, relayStatus)
  const graphLabel = graphStatusLabel(graphReady, relayStatus)

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading level={1}>Network</Heading>
          <Text className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Peers, relays, and gossip graph for your node.
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
          <Button outline onClick={openChangePeerDialog} disabled={!running}>
            Change primary peer
          </Button>
          <Button onClick={openConnectDialog} disabled={!running}>
            Connect another peer
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          Failed to load network: {error}
        </div>
      ) : null}

      {(networkActions.actionError && !connectDialogOpen && !changePeerDialogOpen) ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {networkActions.actionError}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Connected peers"
          value={
            isLoading && running ? "…" : available ? String(connectedPeerCount) : "—"
          }
          subtext={
            available
              ? `${networkDisplayLabel(data?.network ?? null)} network`
              : "Start node to view"
          }
        />
        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Your node pubkey
          </p>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-2xl font-semibold tabular-nums text-zinc-950 dark:text-white">
              {nodePubkeyDisplay}
            </p>
            {available && data?.nodePubkey ? (
              <CopyButton value={data.nodePubkey} label="Copy node pubkey" />
            ) : null}
          </div>
        </div>
        <StatCard
          label="Primary peer"
          value={isLoading && running ? "…" : configuredPeerDisplay}
          subtext={
            available ? "Used for channel opens" : "Start node to view"
          }
        />
      </div>

      {available ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
          <Badge color={relayBadgeColor}>
            <StatusDot tone={relayDotTone} />
            {data?.configuredPeerPubkey
              ? `Primary · ${truncatePubkey(data.configuredPeerPubkey)}`
              : "Primary · not set"}
          </Badge>
          <Badge color={graphBadgeColor}>
            <StatusDot tone={graphDotTone} />
            {graphLabel}
          </Badge>
          <Text className="text-xs text-zinc-500 dark:text-zinc-400">
            {data?.graphNodeCount.toLocaleString() ?? "0"} gossip nodes synced
            locally
          </Text>
          {!graphReady && relayStatus === "connected" ? (
            <Text className="text-xs text-amber-700 dark:text-amber-400">
              Gossip sync can take a few minutes after connecting.
            </Text>
          ) : null}
        </div>
      ) : null}

      {!available ? (
        <section className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
          <HomeEmptyState
            title="Node not running"
            description="Start your node to view connected peers and network graph data."
          />
        </section>
      ) : (
        <>
          <ConnectedPeersSection
            peers={connectedPeers}
            isActing={networkActions.isActing}
            disconnectingPubkey={disconnectingPubkey}
            onConnectPeer={openConnectDialog}
            onDisconnectPeer={(pubkey) => void handleDisconnectPeer(pubkey)}
          />



          <GraphBrowserSection running={running} graphReady={graphReady} />
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

      <ChangeConfiguredPeerDialog
        open={changePeerDialogOpen}
        onClose={() => setChangePeerDialogOpen(false)}
        network={network}
        data={data}
        isActing={networkActions.isActing}
        actionError={networkActions.actionError}
        onSave={async (payload: SetConfiguredPeerPayload) => {
          await networkActions.handleSetConfiguredPeer(payload)
        }}
        onClearError={networkActions.clearActionError}
      />
    </div>
  )
}
