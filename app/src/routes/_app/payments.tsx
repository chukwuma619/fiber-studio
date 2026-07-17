import { createFileRoute } from "@tanstack/react-router"
import {
  WalletPage,
  type WalletInitialAction,
} from "../../components/wallet/WalletPage"

type PaymentsSearch = {
  action?: WalletInitialAction
}

export const Route = createFileRoute("/_app/payments")({
  validateSearch: (search: Record<string, unknown>): PaymentsSearch => {
    const action = search.action
    if (action === "create-invoice" || action === "send") {
      return { action }
    }
    return {}
  },
  component: PaymentsRoute,
})

function PaymentsRoute() {
  const { action } = Route.useSearch()

  return <WalletPage initialAction={action} />
}
