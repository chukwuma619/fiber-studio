import { createFileRoute } from "@tanstack/react-router"
import {
  WalletPage,
  type WalletInitialAction,
} from "../../components/wallet/WalletPage"

type WalletSearch = {
  action?: WalletInitialAction
}

export const Route = createFileRoute("/_app/wallet")({
  validateSearch: (search: Record<string, unknown>): WalletSearch => {
    const action = search.action
    if (action === "create-invoice" || action === "send") {
      return { action }
    }
    return {}
  },
  component: WalletRoute,
})

function WalletRoute() {
  const { action } = Route.useSearch()

  return <WalletPage initialAction={action} />
}
