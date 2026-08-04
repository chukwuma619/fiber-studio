import { useCallback, useEffect, useRef, useState } from "react"
import { Check, Copy, Download } from "lucide-react"
import { exportNodeLogs, getNodeLogs } from "../../lib/fnn/invoke"
import { formatLogLines } from "../../lib/fnn/logFormat"
import { getErrorMessage } from "../../lib/fnn/errors"
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog"
import { Button } from "../ui/button"
import { Text } from "../ui/text"

type NodeLogsDialogProps = {
  open: boolean
  onClose: () => void
}

export function NodeLogsDialog({ open, onClose }: NodeLogsDialogProps) {
  const [logsText, setLogsText] = useState("")
  const [isInitialLoading, setIsInitialLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const logPreRef = useRef<HTMLPreElement>(null)
  const requestIdRef = useRef(0)

  const hasLogs = logsText.trim().length > 0

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

      setLoadError(getErrorMessage(error))
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

    setExportError(null)
    setExportStatus(null)
    setCopied(false)
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

  useEffect(() => {
    if (!copied) {
      return
    }
    const timeout = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timeout)
  }, [copied])

  useEffect(() => {
    if (!exportStatus) {
      return
    }
    const timeout = window.setTimeout(() => setExportStatus(null), 4000)
    return () => window.clearTimeout(timeout)
  }, [exportStatus])

  async function handleCopy() {
    if (!hasLogs) {
      return
    }
    try {
      await navigator.clipboard.writeText(logsText)
      setCopied(true)
      setExportError(null)
    } catch {
      setExportError("Failed to copy logs to the clipboard.")
    }
  }

  async function handleExport() {
    if (isExporting) {
      return
    }

    setIsExporting(true)
    setExportError(null)
    setExportStatus(null)

    try {
      const path = await exportNodeLogs()
      if (path == null) {
        return
      }
      setExportStatus(`Saved to ${path}`)
    } catch (error) {
      setExportError(getErrorMessage(error))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} size="3xl">
      <DialogTitle>Node logs</DialogTitle>
      <DialogDescription>Recent output from your local fnn process.</DialogDescription>
      <DialogBody>
        {loadError ? (
          <Text className="mb-2 text-sm text-red-700 dark:text-red-300">{loadError}</Text>
        ) : null}
        {exportError ? (
          <Text className="mb-2 text-sm text-red-700 dark:text-red-300">{exportError}</Text>
        ) : null}
        {exportStatus ? (
          <Text className="mb-2 text-sm text-emerald-700 dark:text-emerald-300">
            {exportStatus}
          </Text>
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
      <DialogActions>
        <Button outline onClick={onClose}>
          Close
        </Button>
        <Button
          outline
          type="button"
          disabled={!hasLogs}
          onClick={() => void handleCopy()}
        >
          {copied ? (
            <Check data-slot="icon" className="text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Copy data-slot="icon" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button
          type="button"
          disabled={!hasLogs || isExporting}
          onClick={() => void handleExport()}
        >
          <Download data-slot="icon" />
          {isExporting ? "Exporting…" : "Export"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
