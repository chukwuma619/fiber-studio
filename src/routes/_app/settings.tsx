import { createFileRoute } from "@tanstack/react-router"
import { AppUpdatesSection } from "../../components/settings/AppUpdatesSection"
import { Heading } from "../../components/ui/heading"
import { Text } from "../../components/ui/text"

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
})

function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 sm:px-6">
      <div>
        <Heading level={1}>Settings</Heading>
        <Text className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          App preferences and maintenance.
        </Text>
      </div>

      <AppUpdatesSection />
    </div>
  )
}
