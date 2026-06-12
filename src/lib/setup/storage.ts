import {
  createDefaultSetupConfig,
  type SetupConfig,
} from "./types"

const SETUP_KEY = "fiber-studio-setup-complete"
const SETUP_CONFIG_KEY = "fiber-studio-setup-config"

type PersistedSetupConfig = Omit<SetupConfig, "importedPrivateKey">

export function getSetupComplete(): boolean {
  return localStorage.getItem(SETUP_KEY) === "true"
}

export function saveSetupConfig(config: SetupConfig): void {
  const { importedPrivateKey: _key, ...persisted } = config
  localStorage.setItem(
    SETUP_CONFIG_KEY,
    JSON.stringify(persisted satisfies PersistedSetupConfig),
  )
}

export function loadSetupConfig(): SetupConfig | null {
  const raw = localStorage.getItem(SETUP_CONFIG_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<SetupConfig>
    return {
      ...createDefaultSetupConfig(),
      ...parsed,
    }
  } catch {
    return null
  }
}

export function completeSetup(config: SetupConfig): void {
  localStorage.setItem(SETUP_KEY, "true")
  saveSetupConfig(config)
}
