import { buildPortfolioRows } from "../../lib/fnn/portfolio"
import type {
  AssetBalanceView,
  AssetChannelTotals,
  AssetView,
  NodeStatusState,
} from "../../lib/fnn/types"
import { nodeDataEmptyState } from "../../lib/fnn/nodeEmptyState"
import { HomeEmptyState } from "../home/HomeEmptyState"
import { Badge } from "../ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table"
import { TableRowsSkeleton } from "../ui/skeleton"

type WalletPortfolioSectionProps = {
  available: boolean
  status: NodeStatusState | null
  isLoading?: boolean
  assets: AssetView[]
  onChainBalances: AssetBalanceView[]
  channelTotals: AssetChannelTotals[]
  onChainError?: string | null
  compact?: boolean
}

export function WalletPortfolioSection({
  available,
  status,
  isLoading = false,
  assets,
  onChainBalances,
  channelTotals,
  onChainError,
  compact = false,
}: WalletPortfolioSectionProps) {
  const unavailableState = nodeDataEmptyState(
    status,
    available,
    "Start your node to view your asset balances.",
  )
  const rows = buildPortfolioRows(assets, onChainBalances, channelTotals)

  return (
    <section className="overflow-hidden rounded-lg bg-white shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10">

      {onChainError ? (
        <div className="border-b border-zinc-200 px-5 py-3 text-sm text-amber-800 dark:border-zinc-800 dark:text-amber-300">
          Could not read on-chain balances: {onChainError}
        </div>
      ) : null}

      {isLoading ? (
        <Table dense={compact}>
          <TableHead>
            <TableRow>
              <TableHeader>Asset</TableHeader>
              <TableHeader className="text-right">On-chain</TableHeader>
              <TableHeader className="text-right">In channels</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRowsSkeleton rows={3} cols={3} />
          </TableBody>
        </Table>
      ) : unavailableState ? (
        <HomeEmptyState
          title={unavailableState.title}
          description={unavailableState.description}
        />
      ) : rows.length === 0 ? (
        <HomeEmptyState
          title="No assets yet"
          description="Fund your on-chain wallet or open a channel to hold CKB and UDT on Fiber."
        />
      ) : (
        <Table dense={compact}>
          <TableHead>
            <TableRow>
              <TableHeader>Asset</TableHeader>
              <TableHeader className="text-right">On-chain</TableHeader>
              <TableHeader className="text-right">
                In channels (spendable)
              </TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.assetId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge color="zinc">{row.symbol}</Badge>
                    {!row.isSupported && row.onChainRaw > 0n ? (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        Not in node whitelist
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums text-zinc-950 dark:text-white">
                  {row.onChainDisplay}
                </TableCell>
                <TableCell className="text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                  {row.inChannelRaw > 0n ? row.inChannelDisplay : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {available && rows.some((row) => !row.isSupported && row.onChainRaw > 0n) ? (
        <p className="border-t border-zinc-200 px-5 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Tokens marked “not in node whitelist” are visible on-chain but must be
          added to your node config before you can open channels or receive them
          over Fiber.
        </p>
      ) : null}
    </section>
  )
}
