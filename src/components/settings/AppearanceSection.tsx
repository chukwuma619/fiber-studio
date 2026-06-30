import { useState } from "react"
import { applyTheme, getStoredTheme, type Theme } from "../../lib/theme"
import { SegmentedControl } from "../ui/segmented-control"
import { SettingsSection } from "./SettingsSection"

const THEME_OPTIONS = [
  { value: "light" as const, label: "Light" },
  { value: "dark" as const, label: "Dark" },
  { value: "system" as const, label: "System" },
]

export function AppearanceSection() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme())

  const themeLabel =
    theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System"

  function handleThemeChange(next: Theme) {
    setTheme(next)
    applyTheme(next)
  }

  return (
    <SettingsSection title="Appearance">
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Theme</p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Currently {themeLabel.toLowerCase()}
          </p>
        </div>
        <SegmentedControl options={THEME_OPTIONS} value={theme} onChange={handleThemeChange} />
      </div>
    </SettingsSection>
  )
}
