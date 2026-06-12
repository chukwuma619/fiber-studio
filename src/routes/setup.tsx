import { createFileRoute, redirect } from "@tanstack/react-router"
import { SetupWizard } from "../components/setup/SetupWizard"
import { getSetupComplete } from "../lib/setup/storage"

export const Route = createFileRoute("/setup")({
  beforeLoad: () => {
    if (getSetupComplete()) {
      throw redirect({ to: "/" })
    }
  },
  component: SetupPage,
})

function SetupPage() {
  return <SetupWizard />
}
