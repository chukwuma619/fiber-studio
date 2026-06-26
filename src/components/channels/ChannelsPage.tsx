import { RefreshCw } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNodeControlContext } from "../layout/NodeControlProvider"
import {
  channelStateBadgeColor,
  channelStateDisplayLabel,
  formatCkb,
  isChannelPending,
  parseHexU128,
} from "../../lib/fnn/format"
import { useChannelActions } from "../../lib/fnn/useChannelActions"
import { useChannelsPage } from "../../lib/fnn/useChannelsPage"
import type { HomeChannel, OpenChannelResult } from "../../lib/fnn/types"
import { CHANNEL_OPEN_MIN_FUNDING_CKB, truncatePubkey } from "../../lib/public-relays"
import { HomeEmptyState } from "../home/HomeEmptyState"
import { StatCard } from "../home/StatCard"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { CapacityBar } from "../ui/capacity-bar"
import { Heading } from "../ui/heading"
import { Text } from "../ui/text"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table"
import { ChannelDetailDialog } from "./ChannelDetailDialog"
import { OpenChannelDialog } from "./OpenChannelDialog"

type ChannelsPageProps = {
  initialChannelId?: string
}

function channelCapacityCkb(channel: HomeChannel): string {
  const total =
    parseHexU128(channel.localBalance) + parseHexU128(channel.remoteBalance)
  return formatCkb(total)
}

function remotePercent(channel: HomeChannel): number {
  return Math.max(0, 100 - channel.localPercent)
}

function channelLiquidityCell(channel: HomeChannel) {
  if (channel.state !== "ChannelReady") {
    return (
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        Not available until ready
      </span>
    )
  }

  const remote = remotePercent(channel)
  return (
    <div className="flex items-center gap-3">
      <CapacityBar percent={channel.localPercent} showLabel={false} />
      <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
        {channel.localPercent}% local / {remote}% remote
      </span>
    </div>
  )
}

export function ChannelsPage({ initialChannelId }: ChannelsPageProps) {
  const { running } = useNodeControlContext()
  const { data, isLoading, isRefreshing, error, refresh } = useChannelsPage(running)
  const channelActions = useChannelActions(refresh)

  const [openDialogOpen, setOpenDialogOpen] = useState(false)
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [openSuccessMessage, setOpenSuccessMessage] = useState<string | null>(null)

  const available = data?.available ?? false
  const channels = data?.channels ?? []
  const minFundingCkb = data?.minFundingCkb ?? CHANNEL_OPEN_MIN_FUNDING_CKB

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.channelId === selectedChannelId) ?? null,
    [channels, selectedChannelId],
  )

  const openOpenDialog = useCallback(() => {
    channelActions.clearActionError()
    setOpenSuccessMessage(null)
    setOpenDialogOpen(true)
  }, [channelActions])

  const handleOpenSuccess = useCallback((result: OpenChannelResult) => {
    if (result.channelId) {
      setOpenSuccessMessage(
        `Channel open started. Channel ID: ${result.channelId}`,
      )
      return
    }
    setOpenSuccessMessage(
      "Channel open started. It will appear in the list once funding begins.",
    )
  }, [])

  const openDetailDialog = useCallback(
    (channelId: string) => {
      channelActions.clearActionError()
      setSelectedChannelId(channelId)
    },
    [channelActions],
  )

  useEffect(() => {
    if (!initialChannelId || !available) return
    const match = channels.find((channel) => channel.channelId === initialChannelId)
    if (match) {
      setSelectedChannelId(match.channelId)
    }
  }, [available, channels, initialChannelId])

  const activeCount = data?.activeChannelCount ?? 0
  const openingChannels = useMemo(
    () => channels.filter((channel) => isChannelPending(channel.state)),
    [channels],
  )
  const hasOpeningChannels = openingChannels.length > 0
  const activeChannels = available ? String(activeCount) : "—"
  const channelSummarySubtext = available
    ? hasOpeningChannels
      ? `${activeCount} active · ${openingChannels.length} opening`
      : `${activeCount} active`
    : "Start node to view channels"
  const totalCapacity = available
    ? formatCkb(BigInt(data?.totalCapacity ?? "0"))
    : "—"
  const localBalance = available
    ? formatCkb(BigInt(data?.totalLocalBalance ?? "0"))
    : "—"
  const onChainWallet = !available
    ? "—"
    : isLoading && running
      ? "…"
      : data?.onChainWalletError
        ? "—"
        : data?.onChainWalletCkb !== null && data?.onChainWalletCkb !== undefined
          ? String(data.onChainWalletCkb)
          : "—"
  const onChainWalletSubtext = (() => {
    if (!available) {
      return "Start node to view wallet"
    }
    if (data?.onChainWalletError) {
      return "Could not read on-chain balance"
    }
    return "Available to fund channel opens"
  })()

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading level={1}>Channels</Heading>
          <Text className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Open public channels for multi-hop routing.
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
          <Button
            onClick={openOpenDialog}
            disabled={!running || (data?.hasChannelToConfiguredPeer ?? false)}
          >
            Open channel
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          Failed to load channels: {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="On-chain wallet"
          value={isLoading && running ? "…" : onChainWallet}
          unit={
            available &&
            data?.onChainWalletCkb !== null &&
            data?.onChainWalletCkb !== undefined
              ? "CKB"
              : undefined
          }
          subtext={onChainWalletSubtext}
        />
        <StatCard
          label="Channels"
          value={isLoading && running ? "…" : activeChannels}
          subtext={channelSummarySubtext}
        />
        <StatCard
          label="Local balance"
          value={isLoading && running ? "…" : localBalance}
          unit={available ? "CKB" : undefined}
          subtext={
            available
              ? "Spendable in active channels"
              : "Start node to view balance"
          }
        />
        <StatCard
          label="Total capacity"
          value={isLoading && running ? "…" : totalCapacity}
          unit={available ? "CKB" : undefined}
          subtext={
            available ? "Across all channels" : "Start node to view capacity"
          }
        />
      </div>

      <section className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
        {!available ? (
          <HomeEmptyState
            title="Node not running"
            description="Start your node to view and manage payment channels."
          />
        ) : channels.length === 0 ? (
          <HomeEmptyState
            title="No channels yet"
            description={`Open a public channel with at least ${minFundingCkb.toLocaleString()} CKB to get started.`}
            actionLabel="Open channel"
            onAction={openOpenDialog}
          />
        ) : (
          <Table dense>
            <TableHead>
              <TableRow>
                <TableHeader className="w-10">S/N</TableHeader>
                <TableHeader>Peer</TableHeader>
                <TableHeader>Visibility</TableHeader>
                <TableHeader>State</TableHeader>
                <TableHeader className="text-right">Capacity</TableHeader>
                <TableHeader>Liquidity</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {channels.map((channel, index) => {
                const badgeColor = channelStateBadgeColor(
                  channel.state,
                  channel.localPercent,
                )
                const stateLabel = channelStateDisplayLabel(channel.state)

                return (
                  <TableRow
                    key={channel.channelId}
                    onClick={() => openDetailDialog(channel.channelId)}
                    className="cursor-pointer"
                  >
                    <TableCell className="tabular-nums text-zinc-500 dark:text-zinc-400">
                      {index + 1}
                    </TableCell>
                    <TableCell className="max-w-48 sm:max-w-xs">
                      <span
                        className="block font-mono text-xs text-zinc-600 break-all dark:text-zinc-400"
                        title={channel.pubkey}
                      >
                        {truncatePubkey(channel.pubkey)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge color={channel.isPublic ? "blue" : "zinc"}>
                        {channel.isPublic ? "Public" : "Private"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge color={badgeColor}>{stateLabel}</Badge>
                        {channel.failureDetail ? (
                          <p
                            className="max-w-xs text-xs text-rose-600 dark:text-rose-400"
                            title={channel.failureDetail}
                          >
                            {channel.failureDetail}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {channelCapacityCkb(channel)} CKB
                    </TableCell>
                    <TableCell>
                      {channelLiquidityCell(channel)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </section>

      <OpenChannelDialog
        open={openDialogOpen}
        onClose={() => setOpenDialogOpen(false)}
        configuredPeerPubkey={data?.configuredPeerPubkey ?? null}
        relayStatus={data?.relayStatus ?? "not_configured"}
        minFundingCkb={minFundingCkb}
        hasChannelToConfiguredPeer={data?.hasChannelToConfiguredPeer ?? false}
        availableWalletCkb={data?.onChainWalletCkb ?? null}
        onChainWalletError={data?.onChainWalletError ?? null}
        isActing={channelActions.isActing}
        actionError={channelActions.actionError}
        onOpenChannel={channelActions.handleOpenChannel}
        onClearError={channelActions.clearActionError}
        onSuccess={handleOpenSuccess}
      />

      <ChannelDetailDialog
        open={selectedChannel !== null}
        channel={selectedChannel}
        onClose={() => setSelectedChannelId(null)}
        isActing={channelActions.isActing}
        actionError={channelActions.actionError}
        onShutdownChannel={channelActions.handleShutdownChannel}
        onAbandonChannel={channelActions.handleAbandonChannel}
        onClearError={channelActions.clearActionError}
      />
    </div>
  )
}
