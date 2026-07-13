import { useEffect, useState } from "react"
import type { UpdateWalletPasswordPayload } from "../../lib/fnn/types"
import { ErrorMessage, Field, Label } from "../ui/fieldset"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog"
import { Text } from "../ui/text"
import { getErrorMessage } from "../../lib/fnn/errors"

type ChangePasswordDialogProps = {
  open: boolean
  onClose: () => void
  isActing: boolean
  onSave: (payload: UpdateWalletPasswordPayload) => Promise<unknown>
}

export function ChangePasswordDialog({
  open,
  onClose,
  isActing,
  onSave,
}: ChangePasswordDialogProps) {
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setOldPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setError(null)
  }, [open])

  async function handleSave() {
    setError(null)
    if (!oldPassword.trim() || !newPassword.trim()) {
      setError("Enter your current and new password.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.")
      return
    }

    try {
      await onSave({ oldPassword, newPassword })
      onClose()
    } catch (caught) {
      setError(getErrorMessage(caught))
    }
  }

  return (
    <Dialog open={open} onClose={isActing ? () => {} : onClose} size="md">
      <DialogTitle>Change wallet password</DialogTitle>
      <DialogDescription>
        Updates the password stored in your OS keychain. Stop your node first.
      </DialogDescription>
      <DialogBody>
        <Text className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          fnn uses this password on startup to access your wallet key file.
        </Text>
        <div className="space-y-4">
          <Field>
            <Label>Current password</Label>
            <Input
              type="password"
              value={oldPassword}
              onChange={(event) => setOldPassword(event.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <Field>
            <Label>New password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field>
            <Label>Confirm new password</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            />
            {error ? <ErrorMessage>{error}</ErrorMessage> : null}
          </Field>
        </div>
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose} disabled={isActing}>
          Cancel
        </Button>
        <Button onClick={() => void handleSave()} disabled={isActing}>
          {isActing ? "Saving…" : "Update password"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
