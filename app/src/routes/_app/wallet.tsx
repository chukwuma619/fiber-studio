import { createFileRoute, redirect } from "@tanstack/react-router"
import type { WalletInitialAction } from "../../components/wallet/WalletPage"

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
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/payments",
      search,
    })
  },
})
