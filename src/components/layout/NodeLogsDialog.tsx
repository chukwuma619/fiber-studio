import { useCallback, useEffect, useRef, useState } from "react"
import { getNodeLogs } from "../../lib/fnn/invoke"
import { formatLogLines } from "../../lib/fnn/logFormat"
import {
  Dialog,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog"
import { Text } from "../ui/text"

type NodeLogsDialogProps = {
  open: boolean
  onClose: () => void
}

export function NodeLogsDialog({ open, onClose }: NodeLogsDialogProps) {
  const [logsText, setLogsText] = useState("")
  const [isInitialLoading, setIsInitialLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const logPreRef = useRef<HTMLPreElement>(null)
  const requestIdRef = useRef(0)

  const scrollToBottom = useCallback(() => {
    const element = logPreRef.current
    if (element) {
      element.scrollTop = element.scrollHeight
    }
  }, [])

  const loadLogs = useCallback(async (isInitial: boolean) => {
    const requestId = ++requestIdRef.current

    if (isInitial) {
      setIsInitialLoading(true)
      setLoadError(null)
    }

    try {
      const lines = await getNodeLogs()
      if (requestId !== requestIdRef.current) {
        return
      }

      setLogsText(formatLogLines(lines))
      setLoadError(null)
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return
      }

      setLoadError(error instanceof Error ? error.message : String(error))
    } finally {
      if (requestId === requestIdRef.current && isInitial) {
        setIsInitialLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }

    void loadLogs(true)

    const interval = window.setInterval(() => {
      void loadLogs(false)
    }, 3000)

    return () => {
      window.clearInterval(interval)
      requestIdRef.current += 1
    }
  }, [loadLogs, open])

  useEffect(() => {
    if (!open || !logsText) {
      return
    }

    requestAnimationFrame(() => {
      scrollToBottom()
    })
  }, [logsText, open, scrollToBottom])

  return (
    <Dialog open={open} onClose={onClose} size="3xl">
      <DialogTitle>Node logs</DialogTitle>
      <DialogDescription>Recent output from your local fnn process.</DialogDescription>
      <DialogBody>
        {loadError ? (
          <Text className="mb-2 text-sm text-red-700 dark:text-red-300">{loadError}</Text>
        ) : null}
        {isInitialLoading && !logsText ? (
          <Text className="text-sm text-zinc-500 dark:text-zinc-400">Loading logs…</Text>
        ) : logsText ? (
          <pre
            ref={logPreRef}
            className="max-h-[min(60vh,28rem)] overflow-auto rounded-lg bg-zinc-950 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words text-zinc-100"
          >
            {logsText}
          </pre>
        ) : !loadError ? (
          <Text className="text-sm text-zinc-500 dark:text-zinc-400">
            No logs yet. Start the node to see output here.
          </Text>
        ) : null}
      </DialogBody>
    </Dialog>
  )
}
