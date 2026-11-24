import { CKB_ASSET_ID } from "../../lib/fnn/assets"
import { formatCkb, parseHexU128 } from "../../lib/fnn/format"
import { useHomeDashboard } from "../../lib/fnn/useHomeDashboard"
import { LegacyChannelNudge } from "../channels/LegacyChannelNudge"
import { useNodeControlContext } from "../layout/NodeControlProvider"
import { Button } from "../ui/button"
import { Heading } from "../ui/heading"
import { PageErrorBanner } from "../ui/page-error-banner"
import { Text } from "../ui/text"
import { RecentActivitySection } from "./RecentActivitySection"
import { StatCard } from "./StatCard"

function onChainCkbDisplay(
  balances: { assetId: string; amountDisplay: string }[],
): string {
  const ckb = balances.find(
    (balance) => balance.assetId.toLowerCase() === CKB_ASSET_ID,
  )
  return ckb?.amountDisplay ?? "0"
}

function nodeLoadSubtext(
  available: boolean,
  running: boolean,
  ready: string,
  stopped: string,
): string {
  if (available) return ready
  if (running) return "Loading…"
  return stopped
}

export function HomePage() {
  const { status, isLoading: isNodeLoading, running } = useNodeControlContext()
  const {
    dashboard,
    isLoading: isDashboardLoading,
    error,
    refresh,
  } = useHomeDashboard(running)

  const available = dashboard?.available ?? false
  const isDashboardInitialLoad =
    running && isDashboardLoading && dashboard === null
  const isLoading = isNodeLoading || isDashboardInitialLoad
  const needsFunds = available && (dashboard?.activeChannelCount ?? 0) === 0
  const spendableDisplay = available
    ? `${formatCkb(parseHexU128(dashboard?.totalLocalBalance ?? "0"))} CKB`
    : "—"
  const onChainDisplay = available
    ? `${onChainCkbDisplay(dashboard?.onChainBalances ?? [])} CKB`
    : "—"

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading level={1}>Home</Heading>
          <Text className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Your Fiber balance, on-chain CKB, and recent payments.
          </Text>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button href="/payments?action=create-invoice">Receive</Button>
          <Button href="/payments?action=send" outline>
            Send
          </Button>
          <Button href="/channels?action=open" outline>
            Add funds
          </Button>
        </div>
      </div>

      {error ? (
        <PageErrorBanner
          message={`Failed to load dashboard: ${error}`}
          onRetry={() => void refresh()}
        />
      ) : null}

      <LegacyChannelNudge
        open={Boolean(dashboard?.showLegacyChannelNudge)}
        legacyChannelCount={dashboard?.legacyChannelCount ?? 0}
        onDismissed={() => void refresh()}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Spendable"
          value={isLoading && running ? "…" : spendableDisplay}
          subtext={nodeLoadSubtext(
            available,
            running,
            "CKB you can send over Fiber",
            "Start the node to see your balance",
          )}
        />
        <StatCard
          label="On-chain"
          value={isLoading && running ? "…" : onChainDisplay}
          subtext={nodeLoadSubtext(
            available,
            running,
            "CKB in this wallet, outside Fiber",
            "Start the node to see on-chain CKB",
          )}
        />
      </div>

      {needsFunds ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          Add funds to open a channel with a public hub. Payments need that
          channel.
          <div className="mt-3">
            <Button href="/channels?action=open" outline className="text-xs">
              Add funds
            </Button>
          </div>
        </div>
      ) : null}

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
