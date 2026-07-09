import { useCallback, useEffect, useState } from "react"
import { getErrorMessage } from "./errors"
import { getNetworkPage } from "./invoke"
import {
  getPageCache,
  invalidatePageCaches,
  PAGE_CACHE_KEYS,
  setPageCache,
} from "./pageCache"
import { usePollInFlight } from "./usePollInFlight"
import { CHANNEL_OPEN_MIN_FUNDING_CKB } from "../public-relays"
import type { NetworkPageResponse } from "./types"

const EMPTY_RESPONSE: NetworkPageResponse = {
  available: false,
  network: null,
  nodePubkey: null,
  savedPeers: [],
  savedPeerConnectedCount: 0,
  relayStatus: "not_configured",
  graphNodeCount: 0,
  graphReady: false,
  connectedPeerCount: 0,
  relays: [],
  connectedPeers: [],
  customPeers: [],
  onChainWalletCkb: null,
  onChainWalletError: null,
  minFundingCkb: CHANNEL_OPEN_MIN_FUNDING_CKB,
}

const CONNECTING_POLL_INTERVAL_MS = 3_000
const DEFAULT_POLL_INTERVAL_MS = 10_000

export function useNetworkPage(running: boolean, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS) {
  const [data, setData] = useState<NetworkPageResponse | null>(() =>
    getPageCache<NetworkPageResponse>(PAGE_CACHE_KEYS.network),
  )
  const [isLoading, setIsLoading] = useState(
    () => getPageCache<NetworkPageResponse>(PAGE_CACHE_KEYS.network) === null,
  )
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const runIfIdle = usePollInFlight()

  const effectivePollIntervalMs =
    data?.relayStatus === "connecting" ? CONNECTING_POLL_INTERVAL_MS : pollIntervalMs

  const refresh = useCallback(async (manual = false) => {
    if (!running) {
      setData(EMPTY_RESPONSE)
      setError(null)
      setIsLoading(false)
      setIsRefreshing(false)
      return
    }

    if (manual) {
      invalidatePageCaches(PAGE_CACHE_KEYS.network)
      setIsRefreshing(true)
    } else if (getPageCache<NetworkPageResponse>(PAGE_CACHE_KEYS.network)) {
      setIsRefreshing(true)
    }

    const executed = await runIfIdle(
      async () => {
        try {
          const response = await getNetworkPage()
          setPageCache(PAGE_CACHE_KEYS.network, response)
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
    const cached = getPageCache<NetworkPageResponse>(PAGE_CACHE_KEYS.network)
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
