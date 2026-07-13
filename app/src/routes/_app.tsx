import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { HomeLayout } from "../components/layout/HomeLayout"
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
    <HomeLayout>
      <Outlet />
    </HomeLayout>
  )
}
