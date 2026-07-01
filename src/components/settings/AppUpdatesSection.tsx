import { useAppUpdateContext } from "../../lib/updates/AppUpdateProvider"
import { isDesktopApp } from "../../lib/updates/appUpdater"
import { RELEASES_URL } from "../../lib/updates/constants"
import { Button } from "../ui/button"
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from "../ui/description-list"
import { Subheading } from "../ui/heading"
import { Link } from "../ui/link"
import { Text } from "../ui/text"

function formatCheckedAt(value: Date | null): string {
  if (!value) {
    return "Not checked yet"
  }

  return value.toLocaleString()
}

export function AppUpdatesSection() {
  const {
    currentVersion,
    availableUpdate,
    hasPendingUpdate,
    isChecking,
    isInstalling,
    downloadProgress,
    error,
    lastCheckedAt,
    checkForUpdates,
    installUpdate,
    releaseNotesUrl,
  } = useAppUpdateContext()

  if (!isDesktopApp()) {
    return (
      <section className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
        <Subheading level={2}>Updates</Subheading>
        <Text className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          In-app updates are available in the desktop build only.
        </Text>
      </section>
    )
  }

  const statusLabel = hasPendingUpdate
    ? `${availableUpdate?.version} available`
    : lastCheckedAt
      ? "No update found"
      : "Not checked yet"

  return (
    <section className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
      <Subheading level={2}>Updates</Subheading>
      <Text className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Fiber Studio checks for updates after launch. You can also check manually here.
        Installing an update stops your node first, then restarts the app.
      </Text>

      <DescriptionList className="mt-6">
        <DescriptionTerm>Current version</DescriptionTerm>
        <DescriptionDetails>{currentVersion ?? "…"}</DescriptionDetails>
        <DescriptionTerm>Status</DescriptionTerm>
        <DescriptionDetails>{statusLabel}</DescriptionDetails>
        <DescriptionTerm>Last checked</DescriptionTerm>
        <DescriptionDetails>{formatCheckedAt(lastCheckedAt)}</DescriptionDetails>
      </DescriptionList>

      {error ? (
        <Text className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</Text>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          outline
          onClick={() => void checkForUpdates()}
          disabled={isChecking || isInstalling}
        >
          {isChecking ? "Checking…" : "Check for updates"}
        </Button>
        {availableUpdate ? (
          <Button onClick={() => void installUpdate()} disabled={isInstalling}>
            {isInstalling ? "Installing…" : "Install update"}
          </Button>
        ) : null}
      </div>

      {isInstalling && downloadProgress != null ? (
        <Text className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Downloading… {downloadProgress}%
        </Text>
      ) : null}

      <Text className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        {availableUpdate ? (
          <>
            <Link href={releaseNotesUrl(availableUpdate.version)} target="_blank" rel="noreferrer">
              View release notes for v{availableUpdate.version}
            </Link>
            {" · "}
          </>
        ) : null}
        <Link href={RELEASES_URL} target="_blank" rel="noreferrer">
          Browse GitHub Releases
        </Link>
      </Text>
    </section>
  )
}
