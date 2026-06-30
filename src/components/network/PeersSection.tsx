import { useMemo } from "react"
import { pubkeysEqual, normalizePubkey } from "../../lib/fnn/relay"
import type { NetworkConnectedPeer, SavedPeerEntry } from "../../lib/fnn/types"
import { truncateMultiaddr } from "../../lib/fnn/network"
import { truncatePubkey } from "../../lib/public-relays"
import { HomeEmptyState } from "../home/HomeEmptyState"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { CopyButton } from "../ui/copy-button"
import { Subheading } from "../ui/heading"
import { Text } from "../ui/text"

type PeerRow = {
  pubkey: string
  address: string | null
  connected: boolean
  channelCount: number
  isSaved: boolean
  isBootnode: boolean
  isOfficialRelay: boolean
  isDiscoveryOnly: boolean
}

type PeersSectionProps = {
  savedPeers: SavedPeerEntry[]
  connectedPeers: NetworkConnectedPeer[]
  isActing: boolean
  disconnectingPubkey: string | null
  reconnectingPubkey: string | null
  removingPubkey: string | null
  onAddPeer: () => void
  onDisconnectPeer: (pubkey: string) => void
  onReconnectSavedPeer: (pubkey: string) => void
  onRemoveSavedPeer: (pubkey: string) => void
}

function buildPeerRows(
  savedPeers: SavedPeerEntry[],
  connectedPeers: NetworkConnectedPeer[],
): { saved: PeerRow[]; other: PeerRow[] } {
  const connectedByPubkey = new Map(
    connectedPeers.map((peer) => [normalizePubkey(peer.pubkey), peer]),
  )

  const saved = savedPeers.map((peer) => {
    const connectedPeer = connectedByPubkey.get(normalizePubkey(peer.pubkey))

    return {
      pubkey: peer.pubkey,
      address: connectedPeer?.address ?? peer.multiaddr,
      connected: peer.connected,
      channelCount: peer.channelCount,
      isSaved: true,
      isBootnode: false,
      isOfficialRelay: false,
      isDiscoveryOnly: false,
    }
  })

  const other = connectedPeers
    .filter(
      (peer) =>
        !savedPeers.some((saved) => pubkeysEqual(saved.pubkey, peer.pubkey)),
    )
    .map((peer) => ({
      pubkey: peer.pubkey,
      address: peer.address,
      connected: true,
      channelCount: peer.channelCount,
      isSaved: false,
      isBootnode: peer.isBootnode,
      isOfficialRelay: peer.isOfficialRelay,
      isDiscoveryOnly: peer.isBootnode,
    }))

  return { saved, other }
}

function roleBadges(peer: PeerRow) {
  const badges = []

  if (peer.isSaved) {
    badges.push(
      <Badge key="saved" color="blue">
        Saved
      </Badge>,
    )
  } else if (peer.isBootnode) {
    badges.push(
      <Badge key="bootnode" color="amber">
        Bootnode
      </Badge>,
    )
  } else if (peer.isOfficialRelay) {
    badges.push(
      <Badge key="relay" color="zinc">
        Official relay
      </Badge>,
    )
  } else {
    badges.push(
      <Badge key="other" color="zinc">
        Connected
      </Badge>,
    )
  }

  if (peer.isSaved || peer.connected) {
    badges.push(
      <Badge key="status" color={peer.connected ? "green" : "zinc"}>
        {peer.connected ? "Connected" : "Not connected"}
      </Badge>,
    )
  }

  if (peer.channelCount > 0) {
    badges.push(
      <Badge key="channels" color="blue">
        {peer.channelCount === 1
          ? "1 channel"
          : `${peer.channelCount} channels`}
      </Badge>,
    )
  }

  return badges
}

function peerAction(
  peer: PeerRow,
  savedPeerCount: number,
  isActing: boolean,
  disconnectingPubkey: string | null,
  reconnectingPubkey: string | null,
  removingPubkey: string | null,
  onDisconnectPeer: (pubkey: string) => void,
  onReconnectSavedPeer: (pubkey: string) => void,
  onRemoveSavedPeer: (pubkey: string) => void,
) {
  if (peer.isDiscoveryOnly) {
    return (
      <span
        className="max-w-40 text-right text-xs text-zinc-500 dark:text-zinc-400"
        title="Bootnodes are auto-connected by fnn for peer discovery. They cannot be used for channel opens."
      >
        Discovery only
      </span>
    )
  }

  if (peer.isSaved) {
    const isReconnecting = isActing && reconnectingPubkey === peer.pubkey
    const isRemoving = isActing && removingPubkey === peer.pubkey

    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {!peer.connected ? (
          <Button
            outline
            className="text-xs"
            disabled={isActing}
            onClick={() => onReconnectSavedPeer(peer.pubkey)}
          >
            {isReconnecting ? "Reconnecting…" : "Reconnect"}
          </Button>
        ) : null}
        <Button
          outline
          className="text-xs text-red-600 dark:text-red-400"
          disabled={
            savedPeerCount <= 1 || isActing
          }
          title={
            savedPeerCount <= 1
              ? "At least one saved peer is required"
              : undefined
          }
          onClick={() => onRemoveSavedPeer(peer.pubkey)}
        >
          {isRemoving ? "Removing…" : "Remove"}
        </Button>
      </div>
    )
  }

  return (
    <Button
      outline
      className="text-xs text-red-600 dark:text-red-400"
      disabled={isActing && disconnectingPubkey === peer.pubkey}
      onClick={() => onDisconnectPeer(peer.pubkey)}
    >
      {isActing && disconnectingPubkey === peer.pubkey
        ? "Disconnecting…"
        : "Disconnect"}
    </Button>
  )
}

function PeerListItem({
  peer,
  savedPeerCount,
  isActing,
  disconnectingPubkey,
  reconnectingPubkey,
  removingPubkey,
  onDisconnectPeer,
  onReconnectSavedPeer,
  onRemoveSavedPeer,
}: {
  peer: PeerRow
  savedPeerCount: number
  isActing: boolean
  disconnectingPubkey: string | null
  reconnectingPubkey: string | null
  removingPubkey: string | null
  onDisconnectPeer: (pubkey: string) => void
  onReconnectSavedPeer: (pubkey: string) => void
  onRemoveSavedPeer: (pubkey: string) => void
}) {
  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="font-mono text-sm text-zinc-950 dark:text-white"
            title={peer.pubkey}
          >
            {truncatePubkey(peer.pubkey)}
          </span>
          <CopyButton
            value={peer.pubkey}
            label="Copy peer pubkey"
            className="shrink-0"
          />
          {roleBadges(peer)}
        </div>

        {peer.address ? (
          <div className="flex min-w-0 items-center gap-1.5 text-xs">
            <span className="shrink-0 text-zinc-500 dark:text-zinc-400">
              Address
            </span>
            <span
              className="truncate font-mono text-zinc-600 dark:text-zinc-300"
              title={peer.address}
            >
              {truncateMultiaddr(peer.address)}
            </span>
            <CopyButton
              value={peer.address}
              label="Copy connect address"
              className="shrink-0"
            />
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-4 sm:pl-4">
        <div className="text-right">
          <p className="text-sm tabular-nums text-zinc-950 dark:text-white">
            {peer.channelCount}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            channel{peer.channelCount === 1 ? "" : "s"}
          </p>
        </div>
        {peerAction(
          peer,
          savedPeerCount,
          isActing,
          disconnectingPubkey,
          reconnectingPubkey,
          removingPubkey,
          onDisconnectPeer,
          onReconnectSavedPeer,
          onRemoveSavedPeer,
        )}
      </div>
    </li>
  )
}

export function PeersSection({
  savedPeers,
  connectedPeers,
  isActing,
  disconnectingPubkey,
  reconnectingPubkey,
  removingPubkey,
  onAddPeer,
  onDisconnectPeer,
  onReconnectSavedPeer,
  onRemoveSavedPeer,
}: PeersSectionProps) {
  const { saved, other } = useMemo(
    () => buildPeerRows(savedPeers, connectedPeers),
    [savedPeers, connectedPeers],
  )

  const isEmpty = saved.length === 0 && other.length === 0

  return (
    <section className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
      <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <Subheading level={2}>Peers</Subheading>
        <Text className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Saved peers reconnect automatically when your node starts. Use Reconnect
          if a saved peer drops offline. Bootnodes and other active connections
          are listed below for visibility.
        </Text>
      </div>

      {isEmpty ? (
        <HomeEmptyState
          title="No peers yet"
          description="Add at least one saved peer during setup or from the button above. You need a saved peer to open channels."
          actionLabel="Add saved peer"
          onAction={onAddPeer}
        />
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {saved.map((peer) => (
            <PeerListItem
              key={peer.pubkey}
              peer={peer}
              savedPeerCount={saved.length}
              isActing={isActing}
              disconnectingPubkey={disconnectingPubkey}
              reconnectingPubkey={reconnectingPubkey}
              removingPubkey={removingPubkey}
              onDisconnectPeer={onDisconnectPeer}
              onReconnectSavedPeer={onReconnectSavedPeer}
              onRemoveSavedPeer={onRemoveSavedPeer}
            />
          ))}

          {saved.length > 0 && other.length > 0 ? (
            <li className="border-t border-zinc-200 bg-zinc-50 px-5 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/40">
              <Text className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                Discovery & other connections
              </Text>
            </li>
          ) : null}

          {other.map((peer) => (
            <PeerListItem
              key={peer.pubkey}
              peer={peer}
              savedPeerCount={saved.length}
              isActing={isActing}
              disconnectingPubkey={disconnectingPubkey}
              reconnectingPubkey={reconnectingPubkey}
              removingPubkey={removingPubkey}
              onDisconnectPeer={onDisconnectPeer}
              onReconnectSavedPeer={onReconnectSavedPeer}
              onRemoveSavedPeer={onRemoveSavedPeer}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
