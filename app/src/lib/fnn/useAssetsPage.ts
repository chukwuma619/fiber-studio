import { useCallback, useEffect, useState } from "react"
import { getErrorMessage } from "./errors"
import { getAssetsPage } from "./invoke"
import {
  getPageCache,
  invalidatePageCaches,
  PAGE_CACHE_KEYS,
  setPageCache,
} from "./pageCache"
import { usePollInFlight } from "./usePollInFlight"
import type { AssetsPageResponse } from "./types"

const EMPTY_RESPONSE: AssetsPageResponse = {
  available: false,
  network: null,
  assets: [],
  onChainBalances: [],
  channelTotals: [],
  onChainWalletError: null,
  lockScript: null,
}

const DEFAULT_POLL_INTERVAL_MS = 10_000

export function useAssetsPage(running: boolean, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS) {
  const [data, setData] = useState<AssetsPageResponse | null>(() =>
    getPageCache<AssetsPageResponse>(PAGE_CACHE_KEYS.assets),
  )
  const [isLoading, setIsLoading] = useState(
    () => getPageCache<AssetsPageResponse>(PAGE_CACHE_KEYS.assets) === null,
  )
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const runIfIdle = usePollInFlight()

  const refresh = useCallback(
    async (manual = false) => {
      if (!running) {
        setData(EMPTY_RESPONSE)
        setError(null)
        setIsLoading(false)
        setIsRefreshing(false)
        return
      }

      if (manual) {
        invalidatePageCaches(PAGE_CACHE_KEYS.assets)
        setIsRefreshing(true)
      } else if (getPageCache<AssetsPageResponse>(PAGE_CACHE_KEYS.assets)) {
        setIsRefreshing(true)
      }

      const executed = await runIfIdle(
        async () => {
          try {
            const response = await getAssetsPage()
            setPageCache(PAGE_CACHE_KEYS.assets, response)
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
    },
    [runIfIdle, running],
  )

  useEffect(() => {
    const cached = getPageCache<AssetsPageResponse>(PAGE_CACHE_KEYS.assets)
    if (cached) {
      setData(cached)
      setIsLoading(false)
    } else {
      setIsLoading(true)
    }
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
