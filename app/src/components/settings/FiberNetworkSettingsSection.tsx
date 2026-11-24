import { useEffect, useState } from "react"
import { pubkeysEqual } from "../../lib/fnn/relay"
import type { NodeSettingsResponse } from "../../lib/fnn/types"
import { truncatePubkey } from "../../lib/public-relays"
import { Button } from "../ui/button"
import { Description, Field, FieldGroup, Label } from "../ui/fieldset"
import { Input } from "../ui/input"
import { Select } from "../ui/select"
import { Switch, SwitchField } from "../ui/switch"
import { Text } from "../ui/text"
import { Textarea } from "../ui/textarea"
import { SettingsRow, SettingsRows, SettingsSection } from "./SettingsSection"

const JIT_PEER_OFF = "off"
const JIT_PEER_OTHER = "other"

function jitPeerChoice(pubkey: string, peers: string[]): string {
  const trimmed = pubkey.trim()
  if (!trimmed) return JIT_PEER_OFF
  return peers.find((peer) => pubkeysEqual(peer, trimmed)) ?? JIT_PEER_OTHER
}

type FiberNetworkSettingsSectionProps = {
  settings: NodeSettingsResponse
  nodeStopped: boolean
  isActing: boolean
  onUpdateStoreSyncWrites: (enabled: boolean) => Promise<unknown>
  onUpdateJitReceiver: (
    lspPubkey: string,
    maxAmountCkb: string,
    maxOpenFeeCkb: string,
  ) => Promise<unknown>
  onUpdateListeningAddrs: (listeningAddrs: string[]) => Promise<unknown>
}

export function FiberNetworkSettingsSection({
  settings,
  nodeStopped,
  isActing,
  onUpdateStoreSyncWrites,
  onUpdateJitReceiver,
  onUpdateListeningAddrs,
}: FiberNetworkSettingsSectionProps) {
  const [addrsText, setAddrsText] = useState(
    settings.fiberListeningAddrs.join("\n"),
  )
  const savedPeerPubkeys = settings.jitPeerPubkeys ?? []
  const [peerChoice, setPeerChoice] = useState(() =>
    jitPeerChoice(settings.jitLspPubkey ?? "", savedPeerPubkeys),
  )
  const [otherPubkey, setOtherPubkey] = useState("")
  const [lspPubkey, setLspPubkey] = useState(settings.jitLspPubkey ?? "")
  const [maxAmountCkb, setMaxAmountCkb] = useState(settings.jitMaxAmountCkb ?? "")
  const [maxOpenFeeCkb, setMaxOpenFeeCkb] = useState(
    settings.jitMaxOpenFeeCkb ?? "",
  )
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setAddrsText(settings.fiberListeningAddrs.join("\n"))
  }, [settings.fiberListeningAddrs])

  useEffect(() => {
    const pubkey = settings.jitLspPubkey ?? ""
    const peers = settings.jitPeerPubkeys ?? []
    const choice = jitPeerChoice(pubkey, peers)
    setPeerChoice(choice)
    setOtherPubkey(choice === JIT_PEER_OTHER ? pubkey : "")
    setLspPubkey(pubkey)
    setMaxAmountCkb(settings.jitMaxAmountCkb ?? "")
    setMaxOpenFeeCkb(settings.jitMaxOpenFeeCkb ?? "")
  }, [
    settings.jitLspPubkey,
    settings.jitMaxAmountCkb,
    settings.jitMaxOpenFeeCkb,
    settings.jitPeerPubkeys,
  ])

  const choosePeer = (choice: string) => {
    setPeerChoice(choice)
    if (choice === JIT_PEER_OFF) {
      setLspPubkey("")
      return
    }
    if (choice === JIT_PEER_OTHER) {
      setLspPubkey(otherPubkey)
      return
    }
    setLspPubkey(choice)
  }

  const parsedAddrs = addrsText
    .split(/[\n,]+/)
    .map((addr) => addr.trim())
    .filter(Boolean)

  const addrsDirty =
    parsedAddrs.join("\n") !== settings.fiberListeningAddrs.join("\n")

  const jitDirty =
    lspPubkey.trim() !== (settings.jitLspPubkey ?? "") ||
    maxAmountCkb.trim() !== (settings.jitMaxAmountCkb ?? "") ||
    maxOpenFeeCkb.trim() !== (settings.jitMaxOpenFeeCkb ?? "")

  const handleSaveJit = async () => {
    setLocalError(null)
    const pubkey = lspPubkey.trim()
    if (peerChoice === JIT_PEER_OTHER && !pubkey) {
      setLocalError(
        "Paste the liquidity node pubkey, or choose Off to turn this off.",
      )
      return
    }
    if (pubkey && !/^(0x)?[0-9a-fA-F]{66}$/.test(pubkey)) {
      setLocalError(
        "Liquidity node pubkey must be a 33-byte compressed key (66 hex characters).",
      )
      return
    }
    if (pubkey && (!maxAmountCkb.trim() || !maxOpenFeeCkb.trim())) {
      setLocalError(
        "Set the largest payment you will accept and the largest open fee you will quote.",
      )
      return
    }
    try {
      await onUpdateJitReceiver(pubkey, maxAmountCkb.trim(), maxOpenFeeCkb.trim())
    } catch {
      // actionError is set by the hook
    }
  }

  const handleSaveAddrs = async () => {
    setLocalError(null)
    for (const addr of parsedAddrs) {
      if (
        !addr.startsWith("/") ||
        /[\s"'\\#]/.test(addr) ||
        addr.includes("\n")
      ) {
        setLocalError(
          `Listening address must be a multiaddr starting with / and without quotes or spaces (got "${addr}").`,
        )
        return
      }
    }
    try {
      await onUpdateListeningAddrs(parsedAddrs)
    } catch {
      // actionError is set by the hook
    }
  }

  const featureValue =
    settings.featureLabels.length > 0
      ? settings.featureLabels.join(", ")
      : settings.nodeStatus.state === "running"
        ? "None reported"
        : "Start node to load features"

  return (
    <SettingsSection
      title="Fiber network"
      subtitle="P2P listen addresses, durability, Channel V2, and just-in-time receiving."
    >
      <SettingsRows>
        <SettingsRow
          label="Fiber listen"
          value={settings.fiberListeningAddr ?? "—"}
          mono
        />
        <SettingsRow
          label="Channel protocol"
          value={
            settings.nodeStatus.state === "running"
              ? settings.supportsChannelV2
                ? "V2 (new opens)"
                : "V1 only"
              : "—"
          }
        />
        <SettingsRow label="Node features" value={featureValue} />
      </SettingsRows>

      <div className="space-y-5 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <SwitchField>
          <Label>Sync store writes to disk</Label>
          <Description>
            Every store write waits for the disk. Safer if you hold others’
            funds (e.g. a relay), but slower. Requires a node restart.
          </Description>
          <Switch
            checked={settings.storeSyncWrites}
            disabled={!nodeStopped || isActing}
            onChange={(checked) => {
              void onUpdateStoreSyncWrites(checked)
            }}
          />
        </SwitchField>

        <FieldGroup>
          <Field>
            <Label>Extra listen addresses</Label>
            <Textarea
              rows={3}
              className="font-mono text-xs"
              placeholder={'/ip6/::/tcp/8228'}
              value={addrsText}
              disabled={!nodeStopped || isActing}
              onChange={(event) => setAddrsText(event.target.value)}
            />
            <Description>
              Optional multiaddrs appended to the primary Fiber listen address
              (one per line). Useful for IPv6. Stop the node before saving.
            </Description>
          </Field>
        </FieldGroup>

        {localError ? (
          <Text className="text-xs text-red-600 dark:text-red-400">
            {localError}
          </Text>
        ) : null}

        {!nodeStopped ? (
          <Text className="text-xs text-amber-700 dark:text-amber-400">
            Stop your node before changing store sync, listen addresses, or
            just-in-time receiving.
          </Text>
        ) : null}

        <div className="flex justify-end">
          <Button
            outline
            className="text-xs"
            disabled={!nodeStopped || isActing || !addrsDirty}
            onClick={() => void handleSaveAddrs()}
          >
            Save listen addresses
          </Button>
        </div>

        <div className="space-y-4 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <div>
            <h3 className="text-sm/6 font-medium text-zinc-950 dark:text-white">
              Receive without a channel
            </h3>
            <Text className="mt-1">
              Leave this off to pay and receive through your own channels. You
              do not need a liquidity node. If you name one, and it confirms a
              fee, someone can pay a CKB invoice when you have no channel with
              them. That node funds the payment, and you keep about 99 CKB on
              chain for the cell reserve. A node that does not serve
              just-in-time channels leaves your invoices ordinary.
            </Text>
          </div>
          <Field>
            <Label>Liquidity node</Label>
            <Select
              value={peerChoice}
              disabled={!nodeStopped || isActing}
              onChange={(event) => choosePeer(event.target.value)}
            >
              <option value={JIT_PEER_OFF}>Off</option>
              {savedPeerPubkeys.map((pubkey) => (
                <option key={pubkey} value={pubkey}>
                  {truncatePubkey(pubkey)}
                </option>
              ))}
              <option value={JIT_PEER_OTHER}>Another pubkey…</option>
            </Select>
            <Description>
              Connecting a peer on the Network page does not turn this on.
              Choose a node here only when you want just-in-time receiving.
              Saving also keeps that peer so the wallet dials it on startup.
            </Description>
          </Field>
          {peerChoice === JIT_PEER_OTHER ? (
            <Field>
              <Label>Liquidity node pubkey</Label>
              <Input
                className="font-mono text-xs"
                placeholder="02…"
                value={otherPubkey}
                disabled={!nodeStopped || isActing}
                onChange={(event) => {
                  setOtherPubkey(event.target.value)
                  setLspPubkey(event.target.value)
                }}
              />
            </Field>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <Label>Max receive (CKB)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="1000"
                value={maxAmountCkb}
                disabled={!nodeStopped || isActing}
                onChange={(event) => setMaxAmountCkb(event.target.value)}
              />
              <Description>
                Largest funded balance you will accept, above the cell reserve.
              </Description>
            </Field>
            <Field>
              <Label>Max open fee (CKB)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={maxOpenFeeCkb}
                disabled={!nodeStopped || isActing}
                onChange={(event) => setMaxOpenFeeCkb(event.target.value)}
              />
              <Description>
                Largest fee you will put on an invoice. Use 0 when the liquidity
                node charges nothing.
              </Description>
            </Field>
          </div>
          <Text className="text-xs text-zinc-500 dark:text-zinc-400">
            Many nodes will not serve just-in-time channels. The feature flag
            is shared with wallets that only receive, so it does not prove a
            node will open one. After you start and stay connected, create a
            CKB invoice. A confirmed fee appears on the invoice. Otherwise the
            invoice stays ordinary and can still be paid through a channel.
            The bundled fnn 0.10.1 stores this choice and still starts; the
            invoice behavior arrives with a Fiber build that includes
            just-in-time channels.
          </Text>
          <div className="flex justify-end">
            <Button
              outline
              className="text-xs"
              disabled={!nodeStopped || isActing || !jitDirty}
              onClick={() => void handleSaveJit()}
            >
              Save just-in-time receiving
            </Button>
          </div>
        </div>
      </div>
    </SettingsSection>
  )
}
