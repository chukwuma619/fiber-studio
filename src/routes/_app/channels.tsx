import { createFileRoute } from "@tanstack/react-router"
import { ComingSoonPage } from "../../components/layout/ComingSoonPage"
import { getNavItemById } from "../../lib/nav"

export const Route = createFileRoute("/_app/channels")({
  component: ChannelsPage,
})

function ChannelsPage() {
  const item = getNavItemById("channels")

  return <ComingSoonPage title={item.label} description={item.description} />
}
