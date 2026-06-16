import { createFileRoute } from "@tanstack/react-router"
import { ComingSoonPage } from "../../components/layout/ComingSoonPage"
import { getNavItemById } from "../../lib/nav"

export const Route = createFileRoute("/_app/network")({
  component: NetworkPage,
})

function NetworkPage() {
  const item = getNavItemById("network")

  return <ComingSoonPage title={item.label} description={item.description} />
}
