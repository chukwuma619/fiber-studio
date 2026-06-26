import { useCallback, useEffect, useState } from "react"
import { getChannelsPage } from "./invoke"
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
}

export function useChannelsPage(running: boolean, pollIntervalMs = 10_000) {
  const [data, setData] = useState<ChannelsPageResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    if (!running || pollIntervalMs <= 0) {
      return
    }

    const interval = window.setInterval(() => {
      void refresh()
    }, pollIntervalMs)

    return () => {
      window.clearInterval(interval)
    }
  }, [pollIntervalMs, refresh, running])

  const refreshNow = useCallback(() => refresh(true), [refresh])

  return { data, isLoading, isRefreshing, error, refresh: refreshNow }
}
