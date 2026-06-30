import { useEffect, useMemo, useState } from "react"
import {
  NETWORK_OPTIONS,
  switchTargetNetworks,
} from "../../lib/setup/network"
import type { NetworkChoice } from "../../lib/setup/types"
import type { SwitchNetworkPayload } from "../../lib/fnn/types"
import { getRelay } from "../../lib/public-relays"
import { formatNetworkLabel } from "../../lib/fnn/useNodeControl"
import { Field, Label } from "../ui/fieldset"
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
import { SelectionCard } from "../setup/SelectionCard"

type ChangeNetworkDialogProps = {
  open: boolean
  onClose: () => void
  currentNetwork: NetworkChoice
  currentDataDirectory: string
  isActing: boolean
  onSave: (payload: SwitchNetworkPayload) => Promise<void>
}

export function ChangeNetworkDialog({
  open,
  onClose,
  currentNetwork,
  currentDataDirectory,
  isActing,
  onSave,
}: ChangeNetworkDialogProps) {
  const targetOptions = useMemo(
    () =>
      NETWORK_OPTIONS.filter((option) =>
        switchTargetNetworks(currentNetwork).includes(option.value),
      ),
    [currentNetwork],
  )

  const [network, setNetwork] = useState<NetworkChoice>(
    targetOptions[0]?.value ?? "testnet",
  )
  const [newDataDirectory, setNewDataDirectory] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const firstTarget = switchTargetNetworks(currentNetwork)[0] ?? "testnet"
    setNetwork(firstTarget)
    setNewDataDirectory(`${currentDataDirectory}-${firstTarget}`)
    setError(null)
  }, [currentDataDirectory, currentNetwork, open])

  useEffect(() => {
    if (!open) return
    setNewDataDirectory(`${currentDataDirectory}-${network}`)
  }, [currentDataDirectory, network, open])

  async function handleConfirm() {
    setError(null)
    const trimmedDir = newDataDirectory.trim()
    if (!trimmedDir) {
      setError("New data directory is required.")
      return
    }
    if (trimmedDir === currentDataDirectory.trim()) {
      setError("Choose a different folder for the new network.")
      return
    }
    if (network === currentNetwork) {
      setError("Pick a different network than your current one.")
      return
    }

    const node1 = getRelay(network, "node1")

    try {
      await onSave({
        network,
        newDataDirectory: trimmedDir,
        customPublicNodePubkey: node1.pubkey,
        customPublicNodeMultiaddr: node1.multiaddr ?? "",
        copyKeyFromCurrent: true,
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }

  if (targetOptions.length === 0) {
    return null
  }

  return (
    <Dialog open={open} onClose={isActing ? () => {} : onClose} size="lg">
      <DialogTitle>
        Switch from {formatNetworkLabel(currentNetwork)}
      </DialogTitle>
      <DialogDescription>
        Provisions a fresh data folder for the new network. Your existing
        channels and data stay in the current directory.
      </DialogDescription>
      <DialogBody>
        <div className="space-y-5">
          <Text className="text-sm text-amber-700 dark:text-amber-400">
            This copies your CKB key, writes a new config, and does not move
            channel state. Configure peers on the Network page after you start
            the node.
          </Text>

          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-950 dark:text-white">
              Target network
            </p>
            <div className="grid gap-3" role="radiogroup" aria-label="Target network">
              {targetOptions.map((option) => (
                <SelectionCard
                  key={option.value}
                  role="radio"
                  selected={network === option.value}
                  onClick={() => setNetwork(option.value)}
                  title={option.label}
                  description={option.description}
                />
              ))}
            </div>
          </div>

          <Field>
            <Label>New data directory</Label>
            <Input
              value={newDataDirectory}
              onChange={(event) => setNewDataDirectory(event.target.value)}
              className="font-mono text-xs"
              data-invalid={error ? true : undefined}
            />
            <Text className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Must be a different path from your current folder.
            </Text>
          </Field>

          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}
        </div>
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose} disabled={isActing}>
          Cancel
        </Button>
        <Button onClick={() => void handleConfirm()} disabled={isActing}>
          {isActing ? "Switching…" : "Switch network"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
