import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { DownloadEvent } from "@tauri-apps/plugin-updater"
import { UpdateAvailableDialog } from "../../components/settings/UpdateAvailableDialog"
import {
  checkForAppUpdate,
  getAppVersion,
  installAppUpdate,
  type AppUpdateInfo,
} from "./appUpdater"
import { releaseNotesUrl, UPDATE_CHECK_DELAY_MS } from "./constants"
import {
  dismissForSession,
  isSessionDismissed,
  isVersionSkipped,
  skipVersion,
} from "./updatePreferences"
import { isTauri } from "@tauri-apps/api/core";
import { getErrorMessage } from "../fnn/errors"

export type AppUpdateContextValue = {
  currentVersion: string | null
  availableUpdate: AppUpdateInfo | null
  hasPendingUpdate: boolean
  isChecking: boolean
  isInstalling: boolean
  downloadProgress: number | null
  error: string | null
  lastCheckedAt: Date | null
  checkForUpdates: (options?: { silent?: boolean }) => Promise<AppUpdateInfo | null>
  installUpdate: () => Promise<void>
  dismissUpdate: () => void
  skipUpdate: () => void
  releaseNotesUrl: (version: string) => string
}

const AppUpdateContext = createContext<AppUpdateContextValue | null>(null)

type AppUpdateProviderProps = {
  children: ReactNode
  checkOnLaunch?: boolean
}

export function AppUpdateProvider({
  children,
  checkOnLaunch = true,
}: AppUpdateProviderProps) {
  const checkedOnLaunch = useRef(false)
  const [sessionDismissed, setSessionDismissed] = useState(() => isSessionDismissed())
  const [currentVersion, setCurrentVersion] = useState<string | null>(null)
  const [availableUpdate, setAvailableUpdate] = useState<AppUpdateInfo | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null)

  useEffect(() => {
    if (!isTauri()) {
      return
    }

    void getAppVersion().then(setCurrentVersion)
  }, [])

  const checkForUpdates = useCallback(async (options?: { silent?: boolean }) => {
    if (!isTauri()) {
      return null
    }

    setIsChecking(true)
    if (!options?.silent) {
      setError(null)
    }

    try {
      const update = await checkForAppUpdate()
      setAvailableUpdate(update)
      setLastCheckedAt(new Date())
      return update
    } catch (checkError) {
      if (!options?.silent) {
        const message =
          getErrorMessage(checkError)
        setError(message)
      }
      return null
    } finally {
      setIsChecking(false)
    }
  }, [])

  const installUpdate = useCallback(async () => {
    if (!availableUpdate) {
      return
    }

    setIsInstalling(true)
    setError(null)
    setDownloadProgress(null)

    try {
      let downloaded = 0
      let contentLength: number | undefined

      await installAppUpdate(availableUpdate.update, (event: DownloadEvent) => {
        switch (event.event) {
          case "Started":
            downloaded = 0
            contentLength = event.data.contentLength
            setDownloadProgress(0)
            break
          case "Progress":
            downloaded += event.data.chunkLength
            if (contentLength && contentLength > 0) {
              setDownloadProgress(
                Math.min(100, Math.round((downloaded / contentLength) * 100)),
              )
            }
            break
          case "Finished":
            setDownloadProgress(100)
            break
          default: {
            const _exhaustive: never = event
            return _exhaustive
          }
        }
      })
    } catch (installError) {
      const message =
        getErrorMessage(installError)
      setError(message)
      setIsInstalling(false)
    }
  }, [availableUpdate])

  const dismissUpdate = useCallback(() => {
    dismissForSession()
    setSessionDismissed(true)
  }, [])

  const skipUpdate = useCallback(() => {
    if (availableUpdate) {
      skipVersion(availableUpdate.version)
    }
    dismissForSession()
    setSessionDismissed(true)
  }, [availableUpdate])

  useEffect(() => {
    if (!checkOnLaunch || checkedOnLaunch.current || !isTauri()) {
      return
    }

    checkedOnLaunch.current = true

    const timeout = window.setTimeout(() => {
      void checkForUpdates({ silent: true })
    }, UPDATE_CHECK_DELAY_MS)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [checkOnLaunch, checkForUpdates])

  const shouldShowPrompt = Boolean(
    availableUpdate &&
      !sessionDismissed &&
      !isVersionSkipped(availableUpdate.version),
  )

  const value = useMemo<AppUpdateContextValue>(
    () => ({
      currentVersion,
      availableUpdate,
      hasPendingUpdate: availableUpdate != null,
      isChecking,
      isInstalling,
      downloadProgress,
      error,
      lastCheckedAt,
      checkForUpdates,
      installUpdate,
      dismissUpdate,
      skipUpdate,
      releaseNotesUrl,
    }),
    [
      availableUpdate,
      checkForUpdates,
      currentVersion,
      dismissUpdate,
      downloadProgress,
      error,
      installUpdate,
      isChecking,
      isInstalling,
      lastCheckedAt,
      skipUpdate,
    ],
  )

  return (
    <AppUpdateContext.Provider value={value}>
      {children}
      {isTauri() ? (
        <UpdateAvailableDialog
          open={shouldShowPrompt}
          update={availableUpdate}
          isInstalling={isInstalling}
          downloadProgress={downloadProgress}
          error={error}
          onInstall={() => void installUpdate()}
          onDismiss={dismissUpdate}
          onSkip={skipUpdate}
        />
      ) : null}
    </AppUpdateContext.Provider>
  )
}

export function useAppUpdateContext(): AppUpdateContextValue {
  const value = useContext(AppUpdateContext)
  if (!value) {
    throw new Error("useAppUpdateContext must be used within AppUpdateProvider")
  }
  return value
}
