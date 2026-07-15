import { RefreshCw } from "lucide-react"
import { useCallback, useState } from "react"
import { HomeEmptyState } from "../home/HomeEmptyState"
import { useNodeControlContext } from "../layout/NodeControlProvider"
import { StatusDot } from "../layout/StatusDot"
import {
  graphStatusBadgeColor,
  graphStatusDotTone,
  graphStatusLabel,
  relayStatusBadgeColor,
  relayStatusDotTone,
  savedPeersStatusLabel,
} from "../../lib/fnn/network"
import { useNetworkActions } from "../../lib/fnn/useNetworkActions"
import { useNetworkPage } from "../../lib/fnn/useNetworkPage"
import { nodeDataEmptyState } from "../../lib/fnn/nodeEmptyState"
import { type FiberNetwork } from "../../lib/public-relays"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Heading } from "../ui/heading"
import { Text } from "../ui/text"
import { ConnectPeerDialog } from "./ConnectPeerDialog"
import { GraphBrowserSection } from "./GraphBrowserSection"
import { PeersSection } from "./PeersSection"
import { PageErrorBanner } from "../ui/page-error-banner"

export function NetworkPage() {
  const { running, status, config } = useNodeControlContext()
  const { data, isRefreshing, error, refresh } = useNetworkPage(running)
  const networkActions = useNetworkActions(refresh)

  const [connectDialogOpen, setConnectDialogOpen] = useState(false)
  const [disconnectingPubkey, setDisconnectingPubkey] = useState<string | null>(null)
  const [connectingPubkey, setConnectingPubkey] = useState<string | null>(null)
  const [removingPubkey, setRemovingPubkey] = useState<string | null>(null)

  const available = data?.available ?? false
  const network = (data?.network ?? config?.network ?? "testnet") as FiberNetwork
  const connectedPeers = data?.connectedPeers ?? []
  const savedPeers = data?.savedPeers ?? []
  const relayStatus = data?.relayStatus ?? "not_configured"
  const graphReady = data?.graphReady ?? false
  const savedPeerConnectedCount = data?.savedPeerConnectedCount ?? 0
  const savedPeerTotal = data?.savedPeers.length ?? 0
  const unavailableState = nodeDataEmptyState(
    status,
    available,
    "Start your node to view connected peers and network graph data.",
  )

  const openConnectDialog = useCallback(() => {
    networkActions.clearActionError()
    setConnectDialogOpen(true)
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

  const handleRemoveSavedPeer = useCallback(
    async (pubkey: string) => {
      networkActions.clearActionError()
      setRemovingPubkey(pubkey)
      try {
        await networkActions.handleRemoveSavedPeer({ pubkey })
      } finally {
        setRemovingPubkey(null)
      }
    },
    [networkActions],
  )

  const handleConnectSavedPeer = useCallback(
    async (pubkey: string) => {
      networkActions.clearActionError()
      setConnectingPubkey(pubkey)
      try {
        await networkActions.handleConnectSavedPeer({ pubkey })
      } finally {
        setConnectingPubkey(null)
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
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading level={1}>Network</Heading>
          <Text className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Peers, relays, and gossip graph for your node.
          </Text>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={openConnectDialog} disabled={!running}>
            Add saved peer
          </Button>
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
        </div>
      </div>

      {error ? (
        <PageErrorBanner
          message={`Failed to load network: ${error}`}
          onRetry={() => void refresh()}
        />
      ) : null}

      {networkActions.actionError && !connectDialogOpen ? (
        <PageErrorBanner
          message={networkActions.actionError}
          onDismiss={networkActions.clearActionError}
        />
      ) : null}

      {available ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-4 py-3 shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10">
          <Badge color={relayBadgeColor}>
            <StatusDot tone={relayDotTone} />
            {savedPeersStatusLabel(savedPeerConnectedCount, savedPeerTotal)}
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

      {unavailableState ? (
        <section className="overflow-hidden rounded-lg bg-white shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10">
          <HomeEmptyState
            title={unavailableState.title}
            description={unavailableState.description}
          />
        </section>
      ) : (
        <>
          <PeersSection
            savedPeers={savedPeers}
            connectedPeers={connectedPeers}
            isActing={networkActions.isActing}
            disconnectingPubkey={disconnectingPubkey}
            connectingPubkey={connectingPubkey}
            removingPubkey={removingPubkey}
            onAddPeer={openConnectDialog}
            onDisconnectPeer={(pubkey) => void handleDisconnectPeer(pubkey)}
            onConnectSavedPeer={(pubkey) => void handleConnectSavedPeer(pubkey)}
            onRemoveSavedPeer={(pubkey) => void handleRemoveSavedPeer(pubkey)}
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
          await networkActions.handleAddSavedPeer(payload)
        }}
        onClearError={networkActions.clearActionError}
      />
    </div>
  )
}
