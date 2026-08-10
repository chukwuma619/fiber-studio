import type { CkbScript } from "./types"

export type AssetView = {
  id: string
  name: string
  symbol: string
  decimals: number
  udtTypeScript?: CkbScript | null
}

export type AssetBalanceView = {
  assetId: string
  symbol: string
  amountDisplay: string
  rawAmount: string
}

export type AssetChannelTotals = {
  assetId: string
  symbol: string
  localBalance: string
  remoteBalance: string
  localBalanceDisplay: string
  capacityDisplay: string
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
