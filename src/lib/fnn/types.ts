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

export type HomeNodeInfo = {
  version: string
  pubkey: string
  nodeName: string | null
  channelCount: number
  pendingChannelCount: number
  peersCount: number
}

export type HomeChannel = {
  channelId: string
  pubkey: string
  isPublic: boolean
  state: string
  localBalance: string
  remoteBalance: string
  localPercent: number
}

export type CkbScript = {
  codeHash: string
  hashType: string
  args: string
}

export type ChannelsPageResponse = {
  available: boolean
  channels: HomeChannel[]
  activeChannelCount: number
  totalCapacity: string
  totalLocalBalance: string
  network: string | null
  defaultFundingLockScript: CkbScript | null
}

export type OpenChannelPayload = {
  pubkey: string
  fundingCkb: number
  isPublic: boolean
}

export type OpenChannelResult = {
  channelId: string | null
}

export type PeerOpenChannelPolicy = {
  pubkey: string
  minFundingCkb: number | null
  known: boolean
  recommendedFundingCkb: number
}

export type ShutdownChannelPayload = {
  channelId: string
}

export type HomePeer = {
  pubkey: string
  address: string
}

export type HomePayment = {
  paymentHash: string
  status: string
  createdAt: number
  lastUpdatedAt: number
  failedError: string | null
  fee: string
}

export type RelayConnectionStatus =
  | "not_configured"
  | "connected"
  | "connecting"
  | "failed"

export type HomeDashboardResponse = {
  available: boolean
  nodeInfo: HomeNodeInfo | null
  channels: HomeChannel[]
  peers: HomePeer[]
  payments: HomePayment[]
  totalLocalBalance: string
  configuredRelayPubkey: string | null
  configuredRelayMultiaddr: string | null
  network: string | null
  relayStatus: RelayConnectionStatus
}
