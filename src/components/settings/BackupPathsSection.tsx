import type { BackupPathEntry } from "../../lib/fnn/types"
import { SettingsRow, SettingsRows, SettingsSection } from "./SettingsSection"

type BackupPathsSectionProps = {
  paths: BackupPathEntry[]
}

export function BackupPathsSection({ paths }: BackupPathsSectionProps) {
  return (
    <SettingsSection
      title="Backup paths"
      subtitle="Critical files under your data directory — back up before upgrades"
    >
      <SettingsRows>
        {paths.map((path) => (
          <SettingsRow
            key={path.relativePath}
            label={path.description}
            value={path.relativePath}
            mono
          />
        ))}
      </SettingsRows>
    </SettingsSection>
  )
}
