import { createFileRoute } from "@tanstack/react-router"
import { ChannelsPage } from "../../components/channels/ChannelsPage"

type ChannelsSearch = {
  channel?: string
}

export const Route = createFileRoute("/_app/channels")({
  validateSearch: (search: Record<string, unknown>): ChannelsSearch => ({
    channel: typeof search.channel === "string" ? search.channel : undefined,
  }),
  component: ChannelsRoute,
})

function ChannelsRoute() {
  const { channel } = Route.useSearch()

  return <ChannelsPage initialChannelId={channel} />
}
