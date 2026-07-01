import { EXAMPLE_CUSTOM_PUBLIC_NODES } from "../../../lib/public-relays"
import type { SetupConfig } from "../../../lib/setup/types"
import { ConnectPeerForm } from "../../connect/ConnectPeerForm"
import { ErrorMessage } from "../../ui/fieldset"
import { Heading } from "../../ui/heading"
import { Text } from "../../ui/text"

export type ConfiguredPeerFields = Pick<
  SetupConfig,
  "network" | "customPublicNodePubkey" | "customPublicNodeMultiaddr"
>

type PublicNetworkStepProps = {
  config: ConfiguredPeerFields
  onChange: (patch: Partial<ConfiguredPeerFields>) => void
  hideHeading?: boolean
  error?: string | null
}

export function PublicNetworkStep({
  config,
  onChange,
  hideHeading = false,
  error,
}: PublicNetworkStepProps) {
  const { network } = config

  return (
    <div className="space-y-5">
      {!hideHeading ? (
        <div>
          <Heading level={2} tabIndex={-1}>Connect to public network</Heading>
          <Text className="mt-1">
            Pick a public node or enter a peer pubkey.
          </Text>
        </div>
      ) : null}

      <ConnectPeerForm
        network={network}
        publicConnectionMode="official-relays"
        pubkey={config.customPublicNodePubkey}
        multiaddr={config.customPublicNodeMultiaddr}
        onPubkeyChange={(customPublicNodePubkey) =>
          onChange({ customPublicNodePubkey })
        }
        onMultiaddrChange={(customPublicNodeMultiaddr) =>
          onChange({ customPublicNodeMultiaddr })
        }
        customPubkeyExample={EXAMPLE_CUSTOM_PUBLIC_NODES[network]}
      />

      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
    </div>
  )
}
