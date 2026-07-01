import { useEffect, useMemo, useState } from "react"
import { validateCkbPrivateKey } from "../../lib/ckb-key"
import {
  getDataDirectoryDisplayForNetwork,
  resolveDataDirectoryForNetwork,
} from "../../lib/data-directory"
import { isNetworkProvisioned } from "../../lib/fnn/invoke"
import {
  NETWORK_OPTIONS,
  switchTargetNetworks,
} from "../../lib/setup/network"
import type { NetworkChoice } from "../../lib/setup/types"
import type { SwitchNetworkPayload } from "../../lib/fnn/types"
import { getRelay } from "../../lib/public-relays"
import { formatNetworkLabel } from "../../lib/fnn/useNodeControl"
import { Button } from "../ui/button"
import { Checkbox, CheckboxField } from "../ui/checkbox"
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog"
import { ErrorMessage, Field, Label } from "../ui/fieldset"
import { Input } from "../ui/input"
import { Text } from "../ui/text"
import { SelectionCard } from "../setup/SelectionCard"

type ChangeNetworkDialogProps = {
  open: boolean
  onClose: () => void
  currentNetwork: NetworkChoice
  isActing: boolean
  onSave: (payload: SwitchNetworkPayload) => Promise<void>
}

export function ChangeNetworkDialog({
  open,
  onClose,
  currentNetwork,
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
  const [targetDataDirectory, setTargetDataDirectory] = useState("")
  const [targetProvisioned, setTargetProvisioned] = useState(true)
  const [importedPrivateKey, setImportedPrivateKey] = useState("")
  const [copyKeyFromCurrent, setCopyKeyFromCurrent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const firstTarget = switchTargetNetworks(currentNetwork)[0] ?? "testnet"
    setNetwork(firstTarget)
    setImportedPrivateKey("")
    setCopyKeyFromCurrent(false)
    setError(null)
    void resolveDataDirectoryForNetwork(firstTarget).then(setTargetDataDirectory)
    void isNetworkProvisioned(firstTarget).then(setTargetProvisioned)
  }, [currentNetwork, open])

  useEffect(() => {
    if (!open) return
    void resolveDataDirectoryForNetwork(network).then(setTargetDataDirectory)
    void isNetworkProvisioned(network).then(setTargetProvisioned)
  }, [network, open])

  const needsKeySetup = !targetProvisioned
  const keyError =
    needsKeySetup && !copyKeyFromCurrent
      ? validateCkbPrivateKey(importedPrivateKey)
      : null

  async function handleConfirm() {
    setError(null)
    if (network === currentNetwork) {
      setError("Pick a different network than your current one.")
      return
    }

    if (needsKeySetup && !copyKeyFromCurrent) {
      if (!importedPrivateKey.trim()) {
        setError("Private key is required.")
        return
      }
      const validationError = validateCkbPrivateKey(importedPrivateKey)
      if (validationError) {
        setError(validationError)
        return
      }
    }

    const node1 = getRelay(network, "node1")

    try {
      await onSave({
        network,
        customPublicNodePubkey: node1.pubkey,
        customPublicNodeMultiaddr: node1.multiaddr ?? "",
        copyKeyFromCurrent: needsKeySetup && copyKeyFromCurrent,
        importedPrivateKey:
          needsKeySetup && !copyKeyFromCurrent
            ? importedPrivateKey
            : undefined,
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
        Switches to the dedicated data folder for the other network. Your
        existing channels and data stay in the current network folder.
      </DialogDescription>
      <DialogBody>
        <div className="space-y-5">
          
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

          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-950 dark:text-white">
              Data directory
            </p>
            <p className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
              {targetDataDirectory ||
                getDataDirectoryDisplayForNetwork(network)}
            </p>
          </div>

          {needsKeySetup ? (
            <div className="space-y-4">
              <CheckboxField>
                <Checkbox
                  checked={copyKeyFromCurrent}
                  onChange={setCopyKeyFromCurrent}
                  color="dark/zinc"
                />
                <Label>Use the same CKB key as my current network</Label>
              </CheckboxField>
              {copyKeyFromCurrent ? (
                <Text className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Reuses your current wallet on the other network. Mainnet and
                  testnet data stay in separate folders, but the on-chain address
                  will be the same.
                </Text>
              ) : null}

              {!copyKeyFromCurrent ? (
                <Field>
                  <Label>CKB private key (hex)</Label>
                  <Input
                    type="password"
                    value={importedPrivateKey}
                    onChange={(event) => setImportedPrivateKey(event.target.value)}
                    placeholder="64 hex characters (optional 0x prefix)"
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono text-xs"
                    data-invalid={keyError ? true : undefined}
                  />
                  {keyError ? <ErrorMessage>{keyError}</ErrorMessage> : null}
                </Field>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}
        </div>
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose} disabled={isActing}>
          Cancel
        </Button>
        <Button
          onClick={() => void handleConfirm()}
          disabled={isActing}
        >
          {isActing ? "Switching…" : "Switch network"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
