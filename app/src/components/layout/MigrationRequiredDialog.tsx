import { Button } from "../ui/button"
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog"
import { Text } from "../ui/text"

type MigrationRequiredDialogProps = {
  open: boolean
  message: string
  hasBreakingChange: boolean
  isActing: boolean
  onClose: () => void
  onConfirm: () => void
}

export function MigrationRequiredDialog({
  open,
  message,
  hasBreakingChange,
  isActing,
  onClose,
  onConfirm,
}: MigrationRequiredDialogProps) {
  return (
    <Dialog open={open} onClose={isActing ? () => {} : onClose} size="lg">
      <DialogTitle>Database migration required</DialogTitle>
      <DialogDescription>
        This fnn upgrade needs a one-time database migration before your node can
        start again.
      </DialogDescription>
      <DialogBody>
        <div className="space-y-4">
          <Text className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {message}
          </Text>
          <Text className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Fiber Studio will create a timestamped backup of your data directory
            before running the migration.
          </Text>
          {hasBreakingChange ? (
            <Text className="text-sm leading-relaxed text-amber-700 dark:text-amber-300">
              This migration includes breaking changes. Close channels and verify
              your backup before continuing.
            </Text>
          ) : null}
        </div>
      </DialogBody>
      <DialogActions>
        <Button outline onClick={onClose} disabled={isActing}>
          Cancel
        </Button>
        <Button onClick={onConfirm} disabled={isActing}>
          {isActing ? "Migrating…" : "Migrate and start"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
