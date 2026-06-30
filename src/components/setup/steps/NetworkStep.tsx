import {
  NETWORK_OPTIONS,
  type NetworkOption,
} from "../../../lib/setup/network"
import type { NetworkChoice } from "../../../lib/setup/types"
import { Badge } from "../../ui/badge"
import { Heading } from "../../ui/heading"
import { Text } from "../../ui/text"
import { SelectionCard } from "../SelectionCard"

type NetworkStepProps = {
  network: NetworkChoice
  onChange: (network: NetworkChoice) => void
  /** Limit choices — used when switching away from the current network. */
  options?: NetworkOption[]
  hideHeading?: boolean
  description?: string
}

export function NetworkStep({
  network,
  onChange,
  options = NETWORK_OPTIONS,
  hideHeading = false,
  description = "This sets the fnn network your node will join.",
}: NetworkStepProps) {
  return (
    <div className="space-y-4">
      {!hideHeading ? (
        <div>
          <Heading level={2} tabIndex={-1}>
            Choose a network
          </Heading>
          <Text className="mt-1">{description}</Text>
        </div>
      ) : null}

      <div
        role="radiogroup"
        aria-label="Fiber network"
        className="grid gap-3 sm:grid-cols-2"
      >
        {options.map((option) => {
          const selected = network === option.value
          const disabled = !option.enabled
          return (
            <SelectionCard
              key={option.value}
              role="radio"
              selected={selected}
              disabled={disabled}
              onClick={() => {
                if (!disabled) onChange(option.value)
              }}
              title={option.label}
              description={option.description}
              badge={
                disabled ? (
                  <Badge color="zinc">Coming soon</Badge>
                ) : selected ? (
                  <Badge color="zinc">{option.value}</Badge>
                ) : undefined
              }
            />
          )
        })}
      </div>
    </div>
  )
}
