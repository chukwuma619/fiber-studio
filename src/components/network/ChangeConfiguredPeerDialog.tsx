import { useEffect, useMemo, useState } from "react"
import type { FiberNetwork } from "../../lib/public-relays"
import type { NetworkPageResponse, SetConfiguredPeerPayload } from "../../lib/fnn/types"
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

type ChangeConfiguredPeerDialogProps = {
  open: boolean
  onClose: () => void
  network: FiberNetwork
  data: NetworkPageResponse | null
  isActing: boolean
  actionError: string | null
  onSave: (payload: SetConfiguredPeerPayload) => Promise<void>
  onClearError: () => void
}

function fieldsFromData(
  network: FiberNetwork,
  data: NetworkPageResponse | null,
): ConfiguredPeerFields {
  return {
    network,
    customPublicNodePubkey: data?.configuredPeerPubkey ?? "",
    customPublicNodeMultiaddr: data?.configuredPeerMultiaddr ?? "",
  }
}

export function ChangeConfiguredPeerDialog({
  open,
  onClose,
  network,
  data,
  isActing,
  actionError,
  onSave,
  onClearError,
}: ChangeConfiguredPeerDialogProps) {
  const [fields, setFields] = useState<ConfiguredPeerFields>(() =>
    fieldsFromData(network, data),
  )

  useEffect(() => {
    if (!open) return
    setFields(fieldsFromData(network, data))
    onClearError()
  }, [data, network, onClearError, open])

  const hasChanges = useMemo(() => {
    const configuredPubkey = data?.configuredPeerPubkey?.trim() ?? ""
    const configuredMultiaddr = data?.configuredPeerMultiaddr?.trim() ?? ""
    return (
      fields.customPublicNodePubkey.trim() !== configuredPubkey ||
      fields.customPublicNodeMultiaddr.trim() !== configuredMultiaddr
    )
  }, [data, fields])

  async function handleSave() {
    const pubkey = fields.customPublicNodePubkey.trim()
    if (!pubkey) return

    await onSave({
      pubkey,
      multiaddr: fields.customPublicNodeMultiaddr.trim() || undefined,
    })
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <DialogTitle>Change primary peer</DialogTitle>
      <DialogDescription>
        Pick a public relay or enter a peer pubkey. Saving updates your primary
        peer and reconnects your node. Other connected peers stay in your peer
        list.
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
          onClick={() => void handleSave()}
          disabled={
            !fields.customPublicNodePubkey.trim() || isActing || !hasChanges
          }
        >
          {isActing ? "Saving…" : "Save & connect"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
