import type { NetworkConnectedPeer } from "../../lib/fnn/types"
import { truncateMultiaddr } from "../../lib/fnn/network"
import { truncatePubkey } from "../../lib/public-relays"
import { HomeEmptyState } from "../home/HomeEmptyState"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { CopyButton } from "../ui/copy-button"
import { Subheading } from "../ui/heading"
import { Text } from "../ui/text"

type ConnectedPeersSectionProps = {
  peers: NetworkConnectedPeer[]
  isActing: boolean
  disconnectingPubkey: string | null
  removingPubkey: string | null
  onConnectPeer: () => void
  onDisconnectPeer: (pubkey: string) => void
  onRemoveSavedPeer: (pubkey: string) => void
}

function peerRoleBadge(peer: NetworkConnectedPeer) {
  if (peer.isSaved) {
    return <Badge color="blue">Saved</Badge>
  }
  if (peer.isBootnode) {
    return <Badge color="amber">Bootnode</Badge>
  }
  if (peer.isOfficialRelay) {
    return <Badge color="zinc">Official relay</Badge>
  }
  return <Badge color="zinc">Additional</Badge>
}

function peerActions(
  peer: NetworkConnectedPeer,
  isActing: boolean,
  disconnectingPubkey: string | null,
  removingPubkey: string | null,
  onDisconnectPeer: (pubkey: string) => void,
  onRemoveSavedPeer: (pubkey: string) => void,
) {
  if (peer.isBootnode) {
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
    return (
      <Button
        outline
        className="text-xs text-red-600 dark:text-red-400"
        disabled={isActing && removingPubkey === peer.pubkey}
        onClick={() => onRemoveSavedPeer(peer.pubkey)}
      >
        {isActing && removingPubkey === peer.pubkey ? "Removing…" : "Remove"}
      </Button>
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

export function ConnectedPeersSection({
  peers,
  isActing,
  disconnectingPubkey,
  removingPubkey,
  onConnectPeer,
  onDisconnectPeer,
  onRemoveSavedPeer,
}: ConnectedPeersSectionProps) {
  return (
    <section className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
      <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <Subheading level={2}>Connected peers</Subheading>
        <Text className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Active peer connections. Saved peers reconnect on node start and can be
          used for channel opens. Bootnodes are listed for visibility — they are
          auto-connected for discovery and are not channel partners.
        </Text>
      </div>

      {peers.length === 0 ? (
        <HomeEmptyState
          title="No peers connected yet"
          description="Add a saved peer during setup or from the header. Saved peers connect automatically when your node starts."
          actionLabel="Add saved peer"
          onAction={onConnectPeer}
        />
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {peers.map((peer) => (
            <li
              key={peer.pubkey}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
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
                  {peerRoleBadge(peer)}
                  <Badge color="green">Connected</Badge>
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
                {peerActions(
                  peer,
                  isActing,
                  disconnectingPubkey,
                  removingPubkey,
                  onDisconnectPeer,
                  onRemoveSavedPeer,
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
