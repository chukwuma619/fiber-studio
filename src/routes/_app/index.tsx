import { createFileRoute } from "@tanstack/react-router"
import { ComingSoonPage } from "../../components/layout/ComingSoonPage"
import { getNavItemById } from "../../lib/nav"

export const Route = createFileRoute("/_app/")({
  component: DashboardPage,
})

function DashboardPage() {
  const item = getNavItemById("dashboard")

  return <ComingSoonPage title={item.label} description={item.description} />
}
