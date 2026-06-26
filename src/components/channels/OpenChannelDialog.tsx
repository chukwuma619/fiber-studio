import { useEffect, useMemo, useState } from "react"
import type { SetupConfig } from "../../lib/setup/types"
import { FIBER_MIN_CHANNEL_FUNDING_CKB } from "../../lib/public-relays"
import { getPeerOpenChannelPolicy } from "../../lib/fnn/invoke"
import type { OpenChannelPayload, PeerOpenChannelPolicy } from "../../lib/fnn/types"
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
  isActing,
  actionError,
  onOpenChannel,
  onClearError,
}: OpenChannelDialogProps) {
  const peerPubkey = config?.customPublicNodePubkey?.trim() ?? ""

  const [capacity, setCapacity] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)
  const [policy, setPolicy] = useState<PeerOpenChannelPolicy | null>(null)
  const [policyLoading, setPolicyLoading] = useState(false)
  const [policyError, setPolicyError] = useState<string | null>(null)

  const effectiveMinimumCkb =
    policy?.known && policy.minFundingCkb !== null
      ? policy.minFundingCkb
      : FIBER_MIN_CHANNEL_FUNDING_CKB

  const parsedCapacity = useMemo(() => {
    const trimmed = capacity.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null
    return parsed
  }, [capacity])

  const belowPeerMinimum =
    policy?.known &&
    policy.minFundingCkb !== null &&
    parsedCapacity !== null &&
    parsedCapacity < policy.minFundingCkb

  useEffect(() => {
    if (!open) return

    setValidationError(null)
    setPolicy(null)
    setPolicyError(null)
    onClearError()

    if (!peerPubkey) {
      setCapacity("")
      return
    }

    let cancelled = false
    setPolicyLoading(true)

    void getPeerOpenChannelPolicy(peerPubkey)
      .then((nextPolicy) => {
        if (cancelled) return
        setPolicy(nextPolicy)
        setCapacity(String(nextPolicy.recommendedFundingCkb))
      })
      .catch((error) => {
        if (cancelled) return
        setPolicyError(error instanceof Error ? error.message : String(error))
        setCapacity(String(FIBER_MIN_CHANNEL_FUNDING_CKB))
      })
      .finally(() => {
        if (!cancelled) {
          setPolicyLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [onClearError, open, peerPubkey])

  async function handleSubmit() {
    if (!peerPubkey) {
      setValidationError("No peer pubkey configured in setup.")
      return
    }

    if (policyLoading) {
      return
    }

    const fundingCkb = parseFundingCkb(capacity, effectiveMinimumCkb)
    if (fundingCkb === null) {
      if (
        policy?.known &&
        policy.minFundingCkb !== null &&
        parsedCapacity !== null &&
        parsedCapacity < policy.minFundingCkb
      ) {
        setValidationError(
          `This peer requires at least ${policy.minFundingCkb} CKB to auto-accept a channel.`,
        )
        return
      }

      setValidationError(
        `Enter a whole number of at least ${effectiveMinimumCkb} CKB.`,
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

  const policyDescription = (() => {
    if (policyLoading) {
      return "Looking up auto-accept minimum from the network graph…"
    }

    if (policy?.known && policy.minFundingCkb !== null) {
      return `Auto-accept requires at least ${policy.minFundingCkb} CKB.`
    }

    if (policyError) {
      return `Could not read peer policy (${policyError}). Use at least ${FIBER_MIN_CHANNEL_FUNDING_CKB} CKB.`
    }

    if (policy && !policy.known) {
      return `Peer policy not in the network graph yet. Use at least ${FIBER_MIN_CHANNEL_FUNDING_CKB} CKB.`
    }

    return `Minimum ${FIBER_MIN_CHANNEL_FUNDING_CKB} CKB to open a channel.`
  })()

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
              placeholder={
                policy
                  ? String(policy.recommendedFundingCkb)
                  : String(FIBER_MIN_CHANNEL_FUNDING_CKB)
              }
              disabled={policyLoading || !peerPubkey}
            />
            <Description>{policyDescription}</Description>
          </Field>
        </FieldGroup>

        {belowPeerMinimum ? (
          <Text className="mt-4 text-sm text-amber-700 dark:text-amber-300">
            {policy?.minFundingCkb} CKB is required for auto-accept. Lower
            amounts can leave the channel stuck opening until the peer manually
            accepts or it times out.
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
            policyLoading ||
            belowPeerMinimum === true
          }
        >
          {isActing ? "Opening…" : "Open channel"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
