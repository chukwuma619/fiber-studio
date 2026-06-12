import { joinDataPath } from "../../../lib/data-directory"
import {
  getRelay,
  PUBLIC_CHANNEL_FUNDING_CKB,
  truncatePubkey,
} from "../../../lib/public-relays"
import type { SetupConfig } from "../../../lib/setup/types"
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from "../../ui/description-list"
import { Heading } from "../../ui/heading"
import { Text } from "../../ui/text"

function relayLabelForPubkey(
  network: SetupConfig["network"],
  pubkey: string,
): string | null {
  const node1 = getRelay(network, "node1")
  const node2 = getRelay(network, "node2")
  if (pubkey === node1.pubkey) return "node1"
  if (pubkey === node2.pubkey) return "node2"
  return null
}

type ReviewRow = {
  label: string
  value: string
  mono?: boolean
}

export function ReviewStep({ config }: { config: SetupConfig }) {
  const relayLabel = relayLabelForPubkey(
    config.network,
    config.customPublicNodePubkey,
  )

  const rows: ReviewRow[] = [
    { label: "Network", value: config.network },
    {
      label: "Connect peer",
      value: config.customPublicNodePubkey
        ? relayLabel
          ? `${relayLabel} · ${truncatePubkey(config.customPublicNodePubkey)}`
          : truncatePubkey(config.customPublicNodePubkey)
        : "Not set",
      mono: true,
    },
    ...(config.customPublicNodeMultiaddr
      ? [
          {
            label: "Multiaddr",
            value: config.customPublicNodeMultiaddr,
            mono: true,
          },
        ]
      : []),
    {
      label: "Channel plan",
      value: `Open public channel · ${PUBLIC_CHANNEL_FUNDING_CKB} CKB · public: true`,
    },
    { label: "Data directory", value: config.dataDirectory, mono: true },
    {
      label: "Wallet key",
      value:
        config.keyFileMode === "import"
          ? config.importedPrivateKey
            ? `Private key → ${joinDataPath(config.dataDirectory, "ckb", "key")}`
            : "Not entered"
          : joinDataPath(config.dataDirectory, config.keyFilePath),
      mono: true,
    },
    {
      label: "Key password",
      value: config.password ? "••••••••" : "Not set",
    },
    {
      label: "Environment",
      value: "FIBER_SECRET_KEY_PASSWORD → keychain",
      mono: true,
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <Heading level={2}>Review & start</Heading>
        <Text className="mt-1">
          Confirm your setup before starting the local fnn node.
        </Text>
      </div>

      <DescriptionList>
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <DescriptionTerm>{row.label}</DescriptionTerm>
            <DescriptionDetails
              className={row.mono ? "font-mono text-xs text-zinc-500" : undefined}
            >
              {row.value}
            </DescriptionDetails>
          </div>
        ))}
      </DescriptionList>

      <Text className="text-xs">
        Clicking Start node will launch fnn with these settings. You can adjust
        them anytime in Settings.
      </Text>
    </div>
  )
}
