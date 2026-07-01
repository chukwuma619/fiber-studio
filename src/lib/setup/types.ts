import { getDataDirectoryDisplayForNetwork } from "../data-directory"
import { getRelay, type PublicConnectionMode } from "../public-relays"

export type SetupStep =
  | "welcome"
  | "network"
  | "public-network"
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
  fnnVersion?: string
}

export const SETUP_STEPS: SetupStep[] = [
  "welcome",
  "network",
  "public-network",
  "key-file",
  "password",
  "review",
]

export const STEP_TITLES: Record<SetupStep, string> = {
  welcome: "Welcome",
  network: "Network",
  "public-network": "Public network",
  "key-file": "Wallet key",
  password: "Wallet password",
  review: "Review & start",
}

export function createDefaultSetupConfig(): SetupConfig {
  const node1 = getRelay("testnet", "node1")

  return {
    network: "testnet",
    publicConnectionMode: "official-relays",
    customPublicNodePubkey: node1.pubkey,
    customPublicNodeMultiaddr: node1.multiaddr ?? "",
    dataDirectory: getDataDirectoryDisplayForNetwork("testnet"),
    keyFileMode: "import",
    keyFilePath: "",
    importedPrivateKey: "",
    password: "",
  }
}
