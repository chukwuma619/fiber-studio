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
  logs: string[]
}

export function NodeLogsDialog({ open, onClose, logs }: NodeLogsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} size="3xl">
      <DialogTitle>Node logs</DialogTitle>
      <DialogDescription>Recent output from your local fnn process.</DialogDescription>
      <DialogBody>
        {logs.length ? (
          <pre className="max-h-[min(60vh,28rem)] overflow-auto rounded-lg bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-100">
            {logs.join("\n")}
          </pre>
        ) : (
          <Text className="text-sm text-zinc-500 dark:text-zinc-400">
            No logs yet. Start the node to see output here.
          </Text>
        )}
      </DialogBody>
    </Dialog>
  )
}
