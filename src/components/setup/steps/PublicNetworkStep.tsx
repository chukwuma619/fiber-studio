import { EXAMPLE_CUSTOM_PUBLIC_NODES } from "../../../lib/public-relays"
import type { SetupConfig } from "../../../lib/setup/types"
import { ConnectPeerForm } from "../../connect/ConnectPeerForm"
import { Heading } from "../../ui/heading"
import { Text } from "../../ui/text"

type PublicNetworkStepProps = {
  config: SetupConfig
  onChange: (patch: Partial<SetupConfig>) => void
}

export function PublicNetworkStep({ config, onChange }: PublicNetworkStepProps) {
  const { network } = config

  return (
    <div className="space-y-5">
      <div>
        <Heading level={2}>Connect to public network</Heading>
        <Text className="mt-1">
          Pick a public relay or enter a peer pubkey. Fiber Studio connects
          outbound on start — no public IP or VPS required.
        </Text>
      </div>

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
    </div>
  )
}
