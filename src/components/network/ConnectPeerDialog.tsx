import { useEffect, useState } from "react"
import {
  EXAMPLE_CUSTOM_PUBLIC_NODES,
  type FiberNetwork,
} from "../../lib/public-relays"
import type { ConnectPeerPayload } from "../../lib/fnn/types"
import { ConnectPeerForm } from "../connect/ConnectPeerForm"
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

export function ConnectPeerDialog({
  open,
  onClose,
  network,
  isActing,
  actionError,
  onConnect,
  onClearError,
}: ConnectPeerDialogProps) {
  const [pubkey, setPubkey] = useState("")
  const [multiaddr, setMultiaddr] = useState("")

  useEffect(() => {
    if (!open) {
      setPubkey("")
      setMultiaddr("")
      onClearError()
    }
  }, [onClearError, open])

  async function handleConnect() {
    const trimmedPubkey = pubkey.trim()
    if (!trimmedPubkey) return

    await onConnect({
      pubkey: trimmedPubkey,
      multiaddr: multiaddr.trim() || undefined,
    })
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Connect to peer</DialogTitle>
      <DialogDescription>
        Add an optional direct peer connection. This does not change your
        configured relay.
      </DialogDescription>
      <DialogBody>
        {actionError ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {actionError}
          </div>
        ) : null}

        <ConnectPeerForm
          network={network}
          publicConnectionMode="custom-public-node"
          pubkey={pubkey}
          multiaddr={multiaddr}
          onPubkeyChange={setPubkey}
          onMultiaddrChange={setMultiaddr}
          customPubkeyExample={EXAMPLE_CUSTOM_PUBLIC_NODES[network]}
        />
      </DialogBody>
      <DialogActions>
        <Button outline onClick={onClose} disabled={isActing}>
          Cancel
        </Button>
        <Button onClick={() => void handleConnect()} disabled={!pubkey.trim() || isActing}>
          {isActing ? "Connecting…" : "Connect"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
