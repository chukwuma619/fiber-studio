import { createFileRoute } from "@tanstack/react-router"
import { ComingSoonPage } from "../../components/layout/ComingSoonPage"
import { getNavItemById } from "../../lib/nav"

export const Route = createFileRoute("/_app/wallet")({
  component: WalletPage,
})

function WalletPage() {
  const item = getNavItemById("wallet")

  return <ComingSoonPage title={item.label} description={item.description} />
}
