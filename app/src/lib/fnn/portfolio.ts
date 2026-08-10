import type {
  AssetBalanceView,
  AssetChannelTotals,
  AssetView,
} from "./types"
import { CKB_ASSET_ID } from "./assets"
import { parseHexU128 } from "./format"

export type PortfolioRow = {
  assetId: string
  symbol: string
  name: string
  onChainDisplay: string
  onChainRaw: bigint
  inChannelDisplay: string
  inChannelRaw: bigint
  isSupported: boolean
}

function zeroBalanceDisplay(symbol: string): string {
  return symbol === "CKB" ? "0 CKB" : `0 ${symbol}`
}

export function buildPortfolioRows(
  assets: AssetView[],
  onChainBalances: AssetBalanceView[],
  channelTotals: AssetChannelTotals[],
): PortfolioRow[] {
  const onChainById = new Map(
    onChainBalances.map((balance) => [balance.assetId.toLowerCase(), balance]),
  )
  const channelById = new Map(
    channelTotals.map((total) => [total.assetId.toLowerCase(), total]),
  )

  const assetIds = new Set<string>()
  for (const asset of assets) {
    assetIds.add(asset.id.toLowerCase())
  }
  for (const balance of onChainBalances) {
    assetIds.add(balance.assetId.toLowerCase())
  }
  for (const total of channelTotals) {
    assetIds.add(total.assetId.toLowerCase())
  }

  const rows: PortfolioRow[] = []

  for (const id of assetIds) {
    const asset = assets.find((entry) => entry.id.toLowerCase() === id)
    const onChain = onChainById.get(id)
    const channel = channelById.get(id)
    const symbol = asset?.symbol ?? onChain?.symbol ?? channel?.symbol ?? "UDT"
    const name = asset?.name ?? symbol
    const onChainRaw = onChain ? parseHexU128(onChain.rawAmount) : 0n
    const inChannelRaw = channel ? parseHexU128(channel.localBalance) : 0n

    rows.push({
      assetId: asset?.id ?? onChain?.assetId ?? channel?.assetId ?? id,
      symbol,
      name,
      onChainDisplay: onChain?.amountDisplay ?? zeroBalanceDisplay(symbol),
      onChainRaw,
      inChannelDisplay:
        channel?.localBalanceDisplay ?? (inChannelRaw > 0n ? "—" : "—"),
      inChannelRaw,
      isSupported: asset !== undefined,
    })
  }

  return rows
    .filter(
      (row) =>
        row.onChainRaw > 0n ||
        row.inChannelRaw > 0n ||
        row.isSupported,
    )
    .sort((left, right) => {
      if (left.assetId.toLowerCase() === CKB_ASSET_ID) return -1
      if (right.assetId.toLowerCase() === CKB_ASSET_ID) return 1
      if (left.onChainRaw > 0n && right.onChainRaw === 0n) return -1
      if (right.onChainRaw > 0n && left.onChainRaw === 0n) return 1
      return left.symbol.localeCompare(right.symbol)
    })
}
