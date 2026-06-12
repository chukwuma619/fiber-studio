import type { NetworkChoice } from "../../../lib/setup/types"
import { Badge } from "../../ui/badge"
import { Heading } from "../../ui/heading"
import { Text } from "../../ui/text"
import { SelectionCard } from "../SelectionCard"

const OPTIONS: {
  value: NetworkChoice
  label: string
  description: string
}[] = [
  {
    value: "mainnet",
    label: "Mainnet",
    description: "Connect to the live Fiber network with real CKB.",
  },
  {
    value: "testnet",
    label: "Testnet",
    description: "Experiment safely with test CKB on the staging network.",
  },
]

type NetworkStepProps = {
  network: NetworkChoice
  onChange: (network: NetworkChoice) => void
}

export function NetworkStep({ network, onChange }: NetworkStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <Heading level={2}>Choose a network</Heading>
        <Text className="mt-1">
          This sets the fnn network your node will join. You can change it later
          in Settings.
        </Text>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const selected = network === option.value
          return (
            <SelectionCard
              key={option.value}
              selected={selected}
              onClick={() => onChange(option.value)}
              title={option.label}
              description={option.description}
              badge={
                selected ? <Badge color="blue">{option.value}</Badge> : undefined
              }
            />
          )
        })}
      </div>
    </div>
  )
}
