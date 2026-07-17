import { useEffect, useState } from "react"
import {
  applyLaunchAtLoginPreference,
  applyStartNodeOnLaunchPreference,
  readStartNodeOnLaunchPreference,
  syncLaunchAtLoginPreference,
} from "../../lib/autostart"
import { Switch, SwitchField } from "../ui/switch"
import { SettingsSection } from "./SettingsSection"

export function BackgroundSection() {
  const [startNodeOnLaunch, setStartNodeOnLaunch] = useState(
    () => readStartNodeOnLaunchPreference(),
  )
  const [launchAtLogin, setLaunchAtLogin] = useState(false)
  const [isSyncingLogin, setIsSyncingLogin] = useState(true)
  const [loginError, setLoginError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const active = await syncLaunchAtLoginPreference()
        if (!cancelled) {
          setLaunchAtLogin(active)
        }
      } catch (error) {
        if (!cancelled) {
          setLoginError(
            error instanceof Error ? error.message : "Failed to sync login preference.",
          )
        }
      } finally {
        if (!cancelled) {
          setIsSyncingLogin(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleStartNodeOnLaunchChange(enabled: boolean) {
    setStartNodeOnLaunch(enabled)
    applyStartNodeOnLaunchPreference(enabled)
  }

  async function handleLaunchAtLoginChange(enabled: boolean) {
    setLoginError(null)
    setIsSyncingLogin(true)
    try {
      await applyLaunchAtLoginPreference(enabled)
      setLaunchAtLogin(enabled)
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : "Failed to update login preference.",
      )
    } finally {
      setIsSyncingLogin(false)
    }
  }

  return (
    <SettingsSection title="Background">
      <div className="space-y-1 px-5 py-4">
        <SwitchField>
          <span data-slot="label" className="text-sm text-zinc-900 dark:text-zinc-100">
            Start node when Fiber Studio opens
          </span>
          <span data-slot="description" className="text-xs text-zinc-500 dark:text-zinc-400">
            Automatically start fnn after setup is complete.
          </span>
          <Switch
            data-slot="control"
            color="dark/zinc"
            checked={startNodeOnLaunch}
            onChange={(enabled) => {
              void handleStartNodeOnLaunchChange(enabled)
            }}
          />
        </SwitchField>

        <SwitchField>
          <span data-slot="label" className="text-sm text-zinc-900 dark:text-zinc-100">
            Open Fiber Studio at login
          </span>
          <span data-slot="description" className="text-xs text-zinc-500 dark:text-zinc-400">
            Keep Fiber Studio available in the background after you sign in.
          </span>
          <Switch
            data-slot="control"
            color="dark/zinc"
            checked={launchAtLogin}
            disabled={isSyncingLogin}
            onChange={(enabled) => {
              if (!isSyncingLogin) {
                void handleLaunchAtLoginChange(enabled)
              }
            }}
          />
        </SwitchField>

        {loginError ? (
          <p className="text-xs text-red-600 dark:text-red-400">{loginError}</p>
        ) : null}
      </div>
    </SettingsSection>
  )
}
