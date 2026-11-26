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
  isLegacyChannelBlock?: boolean
  isActing: boolean
  error?: string | null
  onClose: () => void
  onConfirm: () => void
}

export function MigrationRequiredDialog({
  open,
  message,
  hasBreakingChange,
  isLegacyChannelBlock = false,
  isActing,
  error = null,
  onClose,
  onConfirm,
}: MigrationRequiredDialogProps) {
  let confirmLabel = "Back up and migrate"
  if (isLegacyChannelBlock) {
    confirmLabel = "Back up and start 0.10.1"
  }
  if (isActing) {
    confirmLabel = isLegacyChannelBlock ? "Backing up & starting…" : "Migrating…"
  }

  return (
    <Dialog open={open} onClose={isActing ? () => {} : onClose} size="lg">
      <DialogTitle>
        {isLegacyChannelBlock
          ? "Fiber 0.10.1 could not open this database"
          : "Upgrade database for Fiber 0.10.1"}
      </DialogTitle>
      <DialogDescription>
        {isLegacyChannelBlock
          ? "Fiber refused the in-place upgrade and left your database unchanged."
          : "Fiber 0.10.1 upgrades your existing database in place, then the node can start."}
      </DialogDescription>
      <DialogBody>
        <div className="space-y-4">
          {isLegacyChannelBlock ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200 space-y-2">
              <p className="font-semibold text-amber-900 dark:text-amber-100">
                Start this version anyway
              </p>
              <p className="leading-relaxed">
                Unfinished V1 channels are not safely closed, so Fiber will not
                migrate this store. Fiber Studio will back up the whole data
                directory, set that channel database aside, and start a new
                Channel V2 database so 0.10.1 can run.
              </p>
              <p className="leading-relaxed text-amber-800/90 dark:text-amber-300/80">
                Your keys, CKB address, configuration, and on-chain funds stay
                where they are. The previous channel database stays in the
                backup.
              </p>
            </div>
          ) : (
            <>
              <Text className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {message}
              </Text>
              <Text className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Fiber Studio backs up your data directory, confirms the
                migration, and starts the node. Channel V2 channels stay open
                and do not need to be closed.
              </Text>
              {hasBreakingChange ? (
                <Text className="text-sm leading-relaxed text-amber-700 dark:text-amber-300">
                  This upgrade includes breaking changes. The backup is taken
                  before Fiber writes the new database version.
                </Text>
              ) : null}
            </>
          )}

          {isLegacyChannelBlock && message ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Reason from node:
              </p>
              <div className="rounded-md bg-zinc-100 p-2.5 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 max-h-28 overflow-y-auto">
                {message}
              </div>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm leading-relaxed text-red-700 dark:text-red-300">
              {error}
            </p>
          ) : null}
        </div>
      </DialogBody>
      <DialogActions>
        <Button outline onClick={onClose} disabled={isActing}>
          Cancel
        </Button>
        <Button onClick={onConfirm} disabled={isActing}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
