import { createFileRoute } from "@tanstack/react-router"
import { ComingSoonPage } from "../../components/layout/ComingSoonPage"
import { getNavItemById } from "../../lib/nav"

export const Route = createFileRoute("/_app/")({
  component: HomePage,
})

function HomePage() {
  const item = getNavItemById("home")

  return <ComingSoonPage title={item.label} description={item.description} />
}
