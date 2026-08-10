import { createFileRoute } from "@tanstack/react-router"
import { AssetsPage } from "../../components/assets/AssetsPage"

export const Route = createFileRoute("/_app/assets")({
  component: AssetsRoute,
})

function AssetsRoute() {
  return <AssetsPage />
}
