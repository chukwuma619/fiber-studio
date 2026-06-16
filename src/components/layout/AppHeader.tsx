import { useState } from "react"
import {
  formatNetworkLabel,
  nodeHeaderLabel,
  nodeStatusDotTone,
} from "../../lib/fnn/useNodeControl"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { NodeLogsDialog } from "./NodeLogsDialog"
import { useNodeControlContext } from "./NodeControlProvider"
import { StatusDot } from "./StatusDot"

export function AppHeader() {
  const [logsOpen, setLogsOpen] = useState(false)
  const {
    config,
    status,
    isLoading,
    isActing,
    stopped,
    starting,
    errored,
    handleStartNode,
    handleStopNode,
  } = useNodeControlContext()

  const headerLabel = nodeHeaderLabel(status, isLoading)
  const dotTone = nodeStatusDotTone(status, isLoading)
  const networkLabel = formatNetworkLabel(config?.network)

  return (
    <>
      <div className="flex flex-col gap-4 border-b py-3 px-4 border-zinc-950/5 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <StatusDot tone={dotTone} />
          <span className="text-sm/5 font-medium text-zinc-950 dark:text-white">
            {headerLabel}
          </span>
          <Badge color="zinc">{networkLabel}</Badge>
          {starting ? <Badge color="amber">starting</Badge> : null}
          {errored ? <Badge color="red">error</Badge> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button outline onClick={() => setLogsOpen(true)}>
            View logs
          </Button>
          {stopped || errored ? (
            <Button onClick={handleStartNode} disabled={isActing || !config}>
              {isActing ? "Starting…" : "Start node"}
            </Button>
          ) : (
            <Button outline onClick={handleStopNode} disabled={isActing || starting}>
              {isActing ? "Stopping…" : "Stop node"}
            </Button>
          )}
        </div>
      </div>

      <NodeLogsDialog open={logsOpen} onClose={() => setLogsOpen(false)} />
    </>
  )
}
