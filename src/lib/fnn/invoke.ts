import { invoke } from "@tauri-apps/api/core"
import type { SetupConfig } from "../setup/types"
import type {
  AbandonChannelPayload,
  ChannelsPageResponse,
  CompleteSetupPayload,
  CompleteSetupResult,
  CreateInvoicePayload,
  CreateInvoiceResult,
  HomeDashboardResponse,
  NodeStatusResponse,
  OpenChannelPayload,
  OpenChannelResult,
  PreviewSendPaymentResult,
  SendPaymentPayload,
  SendPaymentResult,
  PaymentHashPayload,
  ShutdownChannelPayload,
  StartNodePayload,
  WalletBalanceResponse,
  WalletInvoiceItem,
  WalletPageResponse,
} from "./types"

function toCompleteSetupPayload(config: SetupConfig): CompleteSetupPayload {
  return {
    network: config.network,
    dataDirectory: config.dataDirectory,
    keyFileMode: config.keyFileMode,
    keyFilePath: config.keyFilePath,
    importedPrivateKey: config.importedPrivateKey || undefined,
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
