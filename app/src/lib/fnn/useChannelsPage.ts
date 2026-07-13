import { useCallback, useEffect, useState } from "react"
import { getErrorMessage } from "./errors"
import { getChannelsPage } from "./invoke"
import {
  getPageCache,
  invalidatePageCaches,
  PAGE_CACHE_KEYS,
  setPageCache,
} from "./pageCache"
import { usePollInFlight } from "./usePollInFlight"
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
  const [data, setData] = useState<ChannelsPageResponse | null>(() =>
    getPageCache<ChannelsPageResponse>(PAGE_CACHE_KEYS.channels),
  )
  const [isLoading, setIsLoading] = useState(
    () => getPageCache<ChannelsPageResponse>(PAGE_CACHE_KEYS.channels) === null,
  )
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const runIfIdle = usePollInFlight()

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
      invalidatePageCaches(PAGE_CACHE_KEYS.channels, PAGE_CACHE_KEYS.home)
      setIsRefreshing(true)
    } else if (getPageCache<ChannelsPageResponse>(PAGE_CACHE_KEYS.channels)) {
      setIsRefreshing(true)
    }

    const executed = await runIfIdle(
      async () => {
        try {
          const response = await getChannelsPage()
          setPageCache(PAGE_CACHE_KEYS.channels, response)
          setData(response)
          setError(null)
        } catch (err) {
          setError(getErrorMessage(err))
        }
      },
      { force: manual },
    )

    if (!executed) {
      if (manual) {
        setIsRefreshing(false)
      }
      return
    }

    setIsLoading(false)
    setIsRefreshing(false)
  }, [runIfIdle, running])

  useEffect(() => {
    const cached = getPageCache<ChannelsPageResponse>(PAGE_CACHE_KEYS.channels)
    if (cached) {
      setData(cached)
      setIsLoading(false)
    } else {
      setIsLoading(true)
    }
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
