import { useEffect, useRef, useState } from "react"
import { getErrorMessage } from "./errors"
import { getChannelNeighborhood } from "./invoke"
import type { NeighborhoodResponse } from "./types"

export function useChannelNeighborhood(
  running: boolean,
  expandPubkey: string | null,
  reloadToken: number,
) {
  const [data, setData] = useState<NeighborhoodResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seenReload = useRef<number | null>(null)
  const pendingRefresh = useRef(false)
  if (seenReload.current !== reloadToken) {
    pendingRefresh.current = reloadToken > 0
    seenReload.current = reloadToken
  }

  useEffect(() => {
    if (!running) {
      setData(null)
      setError(null)
      setIsLoading(false)
      return
    }

    const refresh = pendingRefresh.current
    let cancelled = false
    setIsLoading(true)
    void getChannelNeighborhood({
      expandPubkey: expandPubkey ?? undefined,
      refresh,
    })
      .then((response) => {
        if (cancelled) return
        setData(response)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(getErrorMessage(err))
      })
      .finally(() => {
        if (cancelled) return
        if (refresh) pendingRefresh.current = false
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [expandPubkey, reloadToken, running])

  return { data, isLoading, error }
}
