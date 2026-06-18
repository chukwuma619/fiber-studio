import {
  PUBLIC_RELAYS,
  truncatePubkey,
  type FiberNetwork,
  type PublicConnectionMode,
} from "../../lib/public-relays"
import { Button } from "../ui/button"
import { Description, Field, Label } from "../ui/fieldset"
import { Input } from "../ui/input"
import { Text } from "../ui/text"

type ConnectPeerFormProps = {
  network: FiberNetwork
  publicConnectionMode: PublicConnectionMode
  pubkey: string
  multiaddr: string
  onPubkeyChange: (value: string) => void
  onMultiaddrChange: (value: string) => void
  customPubkeyExample?: string
}

export function ConnectPeerForm({
  network,
  publicConnectionMode,
  pubkey,
  multiaddr,
  onPubkeyChange,
  onMultiaddrChange,
  customPubkeyExample = "",
}: ConnectPeerFormProps) {
  const relays = PUBLIC_RELAYS[network]
  const isOfficial = publicConnectionMode === "official-relays"

  function applyRelay(id: "node1" | "node2") {
    const relay = relays.find((node) => node.id === id)
    if (!relay) return
    onPubkeyChange(relay.pubkey)
    onMultiaddrChange("")
  }

  function applyCustomExample() {
    if (customPubkeyExample) {
      onPubkeyChange(customPubkeyExample)
      onMultiaddrChange("")
    }
  }

  return (
    <div className="space-y-4">
      {isOfficial ? (
        <div className="flex flex-wrap gap-2">
          <Button outline className="text-xs" onClick={() => applyRelay("node1")}>
            Use public node1
          </Button>
          <Button outline className="text-xs" onClick={() => applyRelay("node2")}>
            Use public node2
          </Button>
        </div>
      ) : (
        <Button
          outline
          className="text-xs"
          onClick={applyCustomExample}
          disabled={!customPubkeyExample}
        >
          Use example pubkey
        </Button>
      )}

      <Field>
        <Label>Pubkey (required)</Label>
        <Input
          type="text"
          placeholder="02… or 03… (hex secp256k1 pubkey)"
          value={pubkey}
          onChange={(e) => onPubkeyChange(e.target.value)}
          className="font-mono text-xs"
        />
        <Description>Enter any public Fiber node&apos;s pubkey</Description>
      </Field>

      <Field>
        <Label>Multiaddr (optional)</Label>
        <Input
          type="text"
          placeholder="/ip4/…/tcp/…/p2p/…"
          value={multiaddr}
          onChange={(e) => onMultiaddrChange(e.target.value)}
          className="font-mono text-xs"
        />
        <Description>
          Optional — outbound connect to public nodes usually needs pubkey only
        </Description>
      </Field>

      {pubkey ? (
        <div className="rounded-lg bg-zinc-950/2.5 px-3 py-2 ring-1 ring-zinc-950/5 dark:bg-white/5 dark:ring-white/10">
          <Text className="text-xs">
            Connecting to{" "}
            <span className="font-mono">{truncatePubkey(pubkey)}</span>
            {multiaddr ? " via multiaddr" : " outbound"}
          </Text>
        </div>
      ) : null}
    </div>
  )
}
