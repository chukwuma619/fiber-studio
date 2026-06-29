import { createFileRoute } from "@tanstack/react-router"
import { NetworkPage } from "../../components/network/NetworkPage"

export const Route = createFileRoute("/_app/network")({
  component: NetworkPage,
})
