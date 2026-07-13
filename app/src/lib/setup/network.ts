import type { NetworkChoice } from "./types"


export type NetworkOption = {
  value: NetworkChoice
  label: string
  description: string
  enabled: boolean
}

export const NETWORK_OPTIONS: NetworkOption[] = [
  {
    value: "mainnet",
    label: "Mainnet",
    description: "Real CKB on the live network.",
    enabled: false,
  },
  {
    value: "testnet",
    label: "Testnet",
    description: "Test CKB for trying Fiber.",
    enabled: true,
  },
]

export function enabledNetworks(): NetworkChoice[] {
  return NETWORK_OPTIONS.filter((option) => option.enabled).map(
    (option) => option.value,
  )
}

export function switchTargetNetworks(current: NetworkChoice): NetworkChoice[] {
  return enabledNetworks().filter((network) => network !== current)
}

export function canSwitchNetwork(current: NetworkChoice): boolean {
  return switchTargetNetworks(current).length > 0
}
