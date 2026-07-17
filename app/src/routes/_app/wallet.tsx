import { createFileRoute, redirect } from "@tanstack/react-router"
import type { PaymentsInitialAction } from "../../components/payments/PaymentsPage"

type WalletSearch = {
  action?: PaymentsInitialAction
}

export const Route = createFileRoute("/_app/wallet")({
  validateSearch: (search: Record<string, unknown>): WalletSearch => {
    const action = search.action
    if (action === "create-invoice" || action === "send") {
      return { action }
    }
    return {}
  },
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/payments",
      search,
    })
  },
})
