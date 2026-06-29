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
  failureDetail?: string | null
}

export type CkbScript = {
  codeHash: string
  hashType: string
  args: string
}

export type WalletBalanceResponse = {
  availableCkb: number
  shannons: string
}

export type SavedPeerEntry = {
  pubkey: string
  multiaddr: string | null
  connected: boolean
  channelCount: number
  hasActiveOrPendingChannel: boolean
}

export type ChannelsPageResponse = {
  available: boolean
  channels: HomeChannel[]
  activeChannelCount: number
  pendingChannelCount: number
  totalCapacity: string
  totalLocalBalance: string
  onChainWalletCkb: number | null
  onChainWalletError?: string | null
  network: string | null
  defaultFundingLockScript: CkbScript | null
  savedPeers: SavedPeerEntry[]
  relayStatus: RelayConnectionStatus
  minFundingCkb: number
}

export type OpenChannelPayload = {
  pubkey: string
  fundingCkb: number
}

export type OpenChannelResult = {
  channelId: string | null
}

export type ShutdownChannelPayload = {
  channelId: string
}

export type AbandonChannelPayload = {
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
  paymentKind: "invoice" | "keysend" | "unknown" | string
  amountCkb?: string | null
  routeHops: string[]
}

export type HomeIncomingInvoice = {
  paymentHash: string
  amountCkb: string
  note: string
  status: string
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
  incomingInvoices: HomeIncomingInvoice[]
  activeChannelCount: number
  pendingChannelCount: number
  totalLocalBalance: string
  savedPeerPubkeys: string[]
  network: string | null
  relayStatus: RelayConnectionStatus
}

export type WalletInvoiceItem = {
  paymentHash: string
  invoiceAddress: string
  amountCkb: string
  note: string
  status: string
  expiresIn: string | null
}

export type WalletPaymentItem = {
  paymentHash: string
  status: string
  createdAt: number
  lastUpdatedAt: number
  failedError: string | null
  fee: string
  paymentKind: "invoice" | "keysend" | "unknown" | string
  amountCkb?: string | null
  targetPubkey?: string | null
  routeHops: string[]
}

export type WalletSendTarget = {
  pubkey: string
  label: string
  kind: "relay" | "channel" | "peer" | string
}

export type WalletPageResponse = {
  available: boolean
  network: string | null
  pubkey: string | null
  inChannelBalanceCkb: number
  onChainWalletCkb: number | null
  onChainWalletError?: string | null
  lockScript: CkbScript | null
  invoices: WalletInvoiceItem[]
  payments: WalletPaymentItem[]
  paymentsLastCursor: string | null
  paymentsHasMore: boolean
  sendTargets: WalletSendTarget[]
  relayStatus: RelayConnectionStatus
}

export type CreateInvoicePayload = {
  amount: number
  expiryHours: number
  description?: string
}

export type ParseInvoicePayload = {
  invoice: string
}

export type ParseInvoicePreview = {
  amountDisplay: string
  currency: string
  paymentHash: string
  description?: string | null
  networkMatch: boolean
  networkWarning?: string | null
}

export type CreateInvoiceResult = {
  invoiceAddress: string
  paymentHash: string
}

export type SendPaymentPayload = {
  invoice: string
  maxFeeCkb?: number
  timeoutSeconds?: number
}

export type KeysendPaymentPayload = {
  targetPubkey: string
  amount: number
  maxFeeCkb?: number
  timeoutSeconds?: number
}

export type SendPaymentMode = "invoice" | "keysend"

export type PreviewSendPaymentResult = {
  feeShannons: string
  feeCkb: string
  amountDisplay: string
  routeHops: string[]
}

export type SendPaymentResult = {
  paymentHash: string
  status: string
  fee: string
  failedError?: string | null
  routeHops: string[]
}

export type PaymentHashPayload = {
  paymentHash: string
}

export type LoadMorePaymentsPayload = {
  after: string
}

export type LoadMorePaymentsResult = {
  payments: WalletPaymentItem[]
  lastCursor: string | null
  hasMore: boolean
}

export type NetworkConnectionMode = "official-relays" | "custom-public-node"

export type NetworkRelayEntry = {
  id: string
  pubkey: string
  multiaddr: string | null
  connected: boolean
  channelCount: number
  hasActiveOrPendingChannel: boolean
  isSaved: boolean
}

export type NetworkCustomPeer = {
  pubkey: string
  address: string
  channelCount: number
}

export type NetworkConnectedPeer = {
  pubkey: string
  address: string
  isSaved: boolean
  isOfficialRelay: boolean
  isBootnode: boolean
  channelCount: number
}

export type NetworkPageResponse = {
  available: boolean
  network: string | null
  nodePubkey: string | null
  savedPeers: SavedPeerEntry[]
  savedPeerConnectedCount: number
  relayStatus: RelayConnectionStatus
  graphNodeCount: number
  graphReady: boolean
  connectedPeerCount: number
  relays: NetworkRelayEntry[]
  connectedPeers: NetworkConnectedPeer[]
  customPeers: NetworkCustomPeer[]
  onChainWalletCkb: number | null
  onChainWalletError?: string | null
  minFundingCkb: number
}

export type ConnectPeerPayload = {
  pubkey: string
  multiaddr?: string
}

export type AddSavedPeerPayload = {
  pubkey: string
  multiaddr?: string
}

export type RemoveSavedPeerPayload = {
  pubkey: string
}

export type PeerConnectResult = {
  status: "connected" | "already_connected" | "failed" | "connecting" | "not_configured"
}

export type DisconnectPeerPayload = {
  pubkey: string
}

export type NetworkGraphKind = "nodes" | "channels"

export type GetNetworkGraphPayload = {
  kind: NetworkGraphKind
  limit?: number
  after?: string
}

export type NetworkGraphNodeEntry = {
  pubkey: string
  nodeName: string | null
  addressCount: number
  primaryAddress: string | null
}

export type NetworkGraphChannelEntry = {
  channelOutpoint: string
  node1: string
  node2: string
  capacityCkb: string
}

export type NetworkGraphResponse = {
  kind: NetworkGraphKind
  nodes: NetworkGraphNodeEntry[]
  channels: NetworkGraphChannelEntry[]
  lastCursor: string | null
  hasMore: boolean
}
