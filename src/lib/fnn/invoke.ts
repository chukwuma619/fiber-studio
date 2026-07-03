import { invoke } from "@tauri-apps/api/core"
import { normalizeCkbPrivateKey } from "../ckb-key"
import type { SetupConfig } from "../setup/types"
import type {
  AbandonChannelPayload,
  ChannelsPageResponse,
  CompleteSetupPayload,
  CompleteSetupResult,
  ConnectPeerPayload,
  CreateInvoicePayload,
  CreateInvoiceResult,
  DisconnectPeerPayload,
  GetNetworkGraphPayload,
  HomeDashboardResponse,
  NetworkGraphResponse,
  NetworkPageResponse,
  NodeStatusResponse,
  OpenChannelPayload,
  OpenChannelResult,
  KeysendPaymentPayload,
  LoadMorePaymentsPayload,
  LoadMorePaymentsResult,
  ParseInvoicePayload,
  ParseInvoicePreview,
  PeerConnectResult,
  PreviewSendPaymentResult,
  SendPaymentPayload,
  SendPaymentResult,
  PaymentHashPayload,
  AddSavedPeerPayload,
  RemoveSavedPeerPayload,
  ConnectSavedPeerPayload,
  ShutdownChannelPayload,
  StartNodePayload,
  WalletBalanceResponse,
  WalletInvoiceItem,
  WalletPageResponse,
  NodeSettingsResponse,
  UpdateWalletPasswordPayload,
  SwitchNetworkPayload,
} from "./types"

function toCompleteSetupPayload(config: SetupConfig): CompleteSetupPayload {
  const importedPrivateKey = config.importedPrivateKey.trim()
    ? normalizeCkbPrivateKey(config.importedPrivateKey)
    : undefined

  return {
    network: config.network,
    dataDirectory: config.dataDirectory,
    keyFileMode: config.keyFileMode,
    keyFilePath: config.keyFilePath,
    importedPrivateKey,
    password: config.password,
    customPublicNodePubkey: config.customPublicNodePubkey,
    customPublicNodeMultiaddr: config.customPublicNodeMultiaddr,
  }
}

export async function completeSetupAndStart(
  config: SetupConfig,
): Promise<CompleteSetupResult> {
  return invoke<CompleteSetupResult>("complete_setup", {
    payload: toCompleteSetupPayload(config),
  })
}

export async function getNodeStatus(
  dataDirectory?: string,
): Promise<NodeStatusResponse> {
  return invoke<NodeStatusResponse>("get_node_status", { dataDirectory })
}

export async function getNodeLogs(limit?: number): Promise<string[]> {
  return invoke<string[]>("get_node_logs", { limit })
}

export async function startNode(
  payload: StartNodePayload,
): Promise<NodeStatusResponse> {
  return invoke<NodeStatusResponse>("start_node", { payload })
}

export async function stopNode(): Promise<NodeStatusResponse> {
  return invoke<NodeStatusResponse>("stop_node")
}

export async function getHomeDashboard(): Promise<HomeDashboardResponse> {
  return invoke<HomeDashboardResponse>("get_home_dashboard")
}

export async function getChannelsPage(): Promise<ChannelsPageResponse> {
  return invoke<ChannelsPageResponse>("get_channels_page")
}

export async function openChannel(
  payload: OpenChannelPayload,
): Promise<OpenChannelResult> {
  return invoke<OpenChannelResult>("open_channel", { payload })
}

export async function getWalletBalance(): Promise<WalletBalanceResponse> {
  return invoke<WalletBalanceResponse>("get_wallet_balance")
}

export async function shutdownChannel(
  payload: ShutdownChannelPayload,
): Promise<void> {
  return invoke<void>("shutdown_channel", { payload })
}

export async function abandonChannel(
  payload: AbandonChannelPayload,
): Promise<void> {
  return invoke<void>("abandon_channel", { payload })
}

export async function getWalletPage(): Promise<WalletPageResponse> {
  return invoke<WalletPageResponse>("get_wallet_page")
}

export async function createInvoice(
  payload: CreateInvoicePayload,
): Promise<CreateInvoiceResult> {
  return invoke<CreateInvoiceResult>("create_invoice", { payload })
}

export async function parseInvoicePreview(
  payload: ParseInvoicePayload,
): Promise<ParseInvoicePreview> {
  return invoke<ParseInvoicePreview>("parse_invoice_preview", { payload })
}

export async function previewSendPayment(
  payload: SendPaymentPayload,
): Promise<PreviewSendPaymentResult> {
  return invoke<PreviewSendPaymentResult>("preview_send_payment", { payload })
}

export async function sendPayment(
  payload: SendPaymentPayload,
): Promise<SendPaymentResult> {
  return invoke<SendPaymentResult>("send_payment", { payload })
}

export async function previewKeysendPayment(
  payload: KeysendPaymentPayload,
): Promise<PreviewSendPaymentResult> {
  return invoke<PreviewSendPaymentResult>("preview_keysend_payment", { payload })
}

export async function sendKeysendPayment(
  payload: KeysendPaymentPayload,
): Promise<SendPaymentResult> {
  return invoke<SendPaymentResult>("send_keysend_payment", { payload })
}

export async function getPayment(
  payload: PaymentHashPayload,
): Promise<SendPaymentResult> {
  return invoke<SendPaymentResult>("get_payment", { payload })
}

export async function cancelInvoice(
  payload: PaymentHashPayload,
): Promise<WalletInvoiceItem> {
  return invoke<WalletInvoiceItem>("cancel_invoice", { payload })
}

export async function loadMoreWalletPayments(
  payload: LoadMorePaymentsPayload,
): Promise<LoadMorePaymentsResult> {
  return invoke<LoadMorePaymentsResult>("load_more_wallet_payments", { payload })
}

export async function importInvoice(
  payload: PaymentHashPayload,
): Promise<WalletInvoiceItem> {
  return invoke<WalletInvoiceItem>("import_invoice", { payload })
}

export async function getNetworkPage(): Promise<NetworkPageResponse> {
  return invoke<NetworkPageResponse>("get_network_page")
}

export async function connectPeer(
  payload: ConnectPeerPayload,
): Promise<PeerConnectResult> {
  return invoke<PeerConnectResult>("connect_peer", { payload })
}

export async function addSavedPeer(
  payload: AddSavedPeerPayload,
): Promise<PeerConnectResult> {
  return invoke<PeerConnectResult>("add_saved_peer", { payload })
}

export async function removeSavedPeer(
  payload: RemoveSavedPeerPayload,
): Promise<void> {
  return invoke<void>("remove_saved_peer", { payload })
}

export async function connectSavedPeer(
  payload: ConnectSavedPeerPayload,
): Promise<PeerConnectResult> {
  return invoke<PeerConnectResult>("connect_saved_peer", { payload })
}

export async function disconnectPeer(
  payload: DisconnectPeerPayload,
): Promise<void> {
  return invoke<void>("disconnect_peer", { payload })
}

export async function getNetworkGraph(
  payload: GetNetworkGraphPayload,
): Promise<NetworkGraphResponse> {
  return invoke<NetworkGraphResponse>("get_network_graph", { payload })
}

export async function getNodeSettings(
  dataDirectory?: string,
): Promise<NodeSettingsResponse> {
  return invoke<NodeSettingsResponse>("get_node_settings", { dataDirectory })
}

export async function openConfigFile(dataDirectory?: string): Promise<void> {
  return invoke<void>("open_config_file", { dataDirectory })
}

export async function openDataDirectory(dataDirectory?: string): Promise<void> {
  return invoke<void>("open_data_directory", { dataDirectory })
}

export async function updateWalletPassword(
  payload: UpdateWalletPasswordPayload,
): Promise<NodeSettingsResponse> {
  return invoke<NodeSettingsResponse>("update_wallet_password", { payload })
}

export async function switchNetwork(
  payload: SwitchNetworkPayload,
): Promise<NodeSettingsResponse> {
  return invoke<NodeSettingsResponse>("switch_network", { payload })
}

export async function isNetworkProvisioned(network: string): Promise<boolean> {
  return invoke<boolean>("is_network_provisioned", { network })
}

export async function migrateLegacyDataDirectory(
  network: string,
): Promise<string> {
  return invoke<string>("migrate_legacy_data_directory", { network })
}
