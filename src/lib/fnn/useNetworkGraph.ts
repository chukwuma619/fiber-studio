import { useCallback, useEffect, useState } from "react"
import { getNetworkGraph } from "./invoke"
import type {
  NetworkGraphChannelEntry,
  NetworkGraphKind,
  NetworkGraphNodeEntry,
} from "./types"

const GRAPH_PAGE_LIMIT = 25

export function useNetworkGraph(running: boolean, kind: NetworkGraphKind) {
  const [nodes, setNodes] = useState<NetworkGraphNodeEntry[]>([])
  const [channels, setChannels] = useState<NetworkGraphChannelEntry[]>([])
  const [lastCursor, setLastCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setNodes([])
    setChannels([])
    setLastCursor(null)
    setHasMore(false)
    setError(null)
  }, [])

  const load = useCallback(
    async (after?: string | null) => {
      if (!running) {
        reset()
        setIsLoading(false)
        setIsLoadingMore(false)
        return
      }

      const loadingMore = Boolean(after)
      if (loadingMore) {
        setIsLoadingMore(true)
      } else {
        setIsLoading(true)
      }

      try {
        const response = await getNetworkGraph({
          kind,
          limit: GRAPH_PAGE_LIMIT,
          after: after ?? undefined,
        })

        if (kind === "nodes") {
          setNodes((current) =>
            loadingMore ? [...current, ...response.nodes] : response.nodes,
          )
        } else {
          setChannels((current) =>
            loadingMore ? [...current, ...response.channels] : response.channels,
          )
        }

        setLastCursor(response.lastCursor)
        setHasMore(response.hasMore)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [kind, reset, running],
  )

  useEffect(() => {
    reset()
    void load()
  }, [kind, load, reset])

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore || !lastCursor) return
    void load(lastCursor)
  }, [hasMore, isLoadingMore, lastCursor, load])

  const refresh = useCallback(() => {
    void load()
  }, [load])

  return {
    nodes,
    channels,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    loadMore,
    refresh,
  }
}
