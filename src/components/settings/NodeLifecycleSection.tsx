import type { NodeSettingsResponse } from "../../lib/fnn/types"
import { Button } from "../ui/button"
import { SettingsSection } from "./SettingsSection"

type NodeLifecycleSectionProps = {
  settings: NodeSettingsResponse
  onOpenConfig: () => void
  onOpenDataDirectory: () => void
}

export function NodeLifecycleSection({
  settings,
  onOpenConfig,
  onOpenDataDirectory,
}: NodeLifecycleSectionProps) {
  const canOpenConfig = Boolean(settings.configFilePath)
  const canOpenDataDirectory = Boolean(settings.dataDirectory)

  return (
    <SettingsSection title="Node lifecycle">
      <div className="flex flex-wrap gap-2 px-5 py-4">
        <Button
          outline
          className="text-xs"
          disabled={!canOpenConfig}
          onClick={() => void onOpenConfig()}
        >
          Open config.yml
        </Button>
        <Button
          outline
          className="text-xs"
          disabled={!canOpenDataDirectory}
          onClick={() => void onOpenDataDirectory()}
        >
          Open data directory
        </Button>
      </div>
      {settings.nodeStatus.state === "error" ? (
        <p className="border-t border-zinc-200 px-5 py-3 text-xs text-red-600 dark:border-zinc-800 dark:text-red-400">
          {settings.nodeStatus.message}
        </p>
      ) : null}
    </SettingsSection>
  )
}
