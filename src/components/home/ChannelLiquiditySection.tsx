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
import {
  channelStateBadgeColor,
  channelStateDisplayLabel,
  channelStatusLabel,
  formatCkb,
  parseHexU128,
} from "../../lib/fnn/format"
import type { HomeChannel } from "../../lib/fnn/types"
import { truncatePubkey } from "../../lib/public-relays"
import { HomeEmptyState } from "./HomeEmptyState"

type ChannelLiquiditySectionProps = {
  channels: HomeChannel[]
  available: boolean
}

function channelBadgeColor(state: string, localPercent: number) {
  return channelStateBadgeColor(state, localPercent)
}

export function ChannelLiquiditySection({
  channels,
  available,
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
              <TableHeader className="w-10">S/N</TableHeader>
              <TableHeader>Peer</TableHeader>
              <TableHeader>Capacity</TableHeader>
              <TableHeader>Local balance</TableHeader>
              <TableHeader>Status</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {channels.map((channel, index) => {
              const statusLabel =
                channel.state === "ChannelReady"
                  ? channelStatusLabel(channel.state, channel.localPercent)
                  : channelStateDisplayLabel(channel.state)
              const badgeColor = channelBadgeColor(
                channel.state,
                channel.localPercent,
              )

              return (
                <TableRow key={channel.channelId} href="/channels">
                  <TableCell className="tabular-nums text-zinc-500 dark:text-zinc-400">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-mono text-zinc-600 dark:text-zinc-400">
                    {truncatePubkey(channel.pubkey)}
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
