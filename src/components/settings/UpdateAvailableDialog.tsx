import type { AppUpdateInfo } from "../../lib/updates/appUpdater"
import { releaseNotesUrl, RELEASES_URL } from "../../lib/updates/constants"
import { Button } from "../ui/button"
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog"
import { Link } from "../ui/link"
import { Text } from "../ui/text"

type UpdateAvailableDialogProps = {
  open: boolean
  update: AppUpdateInfo | null
  isInstalling: boolean
  downloadProgress: number | null
  error: string | null
  onInstall: () => void
  onDismiss: () => void
  onSkip: () => void
}

export function UpdateAvailableDialog({
  open,
  update,
  isInstalling,
  downloadProgress,
  error,
  onInstall,
  onDismiss,
  onSkip,
}: UpdateAvailableDialogProps) {
  if (!update) {
    return null
  }

  const notesUrl = releaseNotesUrl(update.version)

  return (
    <Dialog open={open} onClose={isInstalling ? () => {} : onDismiss} size="md">
      <DialogTitle>Update available</DialogTitle>
      <DialogDescription>
        Fiber Studio {update.version} is available. You are on {update.currentVersion}.
        Your node will stop before installing, then the app will restart.
      </DialogDescription>
      <DialogBody>
        {update.notes ? (
          <Text className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
            {update.notes}
          </Text>
        ) : null}
        <Text className="mt-3 text-sm">
          <Link href={notesUrl} target="_blank" rel="noreferrer">
            View release notes
          </Link>
          {" · "}
          <Link href={RELEASES_URL} target="_blank" rel="noreferrer">
            All releases
          </Link>
        </Text>
        {isInstalling && downloadProgress != null ? (
          <Text className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Downloading… {downloadProgress}%
          </Text>
        ) : null}
        {error ? (
          <Text className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</Text>
        ) : null}
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onSkip} disabled={isInstalling}>
          Skip this version
        </Button>
        <Button outline onClick={onDismiss} disabled={isInstalling}>
          Later
        </Button>
        <Button onClick={onInstall} disabled={isInstalling}>
          {isInstalling ? "Installing…" : "Install and restart"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
