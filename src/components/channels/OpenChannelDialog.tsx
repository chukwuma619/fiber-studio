import { useEffect, useMemo, useState } from "react"
import type { SetupConfig } from "../../lib/setup/types"
import { CHANNEL_OPEN_MIN_FUNDING_CKB } from "../../lib/public-relays"
import {
  CHANNEL_OPEN_FEE_BUFFER_CKB,
  CHANNEL_RESERVE_CKB,
  requiredWalletCkbForOpen,
} from "../../lib/fnn/format"
import type { OpenChannelPayload } from "../../lib/fnn/types"
import { Button } from "../ui/button"
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog"
import { Description, Field, FieldGroup, Label } from "../ui/fieldset"
import { Input } from "../ui/input"
import { Text } from "../ui/text"

type OpenChannelDialogProps = {
  open: boolean
  onClose: () => void
  config: SetupConfig | null
  availableWalletCkb: number | null
  isActing: boolean
  actionError: string | null
  onOpenChannel: (payload: OpenChannelPayload) => Promise<void>
  onClearError: () => void
}

function parseFundingCkb(value: string, minimumCkb: number): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (
    !Number.isFinite(parsed) ||
    parsed < minimumCkb ||
    !Number.isInteger(parsed)
  ) {
    return null
  }
  return parsed
}

export function OpenChannelDialog({
  open,
  onClose,
  config,
  availableWalletCkb,
  isActing,
  actionError,
  onOpenChannel,
  onClearError,
}: OpenChannelDialogProps) {
  const peerPubkey = config?.customPublicNodePubkey?.trim() ?? ""

  const [capacity, setCapacity] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)

  const parsedCapacity = useMemo(() => {
    const trimmed = capacity.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null
    return parsed
  }, [capacity])

  const belowMinimum =
    parsedCapacity !== null && parsedCapacity < CHANNEL_OPEN_MIN_FUNDING_CKB

  const requiredWalletCkb =
    parsedCapacity !== null ? requiredWalletCkbForOpen(parsedCapacity) : null

  const insufficientWalletBalance =
    availableWalletCkb !== null &&
    requiredWalletCkb !== null &&
    availableWalletCkb < requiredWalletCkb

  useEffect(() => {
    if (!open) return

    setValidationError(null)
    onClearError()
    setCapacity(peerPubkey ? String(CHANNEL_OPEN_MIN_FUNDING_CKB) : "")
  }, [onClearError, open, peerPubkey])

  async function handleSubmit() {
    if (!peerPubkey) {
      setValidationError("No peer pubkey configured in setup.")
      return
    }

    const fundingCkb = parseFundingCkb(capacity, CHANNEL_OPEN_MIN_FUNDING_CKB)
    if (fundingCkb === null) {
      setValidationError(
        `Enter a whole number of at least ${CHANNEL_OPEN_MIN_FUNDING_CKB} CKB.`,
      )
      return
    }

    if (
      availableWalletCkb !== null &&
      availableWalletCkb < requiredWalletCkbForOpen(fundingCkb)
    ) {
      const required = requiredWalletCkbForOpen(fundingCkb)
      setValidationError(
        `Insufficient on-chain CKB. Need at least ${required} CKB (${fundingCkb} funding + ${CHANNEL_RESERVE_CKB} reserve + ${CHANNEL_OPEN_FEE_BUFFER_CKB} fee buffer) but wallet has ${availableWalletCkb} CKB.`,
      )
      return
    }

    setValidationError(null)

    try {
      await onOpenChannel({ pubkey: peerPubkey, fundingCkb, isPublic: true })
      onClose()
    } catch {
      // actionError is set by the hook
    }
  }

  return (
    <Dialog
      open={open}
      onClose={isActing ? () => {} : onClose}
      size="lg"
    >
      <DialogTitle>Open channel</DialogTitle>
      <DialogDescription>
        {peerPubkey
          ? "Open a public channel for multi-hop routing."
          : "Configure a peer pubkey in setup before opening a channel."}
      </DialogDescription>

      <DialogBody>
        <FieldGroup>
          <Field>
            <Label>Channel capacity (CKB)</Label>
            <Input
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
              inputMode="numeric"
              placeholder={String(CHANNEL_OPEN_MIN_FUNDING_CKB)}
              disabled={!peerPubkey}
            />
            <Description>
              Minimum {CHANNEL_OPEN_MIN_FUNDING_CKB} CKB to open a channel.
            </Description>
          </Field>
        </FieldGroup>

        {insufficientWalletBalance && requiredWalletCkb !== null ? (
          <Text className="mt-4 text-sm text-amber-700 dark:text-amber-300">
            On-chain wallet has {availableWalletCkb} CKB but this open needs at
            least {requiredWalletCkb} CKB. Check the balance card above.
          </Text>
        ) : null}
        {belowMinimum ? (
          <Text className="mt-4 text-sm text-amber-700 dark:text-amber-300">
            {CHANNEL_OPEN_MIN_FUNDING_CKB} CKB is the minimum channel capacity.
          </Text>
        ) : null}
        {validationError ? (
          <Text className="mt-4 text-sm text-red-600 dark:text-red-400">
            {validationError}
          </Text>
        ) : null}
        {actionError ? (
          <Text className="mt-4 text-sm text-red-600 dark:text-red-400">
            {actionError}
          </Text>
        ) : null}
      </DialogBody>

      <DialogActions>
        <Button plain onClick={onClose} disabled={isActing}>
          Cancel
        </Button>
        <Button
          onClick={() => void handleSubmit()}
          disabled={
            isActing ||
            !peerPubkey ||
            belowMinimum === true ||
            insufficientWalletBalance === true
          }
        >
          {isActing ? "Opening…" : "Open channel"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
