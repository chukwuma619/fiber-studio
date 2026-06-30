import { useCallback, useEffect, useState } from "react"
import { saveSetupConfig } from "../setup/storage"
import type { NetworkChoice, SetupConfig } from "../setup/types"
import {
  getNodeSettings,
  migrateDataDirectory,
  openConfigFile,
  openDataDirectory,
  switchNetwork,
  updateWalletPassword,
} from "./invoke"
import { invalidatePageCaches, PAGE_CACHE_KEYS } from "./pageCache"
import type {
  MigrateDataDirectoryPayload,
  NodeSettingsResponse,
  SwitchNetworkPayload,
  UpdateWalletPasswordPayload,
} from "./types"

function syncSetupConfigFromSettings(
  config: SetupConfig,
  settings: NodeSettingsResponse,
  patch?: Partial<SetupConfig>,
): void {
  saveSetupConfig({
    ...config,
    network: (settings.network as NetworkChoice) ?? config.network,
    dataDirectory: settings.dataDirectory ?? config.dataDirectory,
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
      const data = await getNodeSettings(config?.dataDirectory)
      setSettings(data)
      invalidatePageCaches(PAGE_CACHE_KEYS.settings)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsLoading(false)
    }
  }, [config?.dataDirectory])

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
          PAGE_CACHE_KEYS.wallet,
          PAGE_CACHE_KEYS.channels,
          PAGE_CACHE_KEYS.network,
          PAGE_CACHE_KEYS.settings,
        )
        if (options?.successMessage) {
          setSuccessMessage(options.successMessage)
        }
        return result
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
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
      await openConfigFile(config?.dataDirectory)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error))
    }
  }, [config?.dataDirectory])

  const handleOpenDataDirectory = useCallback(async () => {
    setActionError(null)
    try {
      await openDataDirectory(config?.dataDirectory)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error))
    }
  }, [config?.dataDirectory])

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
          "Network switched. Your old data directory is unchanged — start the node from the new folder.",
        syncConfig: (result) => ({
          network: (result.network as NetworkChoice) ?? payload.network,
          dataDirectory: result.dataDirectory ?? payload.newDataDirectory,
          customPublicNodePubkey: payload.customPublicNodePubkey,
          customPublicNodeMultiaddr: payload.customPublicNodeMultiaddr,
        }),
      }),
    [runMutation],
  )

  const handleMigrateDataDirectory = useCallback(
    (payload: MigrateDataDirectoryPayload) =>
      runMutation(() => migrateDataDirectory(payload), {
        successMessage: "Data directory migrated.",
        syncConfig: (result) => ({
          dataDirectory: result.dataDirectory ?? payload.newDataDirectory,
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
    handleMigrateDataDirectory,
  }
}
