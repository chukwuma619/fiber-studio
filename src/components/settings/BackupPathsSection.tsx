import type { BackupPathEntry } from "../../lib/fnn/types"
import { SettingsRow, SettingsRows, SettingsSection } from "./SettingsSection"

type BackupPathsSectionProps = {
  paths: BackupPathEntry[]
}

export function BackupPathsSection({ paths }: BackupPathsSectionProps) {
  return (
    <SettingsSection
      title="Backup paths"
      subtitle="Back up these files before app updates, network switches, or reinstalling."
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
