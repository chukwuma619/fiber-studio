import { useCallback, useEffect, useState } from "react"
import { getChannelsPage } from "./invoke"
import { CHANNEL_OPEN_MIN_FUNDING_CKB } from "../public-relays"
import type { ChannelsPageResponse } from "./types"

const EMPTY_RESPONSE: ChannelsPageResponse = {
  available: false,
  channels: [],
  activeChannelCount: 0,
  pendingChannelCount: 0,
  totalCapacity: "0",
  totalLocalBalance: "0",
  onChainWalletCkb: null,
  onChainWalletError: null,
  network: null,
  defaultFundingLockScript: null,
  savedPeers: [],
  relayStatus: "not_configured",
  minFundingCkb: CHANNEL_OPEN_MIN_FUNDING_CKB,
}

const OPENING_POLL_INTERVAL_MS = 3_000
const DEFAULT_POLL_INTERVAL_MS = 10_000

export function useChannelsPage(running: boolean, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS) {
  const [data, setData] = useState<ChannelsPageResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectivePollIntervalMs =
    (data?.pendingChannelCount ?? 0) > 0
      ? OPENING_POLL_INTERVAL_MS
      : pollIntervalMs

  const refresh = useCallback(async (manual = false) => {
    if (!running) {
      setData(EMPTY_RESPONSE)
      setError(null)
      setIsLoading(false)
      setIsRefreshing(false)
      return
    }

    if (manual) {
      setIsRefreshing(true)
    }

    try {
      const response = await getChannelsPage()
      setData(response)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [running])

  useEffect(() => {
    setIsLoading(true)
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!running || effectivePollIntervalMs <= 0) {
      return
    }

    const interval = window.setInterval(() => {
      void refresh()
    }, effectivePollIntervalMs)

    return () => {
      window.clearInterval(interval)
    }
  }, [effectivePollIntervalMs, refresh, running])

  const refreshNow = useCallback(() => refresh(true), [refresh])

  return { data, isLoading, isRefreshing, error, refresh: refreshNow }
}
