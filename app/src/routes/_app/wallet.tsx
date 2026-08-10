import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_app/wallet")({
  beforeLoad: () => {
    throw redirect({
      to: "/assets",
    })
  },
})
