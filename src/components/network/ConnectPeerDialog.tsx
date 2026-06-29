import { useEffect, useState } from "react"
import type { FiberNetwork } from "../../lib/public-relays"
import type { ConnectPeerPayload } from "../../lib/fnn/types"
import {
  PublicNetworkStep,
  type ConfiguredPeerFields,
} from "../setup/steps/PublicNetworkStep"
import { Button } from "../ui/button"
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog"

type ConnectPeerDialogProps = {
  open: boolean
  onClose: () => void
  network: FiberNetwork
  isActing: boolean
  actionError: string | null
  onConnect: (payload: ConnectPeerPayload) => Promise<void>
  onClearError: () => void
}

function emptyFields(network: FiberNetwork): ConfiguredPeerFields {
  return {
    network,
    customPublicNodePubkey: "",
    customPublicNodeMultiaddr: "",
  }
}

export function ConnectPeerDialog({
  open,
  onClose,
  network,
  isActing,
  actionError,
  onConnect,
  onClearError,
}: ConnectPeerDialogProps) {
  const [fields, setFields] = useState<ConfiguredPeerFields>(() =>
    emptyFields(network),
  )

  useEffect(() => {
    if (!open) return
    setFields(emptyFields(network))
    onClearError()
  }, [network, onClearError, open])

  async function handleConnect() {
    const pubkey = fields.customPublicNodePubkey.trim()
    if (!pubkey) return

    try {
      await onConnect({
        pubkey,
        multiaddr: fields.customPublicNodeMultiaddr.trim() || undefined,
      })
      onClose()
    } catch {
      // Keep dialog open; actionError is set by the hook.
    }
  }

  return (
    <Dialog open={open} onClose={isActing ? () => {} : onClose} size="lg">
      <DialogTitle>Add saved peer</DialogTitle>
      <DialogDescription>
        Pick a public relay or enter a peer pubkey. This saves the peer and
        connects immediately. Saved peers reconnect automatically when your
        node starts.
      </DialogDescription>
      <DialogBody>
        {actionError ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {actionError}
          </div>
        ) : null}

        <PublicNetworkStep
          hideHeading
          config={fields}
          onChange={(patch) => setFields((current) => ({ ...current, ...patch }))}
        />
      </DialogBody>
      <DialogActions>
        <Button outline onClick={onClose} disabled={isActing}>
          Cancel
        </Button>
        <Button
          onClick={() => void handleConnect()}
          disabled={!fields.customPublicNodePubkey.trim() || isActing}
        >
          {isActing ? "Connecting…" : "Add & connect"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
