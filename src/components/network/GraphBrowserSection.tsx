import { useState } from "react"
import { truncateMultiaddr } from "../../lib/fnn/network"
import { useNetworkGraph } from "../../lib/fnn/useNetworkGraph"
import type { NetworkGraphKind } from "../../lib/fnn/types"
import { truncatePubkey } from "../../lib/public-relays"
import { HomeEmptyState } from "../home/HomeEmptyState"
import { Button } from "../ui/button"
import { CopyButton } from "../ui/copy-button"
import { Subheading } from "../ui/heading"
import { Text } from "../ui/text"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table"

type GraphBrowserSectionProps = {
  running: boolean
  graphReady: boolean
}

const TABS: { id: NetworkGraphKind; label: string }[] = [
  { id: "nodes", label: "Nodes" },
  { id: "channels", label: "Channels" },
]

export function GraphBrowserSection({ running, graphReady }: GraphBrowserSectionProps) {
  const [kind, setKind] = useState<NetworkGraphKind>("nodes")
  const graph = useNetworkGraph(running, kind)

  return (
    <section className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
      <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <Subheading level={2}>Gossip graph browser</Subheading>
        <Text className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Paginated view of nodes and public channels your node has synced from
          gossip. This is not a live map of the entire network.
        </Text>
        <div className="mt-4 flex flex-wrap gap-2">
          {TABS.map((tab) =>
            kind === tab.id ? (
              <Button
                key={tab.id}
                onClick={() => setKind(tab.id)}
                className="text-xs"
              >
                {tab.label}
              </Button>
            ) : (
              <Button
                key={tab.id}
                outline
                onClick={() => setKind(tab.id)}
                className="text-xs"
              >
                {tab.label}
              </Button>
            ),
          )}
          <Button
            plain
            className="ml-auto text-xs"
            onClick={() => graph.refresh()}
            disabled={!running || graph.isLoading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {graph.error ? (
        <div className="border-b border-zinc-200 px-5 py-3 text-sm text-red-700 dark:border-zinc-800 dark:text-red-300">
          Failed to load graph: {graph.error}
        </div>
      ) : null}

      {!graphReady && !graph.isLoading ? (
        <div className="px-5 py-4">
          <Text className="text-xs text-amber-700 dark:text-amber-400">
            Gossip data appears after a saved peer connects. The lists
            below load in pages and may be empty at first.
          </Text>
        </div>
      ) : null}

      {kind === "nodes" ? (
        graph.nodes.length === 0 && !graph.isLoading ? (
          <HomeEmptyState
            title="No gossip nodes loaded"
            description="Your node has not synced gossip data yet. Wait a few minutes after connecting to a saved peer."
          />
        ) : (
          <Table dense>
            <TableHead>
              <TableRow>
                <TableHeader>Name</TableHeader>
                <TableHeader>Pubkey</TableHeader>
                <TableHeader>Announced address</TableHeader>
                <TableHeader className="text-right">Addresses</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {graph.nodes.map((node) => (
                <TableRow key={node.pubkey}>
                  <TableCell className="text-zinc-950 dark:text-white">
                    {node.nodeName ?? "—"}
                  </TableCell>
                  <TableCell
                    className="max-w-40 font-mono text-xs text-zinc-600 break-all dark:text-zinc-400"
                    title={node.pubkey}
                  >
                    {truncatePubkey(node.pubkey)}
                  </TableCell>
                  <TableCell className="max-w-0">
                    <div className="flex min-w-0 items-center gap-1">
                      <span
                        className="truncate font-mono text-xs text-zinc-600 dark:text-zinc-400"
                        title={node.primaryAddress ?? undefined}
                      >
                        {node.primaryAddress
                          ? truncateMultiaddr(node.primaryAddress)
                          : "—"}
                      </span>
                      {node.primaryAddress ? (
                        <CopyButton
                          value={node.primaryAddress}
                          label="Copy announced address"
                          className="shrink-0"
                        />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {node.addressCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )
      ) : graph.channels.length === 0 && !graph.isLoading ? (
        <HomeEmptyState
          title="No gossip channels loaded"
          description="Public channels from gossip will show here once your node has synced them."
        />
      ) : (
        <Table dense>
          <TableHead>
            <TableRow>
              <TableHeader>Node 1</TableHeader>
              <TableHeader>Node 2</TableHeader>
              <TableHeader className="text-right">Capacity</TableHeader>
              <TableHeader>Outpoint</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {graph.channels.map((channel) => (
              <TableRow key={channel.channelOutpoint}>
                <TableCell
                  className="font-mono text-xs text-zinc-600 dark:text-zinc-400"
                  title={channel.node1}
                >
                  {truncatePubkey(channel.node1)}
                </TableCell>
                <TableCell
                  className="font-mono text-xs text-zinc-600 dark:text-zinc-400"
                  title={channel.node2}
                >
                  {truncatePubkey(channel.node2)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {channel.capacityCkb} CKB
                </TableCell>
                <TableCell
                  className="max-w-48 font-mono text-xs text-zinc-600 break-all dark:text-zinc-400"
                  title={channel.channelOutpoint}
                >
                  {truncatePubkey(channel.channelOutpoint)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {graph.isLoading ? (
        <div className="border-t border-zinc-200 px-5 py-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Loading graph…
        </div>
      ) : null}

      {graph.hasMore ? (
        <div className="border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <Button
            outline
            className="w-full text-xs sm:w-auto"
            onClick={() => graph.loadMore()}
            disabled={graph.isLoadingMore}
          >
            {graph.isLoadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
