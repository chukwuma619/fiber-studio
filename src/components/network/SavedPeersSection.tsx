import type { SavedPeerEntry } from "../../lib/fnn/types"
import { truncateMultiaddr } from "../../lib/fnn/network"
import { truncatePubkey } from "../../lib/public-relays"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { CopyButton } from "../ui/copy-button"
import { Subheading } from "../ui/heading"
import { Text } from "../ui/text"

type SavedPeersSectionProps = {
  peers: SavedPeerEntry[]
  isActing: boolean
  removingPubkey: string | null
  onAddPeer: () => void
  onRemovePeer: (pubkey: string) => void
}

export function SavedPeersSection({
  peers,
  isActing,
  removingPubkey,
  onAddPeer,
  onRemovePeer,
}: SavedPeersSectionProps) {
  return (
    <section className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
      <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <Subheading level={2}>Saved peers</Subheading>
        <Text className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Peers stored in your node config. All saved peers reconnect
          automatically when your node starts. You need at least one saved peer.
        </Text>
      </div>

      {peers.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <Text className="text-sm text-zinc-600 dark:text-zinc-400">
            No saved peers yet. Add one from setup or the button above.
          </Text>
          <Button className="mt-4" onClick={onAddPeer}>
            Add saved peer
          </Button>
        </div>
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
                  <Badge color={peer.connected ? "green" : "zinc"}>
                    {peer.connected ? "Connected" : "Not connected"}
                  </Badge>
                  {peer.hasActiveOrPendingChannel ? (
                    <Badge color="blue">Channel open</Badge>
                  ) : null}
                </div>

                {peer.multiaddr ? (
                  <div className="flex min-w-0 items-center gap-1.5 text-xs">
                    <span className="shrink-0 text-zinc-500 dark:text-zinc-400">
                      Address
                    </span>
                    <span
                      className="truncate font-mono text-zinc-600 dark:text-zinc-300"
                      title={peer.multiaddr}
                    >
                      {truncateMultiaddr(peer.multiaddr)}
                    </span>
                    <CopyButton
                      value={peer.multiaddr}
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
                <Button
                  outline
                  className="text-xs text-red-600 dark:text-red-400"
                  disabled={
                    peers.length <= 1 ||
                    (isActing && removingPubkey === peer.pubkey)
                  }
                  title={
                    peers.length <= 1
                      ? "At least one saved peer is required"
                      : undefined
                  }
                  onClick={() => onRemovePeer(peer.pubkey)}
                >
                  {isActing && removingPubkey === peer.pubkey
                    ? "Removing…"
                    : "Remove"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
