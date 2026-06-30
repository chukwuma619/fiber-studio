import {
  getDataDirectoryDisplayForNetwork,
  isLegacyDataDirectoryPath,
} from "../data-directory"
import {
  createDefaultSetupConfig,
  type NetworkChoice,
  type SetupConfig,
} from "./types"

const SETUP_KEY = "fiber-studio-setup-complete"
const SETUP_CONFIG_KEY = "fiber-studio-setup-config"

type PersistedSetupConfig = Omit<SetupConfig, "importedPrivateKey" | "password">

export function getSetupComplete(): boolean {
  return localStorage.getItem(SETUP_KEY) === "true"
}

export function saveSetupConfig(config: SetupConfig): void {
  const {
    importedPrivateKey: _importedKey,
    password: _password,
    ...persisted
  } = config
  localStorage.setItem(
    SETUP_CONFIG_KEY,
    JSON.stringify(persisted satisfies PersistedSetupConfig),
  )
}

function normalizeDataDirectory(config: SetupConfig): SetupConfig {
  return {
    ...config,
    dataDirectory: getDataDirectoryDisplayForNetwork(config.network),
  }
}

export function loadSetupConfig(): SetupConfig | null {
  const raw = localStorage.getItem(SETUP_CONFIG_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<SetupConfig>
    const network = (parsed.network as NetworkChoice | undefined) ?? "testnet"
    const config = normalizeDataDirectory({
      ...createDefaultSetupConfig(),
      ...parsed,
      network,
    })
    const needsSave =
      parsed.dataDirectory !== config.dataDirectory ||
      isLegacyDataDirectoryPath(parsed.dataDirectory ?? "")
    if (needsSave) {
      saveSetupConfig(config)
    }
    return config
  } catch {
    return null
  }
}

export function completeSetup(config: SetupConfig): void {
  localStorage.setItem(SETUP_KEY, "true")
  saveSetupConfig(normalizeDataDirectory(config))
}
