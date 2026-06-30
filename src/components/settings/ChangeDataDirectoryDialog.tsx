import { useEffect, useState } from "react"
import type { MigrateDataDirectoryPayload } from "../../lib/fnn/types"
import { DataDirectoryStep } from "../setup/steps/DataDirectoryStep"
import { Button } from "../ui/button"
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog"
import { Text } from "../ui/text"

type ChangeDataDirectoryDialogProps = {
  open: boolean
  onClose: () => void
  currentDataDirectory: string
  isActing: boolean
  onSave: (payload: MigrateDataDirectoryPayload) => Promise<unknown>
}

export function ChangeDataDirectoryDialog({
  open,
  onClose,
  currentDataDirectory,
  isActing,
  onSave,
}: ChangeDataDirectoryDialogProps) {
  const [newDataDirectory, setNewDataDirectory] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setNewDataDirectory(`${currentDataDirectory}-migrated`)
    setError(null)
  }, [currentDataDirectory, open])

  async function handleSave() {
    setError(null)
    if (!newDataDirectory.trim()) {
      setError("New data directory is required.")
      return
    }
    if (newDataDirectory.trim() === currentDataDirectory.trim()) {
      setError("Choose a different path.")
      return
    }

    try {
      await onSave({ newDataDirectory: newDataDirectory.trim() })
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }

  return (
    <Dialog open={open} onClose={isActing ? () => {} : onClose} size="lg">
      <DialogTitle>Move data directory</DialogTitle>
      <DialogDescription>
        Copies your entire node data to a new folder on the same network. Your
        node must be stopped.
      </DialogDescription>
      <DialogBody>
        <Text className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Current:{" "}
          <span className="font-mono text-xs">{currentDataDirectory}</span>
        </Text>
        <DataDirectoryStep
          dataDirectory={newDataDirectory}
          onChange={setNewDataDirectory}
          error={error}
        />
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose} disabled={isActing}>
          Cancel
        </Button>
        <Button onClick={() => void handleSave()} disabled={isActing}>
          {isActing ? "Migrating…" : "Migrate"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
