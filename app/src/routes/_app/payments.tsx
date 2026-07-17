import { createFileRoute } from "@tanstack/react-router"
import {
  PaymentsPage,
  type PaymentsInitialAction,
} from "../../components/payments/PaymentsPage"

type PaymentsSearch = {
  action?: PaymentsInitialAction
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

  return <PaymentsPage initialAction={action} />
}
