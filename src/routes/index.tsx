import { createFileRoute, redirect } from "@tanstack/react-router"
import { Heading } from "../components/ui/heading"
import { Text } from "../components/ui/text"
import { getSetupComplete, loadSetupConfig } from "../lib/setup/storage"

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (!getSetupComplete()) {
      throw redirect({ to: "/setup" })
    }
  },
  component: IndexPage,
})

function IndexPage() {
  const config = loadSetupConfig()

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-8">
      <Heading>Fiber Studio</Heading>
      <Text className="mt-2 max-w-md text-center">
        Setup is complete. The main dashboard is coming soon.
      </Text>
      {config ? (
        <Text className="mt-4 text-center text-xs">
          Network: <span className="font-medium">{config.network}</span>
        </Text>
      ) : null}
    </main>
  )
}
