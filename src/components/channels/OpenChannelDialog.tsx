import { useEffect, useMemo, useState } from "react"
import {
  CHANNEL_OPEN_FEE_BUFFER_CKB,
  CHANNEL_RESERVE_CKB,
  requiredWalletCkbForOpen,
} from "../../lib/fnn/format"
import { formatRelayStatusLabel } from "../../lib/fnn/relay"
import type {
  OpenChannelPayload,
  RelayConnectionStatus,
  SavedPeerEntry,
} from "../../lib/fnn/types"
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
import { Select } from "../ui/select"
import { Text } from "../ui/text"

type OpenChannelDialogProps = {
  open: boolean
  onClose: () => void
  savedPeers: SavedPeerEntry[]
  relayStatus: RelayConnectionStatus
  minFundingCkb: number
  availableWalletCkb: number | null
  onChainWalletError: string | null
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

function firstOpenablePeer(savedPeers: SavedPeerEntry[]): string {
  return (
    savedPeers.find((peer) => !peer.hasActiveOrPendingChannel)?.pubkey ?? ""
  )
}

export function OpenChannelDialog({
  open,
  onClose,
  savedPeers,
  relayStatus,
  minFundingCkb,
  availableWalletCkb,
  onChainWalletError,
  isActing,
  actionError,
  onOpenChannel,
  onClearError,
}: OpenChannelDialogProps) {
  const [selectedPubkey, setSelectedPubkey] = useState("")
  const [capacity, setCapacity] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)

  const selectedPeer = useMemo(
    () => savedPeers.find((peer) => peer.pubkey === selectedPubkey) ?? null,
    [savedPeers, selectedPubkey],
  )

  const openablePeers = useMemo(
    () => savedPeers.filter((peer) => !peer.hasActiveOrPendingChannel),
    [savedPeers],
  )

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
  const noSavedPeers = savedPeers.length === 0
  const noOpenablePeers = openablePeers.length === 0
  const selectedHasChannel = selectedPeer?.hasActiveOrPendingChannel ?? false
  const peerNotConnected = selectedPeer ? !selectedPeer.connected : true

  const submitDisabled =
    isActing ||
    !selectedPubkey ||
    selectedHasChannel ||
    peerNotConnected ||
    noSavedPeers ||
    noOpenablePeers ||
    walletBalanceUnavailable ||
    belowMinimum === true ||
    insufficientWalletBalance === true

  useEffect(() => {
    if (!open) return

    setValidationError(null)
    onClearError()
    const defaultPeer = firstOpenablePeer(savedPeers)
    setSelectedPubkey(defaultPeer)
    setCapacity(defaultPeer ? String(minFundingCkb) : "")
  }, [minFundingCkb, onClearError, open, savedPeers])

  async function handleSubmit() {
    if (!selectedPubkey) {
      setValidationError("Select a saved peer to open a channel with.")
      return
    }

    if (selectedHasChannel) {
      setValidationError(
        "This saved peer already has an active or opening channel.",
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
      await onOpenChannel({ pubkey: selectedPubkey, fundingCkb })
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
        {noSavedPeers
          ? "Add at least one saved peer on the Network page before opening a channel."
          : noOpenablePeers
            ? "Every saved peer already has an active or opening channel. Add another saved peer on the Network page to open a new one."
            : "Open a public channel with one of your saved peers."}
      </DialogDescription>

      <DialogBody>
        <FieldGroup>
          <Field>
            <Label>Saved peer</Label>
            {noSavedPeers ? (
              <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                No saved peers configured.
              </Text>
            ) : (
              <Select
                value={selectedPubkey}
                onChange={(event) => setSelectedPubkey(event.target.value)}
                disabled={isActing}
              >
                {savedPeers.map((peer) => (
                  <option
                    key={peer.pubkey}
                    value={peer.pubkey}
                    disabled={peer.hasActiveOrPendingChannel}
                  >
                    {truncatePubkey(peer.pubkey)}
                    {peer.hasActiveOrPendingChannel
                      ? " (channel exists)"
                      : peer.connected
                        ? ""
                        : " (not connected)"}
                  </option>
                ))}
              </Select>
            )}
            {selectedPubkey ? (
              <div className="mt-2 flex items-center gap-2">
                <span
                  className="min-w-0 flex-1 font-mono text-xs break-all text-zinc-600 dark:text-zinc-300"
                  title={selectedPubkey}
                >
                  {selectedPubkey}
                </span>
                <CopyButton value={selectedPubkey} label="Copy peer pubkey" />
              </div>
            ) : null}
            <Description>
              All saved peers are listed. Peers that already have a channel are
              disabled.
            </Description>
          </Field>

          {selectedPeer ? (
            <Field>
              <Label>Peer connection</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  color={relayStatusBadgeColor(
                    selectedPeer.connected ? "connected" : relayStatus,
                  )}
                >
                  {selectedPeer.connected
                    ? "Connected"
                    : formatRelayStatusLabel(relayStatus)}
                </Badge>
                {selectedPeer.hasActiveOrPendingChannel ? (
                  <Badge color="zinc">Channel exists</Badge>
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
              disabled={!selectedPubkey || noOpenablePeers}
            />
            <Description>
              Minimum {minFundingCkb} CKB to open a channel.
            </Description>
          </Field>
        </FieldGroup>

        {selectedHasChannel ? (
          <Text className="mt-4 text-sm text-amber-700 dark:text-amber-300">
            This peer already has a channel. Pick another saved peer or add one
            on the Network page.
          </Text>
        ) : null}
        {peerNotConnected && selectedPubkey && !selectedHasChannel ? (
          <Text className="mt-4 text-sm text-amber-700 dark:text-amber-300">
            {relayStatus === "connecting"
              ? "Saved peer connection is still in progress. Wait until the peer shows as connected."
              : "Selected peer is not connected. Restart your node or check the Network page."}
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
