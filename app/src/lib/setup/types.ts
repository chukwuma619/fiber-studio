import { getDataDirectoryDisplayForNetwork } from "../data-directory"
import type { PublicConnectionMode } from "../public-relays"

export type SetupStep =
  | "welcome"
  | "network"
  | "key-file"
  | "password"
  | "review"

export type NetworkChoice = "mainnet" | "testnet"

export type KeyFileMode = "import"

export type SetupConfig = {
  network: NetworkChoice
  publicConnectionMode: PublicConnectionMode
  customPublicNodePubkey: string
  customPublicNodeMultiaddr: string
  dataDirectory: string
  keyFileMode: KeyFileMode
  keyFilePath: string
  /** Setup-time only — never written to localStorage. */
  importedPrivateKey: string
  /** Setup-time only — stored in OS keychain, not localStorage. */
  password: string
  /** Setup-time only — confirm field for onboarding password entry. */
  passwordConfirm: string
  fnnVersion?: string
}

export const SETUP_STEPS: SetupStep[] = [
  "welcome",
  "network",
  "key-file",
  "password",
  "review",
]

export const STEP_TITLES: Record<SetupStep, string> = {
  welcome: "Welcome",
  network: "Network",
  "key-file": "Wallet key",
  password: "Wallet password",
  review: "Review & start",
}

export function createDefaultSetupConfig(): SetupConfig {
  return {
    network: "testnet",
    publicConnectionMode: "official-relays",
    customPublicNodePubkey: "",
    customPublicNodeMultiaddr: "",
    dataDirectory: getDataDirectoryDisplayForNetwork("testnet"),
    keyFileMode: "import",
    keyFilePath: "",
    importedPrivateKey: "",
    password: "",
    passwordConfirm: "",
  }
}
