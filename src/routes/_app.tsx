import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { DashboardLayout } from "../components/layout/DashboardLayout"
import { getSetupComplete } from "../lib/setup/storage"

export const Route = createFileRoute("/_app")({
  beforeLoad: () => {
    if (!getSetupComplete()) {
      throw redirect({ to: "/setup" })
    }
  },
  component: AppLayout,
})

function AppLayout() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  )
}
