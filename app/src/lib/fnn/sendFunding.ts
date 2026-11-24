import { liquidityForNetwork } from "../liquidity"
import { CHANNEL_OPEN_MIN_FUNDING_CKB, CHANNEL_RESERVE_CKB } from "../public-relays"
import { parseHexU128 } from "./ckbAmount"
import { requiredWalletCkbForOpen } from "./format"
import { pubkeysEqual } from "./relay"
import type { HomeChannel } from "./types"

const SHANNONS_PER_CKB = 100_000_000n

export type SendFundingPlan = {
  providerLabel: string
  providerPubkey: string
  fundingCkb: number
  amountRaw: bigint
}

export function planSendFunding(input: {
  network: string | null | undefined
  amountRaw: bigint
  spendableRaw: bigint
  walletCkb: number | null
  assetIsCkb: boolean
}): SendFundingPlan | null {
  if (!input.assetIsCkb || input.amountRaw <= 0n) return null
  if (input.spendableRaw >= input.amountRaw) return null
  const provider = liquidityForNetwork(input.network)
  if (!provider) return null
  if (input.walletCkb === null) return null

  const needed =
    input.amountRaw + BigInt(CHANNEL_RESERVE_CKB) * SHANNONS_PER_CKB
  const roundedUp = (needed + SHANNONS_PER_CKB - 1n) / SHANNONS_PER_CKB
  const fundingCkb = Math.max(CHANNEL_OPEN_MIN_FUNDING_CKB, Number(roundedUp))
  if (input.walletCkb < requiredWalletCkbForOpen(fundingCkb)) return null

  return {
    providerLabel: provider.label,
    providerPubkey: provider.pubkey,
    fundingCkb,
    amountRaw: input.amountRaw,
  }
}

function channelCanSpend(
  channel: HomeChannel,
  providerPubkey: string,
  amountRaw: bigint,
): boolean {
  return (
    channel.state === "ChannelReady" &&
    channel.assetSymbol.toUpperCase() === "CKB" &&
    pubkeysEqual(channel.pubkey, providerPubkey) &&
    parseHexU128(channel.localBalance) >= amountRaw
  )
}

export async function waitForSpendableChannel(input: {
  providerPubkey: string
  amountRaw: bigint
  fetchChannels: () => Promise<HomeChannel[]>
  timeoutMs?: number
  intervalMs?: number
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}): Promise<boolean> {
  const timeoutMs = input.timeoutMs ?? 8 * 60 * 1000
  const intervalMs = input.intervalMs ?? 3_000
  const sleep =
    input.sleep ??
    ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  const now = input.now ?? Date.now
  const deadline = now() + timeoutMs

  while (now() <= deadline) {
    const channels = await input.fetchChannels()
    if (
      channels.some((channel) =>
        channelCanSpend(channel, input.providerPubkey, input.amountRaw),
      )
    ) {
      return true
    }
    if (now() + intervalMs > deadline) break
    await sleep(intervalMs)
  }
  return false
}
