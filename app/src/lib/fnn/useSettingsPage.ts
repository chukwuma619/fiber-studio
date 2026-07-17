import { useCallback, useEffect, useState } from "react"
import {
  getDataDirectoryDisplayForNetwork,
  resolveConfiguredDataDirectory,
} from "../data-directory"
import { saveSetupConfig } from "../setup/storage"
import type { NetworkChoice, SetupConfig } from "../setup/types"
import { getErrorMessage } from "./errors"
import {
  getNodeSettings,
  openConfigFile,
  openDataDirectory,
  switchNetwork,
  updateWalletPassword,
} from "./invoke"
import { invalidatePageCaches, PAGE_CACHE_KEYS } from "./pageCache"
import type {
  NodeSettingsResponse,
  SwitchNetworkPayload,
  UpdateWalletPasswordPayload,
} from "./types"

function syncSetupConfigFromSettings(
  config: SetupConfig,
  settings: NodeSettingsResponse,
  patch?: Partial<SetupConfig>,
): void {
  const network = (settings.network as NetworkChoice) ?? config.network
  saveSetupConfig({
    ...config,
    network,
    dataDirectory: getDataDirectoryDisplayForNetwork(network),
    ...patch,
  })
}

export function useSettingsPage(config: SetupConfig | null) {
  const [settings, setSettings] = useState<NodeSettingsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isActing, setIsActing] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoadError(null)
    try {
      const dataDirectory = await resolveConfiguredDataDirectory(config?.network)
      const data = await getNodeSettings(dataDirectory)
      setSettings(data)
      invalidatePageCaches(PAGE_CACHE_KEYS.settings)
    } catch (error) {
      setLoadError(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [config?.network])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const runMutation = useCallback(
    async (
      action: () => Promise<NodeSettingsResponse>,
      options?: {
        successMessage?: string
        syncConfig?: (settings: NodeSettingsResponse) => Partial<SetupConfig> | void
      },
    ) => {
      setIsActing(true)
      setActionError(null)
      setSuccessMessage(null)
      try {
        const result = await action()
        setSettings(result)
        if (config) {
          const patch = options?.syncConfig?.(result)
          syncSetupConfigFromSettings(config, result, patch ?? undefined)
        }
        invalidatePageCaches(
          PAGE_CACHE_KEYS.home,
          PAGE_CACHE_KEYS.payments,
          PAGE_CACHE_KEYS.channels,
          PAGE_CACHE_KEYS.network,
          PAGE_CACHE_KEYS.settings,
        )
        if (options?.successMessage) {
          setSuccessMessage(options.successMessage)
        }
        return result
      } catch (error) {
        const message = getErrorMessage(error)
        setActionError(message)
        throw error
      } finally {
        setIsActing(false)
      }
    },
    [config],
  )

  const handleOpenConfig = useCallback(async () => {
    setActionError(null)
    try {
      const dataDirectory = await resolveConfiguredDataDirectory(config?.network)
      await openConfigFile(dataDirectory)
    } catch (error) {
      setActionError(getErrorMessage(error))
    }
  }, [config?.network])

  const handleOpenDataDirectory = useCallback(async () => {
    setActionError(null)
    try {
      const dataDirectory = await resolveConfiguredDataDirectory(config?.network)
      await openDataDirectory(dataDirectory)
    } catch (error) {
      setActionError(getErrorMessage(error))
    }
  }, [config?.network])

  const handleUpdatePassword = useCallback(
    (payload: UpdateWalletPasswordPayload) =>
      runMutation(() => updateWalletPassword(payload), {
        successMessage: "Wallet password updated.",
      }),
    [runMutation],
  )

  const handleSwitchNetwork = useCallback(
    (payload: SwitchNetworkPayload) =>
      runMutation(() => switchNetwork(payload), {
        successMessage:
          "Network switched. Start the node to use the other network's data folder.",
        syncConfig: (result) => ({
          network: (result.network as NetworkChoice) ?? payload.network,
          customPublicNodePubkey: payload.customPublicNodePubkey,
          customPublicNodeMultiaddr: payload.customPublicNodeMultiaddr,
        }),
      }),
    [runMutation],
  )

  return {
    settings,
    isLoading,
    loadError,
    actionError,
    isActing,
    successMessage,
    clearActionError: () => setActionError(null),
    clearSuccessMessage: () => setSuccessMessage(null),
    refresh,
    handleOpenConfig,
    handleOpenDataDirectory,
    handleUpdatePassword,
    handleSwitchNetwork,
  }
}
