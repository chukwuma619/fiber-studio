import { getDataDirectoryDisplayForNetwork } from "../../lib/data-directory"
import { useNodeControlContext } from "../layout/NodeControlProvider"
import { formatCkb } from "../../lib/fnn/format"
import { useHomeDashboard } from "../../lib/fnn/useHomeDashboard"
import { Button } from "../ui/button"
import { Heading } from "../ui/heading"
import { PageErrorBanner } from "../ui/page-error-banner"
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
  const {
    dashboard,
    isLoading: isDashboardLoading,
    error,
    refresh,
  } = useHomeDashboard(running)

  const available = dashboard?.available ?? false
  const nodeInfo = dashboard?.nodeInfo
  const isDashboardInitialLoad = running && isDashboardLoading && dashboard === null
  const isLoading = isNodeLoading || isDashboardInitialLoad

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
    <div className="space-y-8">
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
        <PageErrorBanner
          message={`Failed to load dashboard: ${error}`}
          onRetry={() => void refresh()}
        />
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <ChannelLiquiditySection
          channels={dashboard?.channels ?? []}
          available={available}
          status={status}
          isLoading={isDashboardInitialLoad}
        />
        <div className="min-w-0">
          <NodeStatusPanel
            dashboard={dashboard}
            status={status}
            isLoading={isNodeLoading || isDashboardInitialLoad}
            dataDirectory={
              nodeStatus?.dataDirectory ??
              (config?.network
                ? getDataDirectoryDisplayForNetwork(config.network)
                : null)
            }
            config={config}
          />
        </div>
      </div>

      <RecentActivitySection
        payments={dashboard?.payments ?? []}
        incomingInvoices={dashboard?.incomingInvoices ?? []}
        available={available}
        status={status}
        isLoading={isDashboardInitialLoad}
      />
    </div>
  )
}
