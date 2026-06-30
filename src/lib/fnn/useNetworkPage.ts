import { useCallback, useEffect, useState } from "react"
import { getNetworkPage } from "./invoke"
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
  const [data, setData] = useState<NetworkPageResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
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
      setIsRefreshing(true)
    }

    const executed = await runIfIdle(
      async () => {
        try {
          const response = await getNetworkPage()
          setData(response)
          setError(null)
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
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
