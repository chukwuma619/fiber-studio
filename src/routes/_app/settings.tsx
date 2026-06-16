import { createFileRoute } from "@tanstack/react-router"
import { ComingSoonPage } from "../../components/layout/ComingSoonPage"
import { getNavItemById } from "../../lib/nav"

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
})

function SettingsPage() {
  const item = getNavItemById("settings")

  return <ComingSoonPage title={item.label} description={item.description} />
}
