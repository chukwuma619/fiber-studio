import type {
  AssetBalanceView,
  AssetChannelTotals,
  AssetView,
  CkbScript,
} from "./types"
import { formatCkb, parseHexU128 } from "./format"

export type { AssetBalanceView, AssetChannelTotals, AssetView }

export function channelCapacityDisplay(
  localBalance: string,
  remoteBalance: string,
  assetSymbol: string,
): string {
  const total =
    parseHexU128(localBalance) + parseHexU128(remoteBalance)
  if (assetSymbol === "CKB") {
    return `${formatCkb(total)} CKB`
  }
  return `${formatCkb(total)} ${assetSymbol}`
}

export const CKB_ASSET_ID = "ckb"

export function assetScriptKey(script: CkbScript): string {
  return script.args.toLowerCase()
}

export function findAssetById(
  assets: AssetView[],
  assetId: string,
): AssetView | undefined {
  return assets.find((asset) => asset.id.toLowerCase() === assetId.toLowerCase())
}

export function findAssetForScript(
  assets: AssetView[],
  script: CkbScript,
): AssetView | undefined {
  const key = assetScriptKey(script)
  return assets.find(
    (asset) =>
      asset.udtTypeScript &&
      asset.udtTypeScript.args.toLowerCase() === key,
  )
}

export function defaultAsset(assets: AssetView[]): AssetView {
  return findAssetById(assets, CKB_ASSET_ID) ?? {
    id: CKB_ASSET_ID,
    name: "CKB",
    symbol: "CKB",
    decimals: 8,
  }
}
