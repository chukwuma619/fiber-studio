import { useNodeControlContext } from "../layout/NodeControlProvider"
import { useSettingsPage } from "../../lib/fnn/useSettingsPage"
import { PageErrorBanner } from "../ui/page-error-banner"
import { Skeleton } from "../ui/skeleton"
import { Heading } from "../ui/heading"
import { Text } from "../ui/text"
import { AppUpdatesSection } from "./AppUpdatesSection"
import { AppearanceSection } from "./AppearanceSection"
import { BackupPathsSection } from "./BackupPathsSection"
import { NodeLifecycleSection } from "./NodeLifecycleSection"
import { NodeSettingsSection } from "./NodeSettingsSection"
import { SettingsSection } from "./SettingsSection"
import { WalletSettingsSection } from "./WalletSettingsSection"

function SettingsSkeleton() {
  return (
    <div className="space-y-8">
      {Array.from({ length: 4 }, (_, index) => (
        <SettingsSection key={index} title="Loading">
          <div className="space-y-3 px-5 py-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </SettingsSection>
      ))}
    </div>
  )
}

export function SettingsPage() {
  const { config, status } = useNodeControlContext()
  const {
    settings,
    isLoading,
    loadError,
    actionError,
    isActing,
    successMessage,
    refresh,
    handleOpenConfig,
    handleOpenDataDirectory,
    handleUpdatePassword,
    handleSwitchNetwork,
  } = useSettingsPage(config)

  const nodeStopped =
    status?.state === "stopped" || status?.state === "error" || !status

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 sm:px-6">
      <div>
        <Heading level={1}>Settings</Heading>
        <Text className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Local fnn on your machine — connect outbound to public relays, no VPS
          required.
        </Text>
      </div>

      {loadError ? (
        <PageErrorBanner message={loadError} onRetry={() => void refresh()} />
      ) : null}

      {actionError ? (
        <PageErrorBanner
          message={actionError}
          onRetry={() => void refresh()}
          retryLabel="Reload settings"
        />
      ) : null}

      {successMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
          {successMessage}
        </div>
      ) : null}

      {isLoading || !settings ? (
        <SettingsSkeleton />
      ) : (
        <>
          <NodeSettingsSection
            settings={settings}
            nodeStopped={nodeStopped}
            isActing={isActing}
            onSwitchNetwork={handleSwitchNetwork}
          />
          <WalletSettingsSection
            settings={settings}
            nodeStopped={nodeStopped}
            isActing={isActing}
            onUpdatePassword={handleUpdatePassword}
          />
          <BackupPathsSection paths={settings.backupPaths} />
          <AppearanceSection />
          <NodeLifecycleSection
            settings={settings}
            onOpenConfig={handleOpenConfig}
            onOpenDataDirectory={handleOpenDataDirectory}
          />
        </>
      )}

      <AppUpdatesSection />
    </div>
  )
}
