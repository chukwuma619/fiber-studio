import { useNodeControlContext } from "../layout/NodeControlProvider"
import { formatCkb } from "../../lib/fnn/format"
import { useHomeDashboard } from "../../lib/fnn/useHomeDashboard"
import { Button } from "../ui/button"
import { Heading } from "../ui/heading"
import { Text } from "../ui/text"
import { ChannelLiquiditySection } from "./ChannelLiquiditySection"
import { NodeStatusPanel } from "./NodeStatusPanel"
import { RecentActivitySection } from "./RecentActivitySection"
import { StatCard } from "./StatCard"

function peerConnectionsSubtext(count: number): string {
  if (count === 1) {
    return "1 peer connection"
  }
  return `${count} peer connections`
}

export function HomePage() {
  const {
    config,
    nodeStatus,
    status,
    isLoading: isNodeLoading,
    running,
  } = useNodeControlContext()
  const { dashboard, isLoading: isDashboardLoading, error } = useHomeDashboard(running)

  const available = dashboard?.available ?? false
  const nodeInfo = dashboard?.nodeInfo
  const isLoading = isNodeLoading || (running && isDashboardLoading)

  const activeChannelCount = dashboard?.activeChannelCount ?? 0
  const pendingChannelCount = dashboard?.pendingChannelCount ?? 0
  const peersCountValue = nodeInfo?.peersCount ?? 0

  const localBalance = available
    ? formatCkb(BigInt(dashboard?.totalLocalBalance ?? "0"))
    : "—"
  const activeChannels = available ? String(activeChannelCount) : "—"
  const peersCount = available ? String(peersCountValue) : "—"
  const pendingChannels = available ? String(pendingChannelCount) : "—"

  const peersSubtext = available
    ? peerConnectionsSubtext(peersCountValue)
    : running
      ? "Loading…"
      : "Start node to connect"

  const channelSubtext = available
    ? `${activeChannelCount} active · ${pendingChannelCount} pending`
    : "Start node to view channels"

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading level={1}>Home</Heading>
          <Text className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Off-chain CKB payments on the Fiber network.
          </Text>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button href="/wallet?action=send">Send payment</Button>
          <Button href="/wallet?action=create-invoice" outline>
            Create invoice
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          Failed to load dashboard: {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Local balance"
          value={isLoading && running ? "…" : localBalance}
          unit={available ? "CKB" : undefined}
          subtext={available ? "Across active channels" : "Start node to view balance"}
        />
        <StatCard
          label="Active channels"
          value={isLoading && running ? "…" : activeChannels}
          subtext={channelSubtext}
        />
        <StatCard
          label="Connected peers"
          value={isLoading && running ? "…" : peersCount}
          subtext={peersSubtext}
        />
        <StatCard
          label="Pending channels"
          value={isLoading && running ? "…" : pendingChannels}
          subtext={
            available && pendingChannelCount > 0
              ? "Opening in progress"
              : "No channels opening"
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <ChannelLiquiditySection
          channels={dashboard?.channels ?? []}
          available={available}
        />
        <NodeStatusPanel
          dashboard={dashboard}
          status={status}
          isLoading={isNodeLoading}
          dataDirectory={nodeStatus?.dataDirectory ?? config?.dataDirectory ?? null}
          config={config}
        />
      </div>

      <RecentActivitySection
        payments={dashboard?.payments ?? []}
        available={available}
      />
    </div>
  )
}
