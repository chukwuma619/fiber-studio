import { Subheading } from "../ui/heading"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { CapacityBar } from "../ui/capacity-bar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table"
import { channelStatusLabel, formatCkb, parseHexU128 } from "../../lib/fnn/format"
import { formatPeerLabel } from "../../lib/fnn/relay"
import type { HomeChannel } from "../../lib/fnn/types"
import { HomeEmptyState } from "./HomeEmptyState"

type ChannelLiquiditySectionProps = {
  channels: HomeChannel[]
  available: boolean
  network: string | undefined
}

function channelBadgeColor(state: string, localPercent: number) {
  const label = channelStatusLabel(state, localPercent)
  if (label === "Low") return "amber" as const
  if (label === "Active") return "green" as const
  return "zinc" as const
}

export function ChannelLiquiditySection({
  channels,
  available,
  network,
}: ChannelLiquiditySectionProps) {
  return (
    <section className="rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <Subheading level={3}>Channel liquidity</Subheading>
        <Button href="/channels" plain className="text-xs">
          View all
        </Button>
      </div>

      {!available ? (
        <HomeEmptyState
          title="Node not running"
          description="Start your node to see channel liquidity."
        />
      ) : channels.length === 0 ? (
        <HomeEmptyState
          title="No channels yet"
          description="Open a channel from the Channels page to get started."
        />
      ) : (
        <Table dense>
          <TableHead>
            <TableRow>
              <TableHeader>Peer</TableHeader>
              <TableHeader>Capacity</TableHeader>
              <TableHeader>Local balance</TableHeader>
              <TableHeader>Status</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {channels.map((channel) => {
              const statusLabel = channelStatusLabel(
                channel.state,
                channel.localPercent,
              )
              const badgeColor = channelBadgeColor(
                channel.state,
                channel.localPercent,
              )

              return (
                <TableRow key={channel.channelId} href="/channels">
                  <TableCell className="font-mono text-zinc-600 dark:text-zinc-400">
                    {formatPeerLabel(channel.pubkey, network)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatCkb(
                      parseHexU128(channel.localBalance) +
                        parseHexU128(channel.remoteBalance),
                    )}{" "}
                    CKB
                  </TableCell>
                  <TableCell>
                    <CapacityBar percent={channel.localPercent} />
                  </TableCell>
                  <TableCell>
                    <Badge color={badgeColor}>{statusLabel}</Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
