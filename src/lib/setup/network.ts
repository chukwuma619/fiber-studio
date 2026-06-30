import type { NetworkChoice } from "./types"

/** Re-enable when mainnet support is fully tested and ready for production. */
export const MAINNET_ENABLED = false

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
    description: "Live Fiber network with real CKB.",
    enabled: MAINNET_ENABLED,
  },
  {
    value: "testnet",
    label: "Testnet",
    description: "Staging network with test CKB.",
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
