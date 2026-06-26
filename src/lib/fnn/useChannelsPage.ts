import { useCallback, useEffect, useState } from "react"
import { getChannelsPage } from "./invoke"
import type { ChannelsPageResponse } from "./types"

const EMPTY_RESPONSE: ChannelsPageResponse = {
  available: false,
  channels: [],
  activeChannelCount: 0,
  totalCapacity: "0",
  totalLocalBalance: "0",
  network: null,
  defaultFundingLockScript: null,
}

export function useChannelsPage(running: boolean, pollIntervalMs = 10_000) {
  const [data, setData] = useState<ChannelsPageResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!running) {
      setData(EMPTY_RESPONSE)
      setError(null)
      setIsLoading(false)
      return
    }

    try {
      const response = await getChannelsPage()
      setData(response)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
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

  return { data, isLoading, error, refresh }
}
