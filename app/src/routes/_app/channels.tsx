import { createFileRoute } from "@tanstack/react-router"
import { ChannelsPage } from "../../components/channels/ChannelsPage"

type ChannelsSearch = {
  channel?: string
  action?: "open"
}

export const Route = createFileRoute("/_app/channels")({
  validateSearch: (search: Record<string, unknown>): ChannelsSearch => ({
    channel: typeof search.channel === "string" ? search.channel : undefined,
    action: search.action === "open" ? "open" : undefined,
  }),
  component: ChannelsRoute,
})

function ChannelsRoute() {
  const { channel, action } = Route.useSearch()

  return <ChannelsPage initialChannelId={channel} initialAction={action} />
}
