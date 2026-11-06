import { useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import type { HomeDashboardResponse } from "../../lib/fnn/types"
import { Button } from "../ui/button"
import {
  Dialog,
  DialogActions,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog"

const DISMISS_KEY_PREFIX = "fiber-studio:skip-relay-channel"

type RelayChannelPromptProps = {
  dashboard: HomeDashboardResponse | null
}

function dismissKey(network: string | null | undefined): string {
  return `${DISMISS_KEY_PREFIX}:${network?.trim() || "unknown"}`
}

function isDismissed(network: string | null | undefined): boolean {
  return sessionStorage.getItem(dismissKey(network)) === "1"
}

export function RelayChannelPrompt({ dashboard }: RelayChannelPromptProps) {
  const navigate = useNavigate()
  const network = dashboard?.network ?? null
  const [dismissed, setDismissed] = useState(() => isDismissed(network))

  useEffect(() => {
    setDismissed(isDismissed(network))
  }, [network])

  const open = Boolean(
    dashboard?.available && dashboard.needsRelayChannel && !dismissed,
  )

  function dismiss() {
    sessionStorage.setItem(dismissKey(network), "1")
    setDismissed(true)
  }

  function openChannel() {
    dismiss()
    void navigate({
      to: "/channels",
      search: { action: "open" },
    })
  }

  return (
    <Dialog open={open} onClose={dismiss} size="md">
      <DialogTitle>Open a channel with a relay</DialogTitle>
      <DialogDescription>
        You're connected to an official Fiber relay, but you don't have a
        channel with any of them yet. Open a channel with a relay so payments
        can route across the network.
      </DialogDescription>
      <DialogActions>
        <Button plain onClick={dismiss}>
          Not now
        </Button>
        <Button onClick={openChannel}>Open channel</Button>
      </DialogActions>
    </Dialog>
  )
}
