import { pubkeysEqual } from "./relay"
import type { HomeChannel } from "./types"

/** Private inbound CKB channel opened by the configured liquidity node. */
export function isLiquidityOpenedChannel(
  channel: HomeChannel,
  lspPubkey: string | null | undefined,
): boolean {
  if (!lspPubkey) return false
  if (channel.isPublic || !channel.isAcceptor || channel.isOneWay) return false
  if (channel.fundingUdtTypeScript) return false
  if (channel.assetSymbol.toUpperCase() !== "CKB") return false
  return pubkeysEqual(channel.pubkey, lspPubkey)
}
