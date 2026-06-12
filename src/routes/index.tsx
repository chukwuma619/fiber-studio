import { createFileRoute, redirect } from "@tanstack/react-router"
import { useCallback, useEffect, useState } from "react"
import { Button } from "../components/ui/button"
import { Heading } from "../components/ui/heading"
import { Text } from "../components/ui/text"
import { getNodeStatus, startNode, stopNode } from "../lib/fnn/invoke"
import {
  formatNodeStatusLabelFromResponse,
  isNodeRunning,
} from "../lib/fnn/status"
import type { NodeStatusResponse } from "../lib/fnn/types"
import { truncatePubkey } from "../lib/public-relays"
import { getSetupComplete, loadSetupConfig } from "../lib/setup/storage"

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (!getSetupComplete()) {
      throw redirect({ to: "/setup" })
    }
  },
  component: IndexPage,
})

function IndexPage() {
  const config = loadSetupConfig()
  const [nodeStatus, setNodeStatus] = useState<NodeStatusResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isActing, setIsActing] = useState(false)

  const refreshStatus = useCallback(async () => {
    try {
      const status = await getNodeStatus()
      setNodeStatus(status)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  async function handleStartNode() {
    if (!config?.dataDirectory) return

    setIsActing(true)
    setActionError(null)
    try {
      const status = await startNode({ dataDirectory: config.dataDirectory })
      setNodeStatus(status)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsActing(false)
    }
  }

  async function handleStopNode() {
    setIsActing(true)
    setActionError(null)
    try {
      const status = await stopNode()
      setNodeStatus(status)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsActing(false)
    }
  }

  const running = nodeStatus ? isNodeRunning(nodeStatus.status) : false
  const statusLabel = formatNodeStatusLabelFromResponse(nodeStatus, isLoading)

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 p-8">
      <div>
        <Heading>Fiber Studio</Heading>
        <Text className="mt-2">
          Your local fnn node dashboard. Connect to your saved peer and open
          channels when you are ready.
        </Text>
      </div>

      <div className="rounded-lg bg-white p-6 shadow-xs ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Text className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Node status
            </Text>
            <Text className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">
              {statusLabel}
            </Text>
          </div>
          <div className="flex gap-2">
            {running ? (
              <Button outline onClick={handleStopNode} disabled={isActing}>
                Stop node
              </Button>
            ) : (
              <Button onClick={handleStartNode} disabled={isActing || !config}>
                {isActing ? "Starting…" : "Start node"}
              </Button>
            )}
          </div>
        </div>

        {running && nodeStatus && isNodeRunning(nodeStatus.status) ? (
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">fnn version</dt>
              <dd className="font-mono text-xs">{nodeStatus.status.version}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Node pubkey</dt>
              <dd className="font-mono text-xs">
                {truncatePubkey(nodeStatus.status.pubkey)}
              </dd>
            </div>
          </dl>
        ) : null}

        {config ? (
          <dl className="mt-4 space-y-2 border-t border-zinc-950/5 pt-4 text-sm dark:border-white/10">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Network</dt>
              <dd>{config.network}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Data directory</dt>
              <dd className="truncate font-mono text-xs">{config.dataDirectory}</dd>
            </div>
            {config.customPublicNodePubkey ? (
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Saved peer</dt>
                <dd className="font-mono text-xs">
                  {truncatePubkey(config.customPublicNodePubkey)}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {actionError ? (
          <Text className="mt-4 text-sm text-red-600 dark:text-red-400">
            {actionError}
          </Text>
        ) : null}

        {nodeStatus?.recentLogs.length ? (
          <div className="mt-4 border-t border-zinc-950/5 pt-4 dark:border-white/10">
            <Text className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Recent logs
            </Text>
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-zinc-950 p-3 font-mono text-xs text-zinc-100">
              {nodeStatus.recentLogs.join("\n")}
            </pre>
          </div>
        ) : null}
      </div>
    </main>
  )
}
