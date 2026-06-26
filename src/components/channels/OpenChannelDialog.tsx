import { useEffect, useMemo, useState } from "react"
import {
  CHANNEL_OPEN_FEE_BUFFER_CKB,
  CHANNEL_RESERVE_CKB,
  requiredWalletCkbForOpen,
} from "../../lib/fnn/format"
import { formatRelayStatusLabel } from "../../lib/fnn/relay"
import type { OpenChannelPayload, OpenChannelResult, RelayConnectionStatus } from "../../lib/fnn/types"
import { truncatePubkey } from "../../lib/public-relays"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { CopyButton } from "../ui/copy-button"
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
  configuredPeerPubkey: string | null
  relayStatus: RelayConnectionStatus
  minFundingCkb: number
  hasChannelToConfiguredPeer: boolean
  availableWalletCkb: number | null
  onChainWalletError: string | null
  isActing: boolean
  actionError: string | null
  onOpenChannel: (payload: OpenChannelPayload) => Promise<OpenChannelResult>
  onClearError: () => void
  onSuccess: (result: OpenChannelResult) => void
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

function relayStatusBadgeColor(
  status: RelayConnectionStatus,
): "green" | "amber" | "red" | "zinc" {
  switch (status) {
    case "connected":
      return "green"
    case "connecting":
      return "amber"
    case "failed":
      return "red"
    case "not_configured":
      return "zinc"
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

function openButtonLabel(
  isActing: boolean,
  relayStatus: RelayConnectionStatus,
): string {
  if (!isActing) return "Open channel"
  if (relayStatus !== "connected") {
    return "Connecting to peer…"
  }
  return "Opening channel…"
}

export function OpenChannelDialog({
  open,
  onClose,
  configuredPeerPubkey,
  relayStatus,
  minFundingCkb,
  hasChannelToConfiguredPeer,
  availableWalletCkb,
  onChainWalletError,
  isActing,
  actionError,
  onOpenChannel,
  onClearError,
  onSuccess,
}: OpenChannelDialogProps) {
  const peerPubkey = configuredPeerPubkey?.trim() ?? ""

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
    parsedCapacity !== null && parsedCapacity < minFundingCkb

  const requiredWalletCkb =
    parsedCapacity !== null ? requiredWalletCkbForOpen(parsedCapacity) : null

  const insufficientWalletBalance =
    availableWalletCkb !== null &&
    requiredWalletCkb !== null &&
    availableWalletCkb < requiredWalletCkb

  const walletBalanceUnavailable = onChainWalletError !== null
  const peerNotConnected = relayStatus !== "connected"

  const submitDisabled =
    isActing ||
    !peerPubkey ||
    peerNotConnected ||
    hasChannelToConfiguredPeer ||
    walletBalanceUnavailable ||
    belowMinimum === true ||
    insufficientWalletBalance === true

  useEffect(() => {
    if (!open) return

    setValidationError(null)
    onClearError()
    setCapacity(peerPubkey ? String(minFundingCkb) : "")
  }, [minFundingCkb, onClearError, open, peerPubkey])

  async function handleSubmit() {
    if (!peerPubkey) {
      setValidationError("No peer pubkey configured in setup.")
      return
    }

    if (hasChannelToConfiguredPeer) {
      setValidationError(
        "A channel to this peer is already active or opening.",
      )
      return
    }

    if (walletBalanceUnavailable) {
      setValidationError(
        "Could not read on-chain wallet balance. Refresh the page and try again.",
      )
      return
    }

    const fundingCkb = parseFundingCkb(capacity, minFundingCkb)
    if (fundingCkb === null) {
      setValidationError(
        `Enter a whole number of at least ${minFundingCkb} CKB.`,
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
      const result = await onOpenChannel({ fundingCkb })
      onSuccess(result)
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
          ? "Open a public channel with your configured peer for multi-hop routing."
          : "Complete setup with a public relay or custom node before opening a channel."}
      </DialogDescription>

      <DialogBody>
        <FieldGroup>
          <Field>
            <Label>Peer pubkey</Label>
            {peerPubkey ? (
              <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
                <span
                  className="min-w-0 flex-1 font-mono text-xs break-all text-zinc-700 dark:text-zinc-300"
                  title={peerPubkey}
                >
                  {truncatePubkey(peerPubkey)}
                </span>
                <CopyButton value={peerPubkey} label="Copy peer pubkey" />
              </div>
            ) : (
              <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                Not configured
              </Text>
            )}
            <Description>
              Read from your setup configuration (studio metadata).
            </Description>
          </Field>

          {peerPubkey ? (
            <Field>
              <Label>Peer connection</Label>
              <div className="flex items-center gap-2">
                <Badge color={relayStatusBadgeColor(relayStatus)}>
                  {formatRelayStatusLabel(relayStatus)}
                </Badge>
                {relayStatus !== "connected" && !isActing ? (
                  <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                    {relayStatus === "connecting"
                      ? "Waiting for the peer connection before a channel can be opened."
                      : "Connect to the peer first — restart the node or try another public relay in setup."}
                  </Text>
                ) : null}
              </div>
            </Field>
          ) : null}

          <Field>
            <Label>Channel capacity (CKB)</Label>
            <Input
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
              inputMode="numeric"
              placeholder={String(minFundingCkb)}
              disabled={!peerPubkey || hasChannelToConfiguredPeer}
            />
            <Description>
              Minimum {minFundingCkb} CKB to open a channel.
            </Description>
          </Field>
        </FieldGroup>

        {peerNotConnected && peerPubkey ? (
          <Text className="mt-4 text-sm text-amber-700 dark:text-amber-300">
            {relayStatus === "connecting"
              ? "Peer connection is still in progress. Wait until the status shows Connected to peer."
              : "Peer is not connected. Restart your node or switch to another public relay (e.g. node2) in setup."}
          </Text>
        ) : null}
        {hasChannelToConfiguredPeer ? (
          <Text className="mt-4 text-sm text-amber-700 dark:text-amber-300">
            You already have an active or opening channel with this peer. Close
            or abandon it before opening another.
          </Text>
        ) : null}
        {walletBalanceUnavailable ? (
          <Text className="mt-4 text-sm text-amber-700 dark:text-amber-300">
            Could not read on-chain wallet balance. Check your network connection
            and refresh before opening a channel.
          </Text>
        ) : null}
        {insufficientWalletBalance && requiredWalletCkb !== null ? (
          <Text className="mt-4 text-sm text-amber-700 dark:text-amber-300">
            On-chain wallet has {availableWalletCkb} CKB but this open needs at
            least {requiredWalletCkb} CKB. Check the balance card above.
          </Text>
        ) : null}
        {belowMinimum ? (
          <Text className="mt-4 text-sm text-amber-700 dark:text-amber-300">
            {minFundingCkb} CKB is the minimum channel capacity.
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
          disabled={submitDisabled}
        >
          {openButtonLabel(isActing, relayStatus)}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
