import { invoke } from "@tauri-apps/api/core"
import type { SetupConfig } from "../setup/types"
import type {
  CompleteSetupPayload,
  CompleteSetupResult,
  NodeStatusResponse,
  StartNodePayload,
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
