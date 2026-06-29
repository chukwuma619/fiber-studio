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
  onConnectPeer: () => void
  onDisconnectPeer: (pubkey: string) => void
}

function peerRoleBadge(peer: NetworkConnectedPeer) {
  if (peer.isConfigured) {
    return <Badge color="blue">Primary</Badge>
  }
  if (peer.isBootnode) {
    return <Badge color="amber">Bootnode</Badge>
  }
  if (peer.isOfficialRelay) {
    return <Badge color="zinc">Official relay</Badge>
  }
  return <Badge color="zinc">Additional</Badge>
}

function peerActions(peer: NetworkConnectedPeer) {
  if (peer.isConfigured) {
    return (
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        Primary peer
      </span>
    )
  }

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

  return null
}

export function ConnectedPeersSection({
  peers,
  isActing,
  disconnectingPubkey,
  onConnectPeer,
  onDisconnectPeer,
}: ConnectedPeersSectionProps) {
  return (
    <section className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
      <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <Subheading level={2}>Connected peers</Subheading>
        <Text className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Active peer connections. One primary peer is used for channel opens.
          Bootnodes are listed for visibility — they are auto-connected for
          discovery and are not channel partners.
        </Text>
      </div>

      {peers.length === 0 ? (
        <HomeEmptyState
          title="No peers connected yet"
          description="Set a primary peer during setup, or connect another peer from the header."
          actionLabel="Connect another peer"
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
                {peerActions(peer) ??
                  (!peer.isConfigured ? (
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
                  ) : null)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
