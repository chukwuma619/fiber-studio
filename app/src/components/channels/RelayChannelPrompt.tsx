import { useNavigate } from "@tanstack/react-router"
import { Button } from "../ui/button"
import {
  Dialog,
  DialogActions,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog"

type RelayChannelPromptProps = {
  open: boolean
  onClose: () => void
}

export function RelayChannelPrompt({ open, onClose }: RelayChannelPromptProps) {
  const navigate = useNavigate()

  function addFunds() {
    onClose()
    void navigate({
      to: "/channels",
      search: { action: "open" },
    })
  }

  return (
    <Dialog open={open} onClose={onClose} size="md">
      <DialogTitle>Add funds</DialogTitle>
      <DialogDescription>
        Open a channel with a public hub so you can send and receive. You can
        skip this and add funds later.
      </DialogDescription>
      <DialogActions>
        <Button plain onClick={onClose}>
          Not now
        </Button>
        <Button onClick={addFunds}>Add funds</Button>
      </DialogActions>
    </Dialog>
  )
}
