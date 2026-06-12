export const FNN_VERSION = "0.8.1"

export type NodeStatusState =
  | { state: "stopped" }
  | { state: "starting" }
  | { state: "running"; version: string; pubkey: string }
  | { state: "error"; message: string }

export type CompleteSetupResult = {
  status: string
  version: string
  pubkey: string
}

export type NodeStatusResponse = {
  status: NodeStatusState
  dataDirectory: string | null
  recentLogs: string[]
}

export type CompleteSetupPayload = {
  network: string
  dataDirectory: string
  keyFileMode: string
  keyFilePath: string
  importedPrivateKey?: string
  password: string
  customPublicNodePubkey: string
  customPublicNodeMultiaddr: string
}

export type StartNodePayload = {
  dataDirectory: string
}
