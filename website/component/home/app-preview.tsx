import { Badge } from '@/component/ui/badge'
import { Button } from '@/component/ui/button'
import { CapacityBar } from '@/component/ui/capacity-bar'
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from '@/component/ui/description-list'
import { StatusDot } from '@/component/ui/status-dot'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/component/ui/table'
import {
  AppPreviewShell,
  PreviewPageCard,
  PreviewPageTitle,
  PreviewStatCard,
} from '@/component/home/preview-shell'

const DEMO_CHANNELS = [
  {
    peer: '03a1b2…9f4e',
    capacity: '2,000',
    localPercent: 62,
    status: 'Active' as const,
    statusColor: 'green' as const,
  },
  {
    peer: '02c8d4…1a70',
    capacity: '1,500',
    localPercent: 11,
    status: 'Low' as const,
    statusColor: 'amber' as const,
  },
]

/** Static visual clone of the desktop app Home screen. */
export function AppPreview() {
  return (
    <AppPreviewShell current="Home">
      <PreviewPageCard>
        <div className="space-y-8">
          <PreviewPageTitle
            title="Home"
            subtitle="Off-chain CKB payments on the Fiber network."
            actions={
              <>
                <Button>Send payment</Button>
                <Button outline>Create invoice</Button>
              </>
            }
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <PreviewStatCard
              label="Local balance"
              value="1,240.5"
              unit="CKB"
              subtext="Across active channels"
            />
            <PreviewStatCard
              label="Active channels"
              value="2"
              subtext="2 active · 0 pending"
            />
            <PreviewStatCard
              label="Connected peers"
              value="4"
              subtext="4 peer connections"
            />
            <PreviewStatCard
              label="Pending channels"
              value="0"
              subtext="No channels opening"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <section className="min-w-0 overflow-hidden rounded-lg bg-white shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10">
              <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                <h3 className="text-base/7 font-semibold tracking-[-0.32px] text-zinc-950 sm:text-sm/6 sm:tracking-[-0.28px] dark:text-white">
                  Channel liquidity
                </h3>
                <Button plain className="text-xs">
                  View all
                </Button>
              </div>
              <Table dense>
                <TableHead>
                  <TableRow>
                    <TableHeader className="w-10">S/N</TableHeader>
                    <TableHeader>Peer</TableHeader>
                    <TableHeader>Capacity</TableHeader>
                    <TableHeader>Liquidity</TableHeader>
                    <TableHeader>Status</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {DEMO_CHANNELS.map((channel, index) => (
                    <TableRow key={channel.peer}>
                      <TableCell className="tabular-nums text-zinc-500 dark:text-zinc-400">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-mono text-zinc-600 dark:text-zinc-400">
                        {channel.peer}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {channel.capacity} CKB
                      </TableCell>
                      <TableCell>
                        <CapacityBar percent={channel.localPercent} />
                      </TableCell>
                      <TableCell>
                        <Badge color={channel.statusColor}>{channel.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>

            <section className="min-w-0 rounded-lg bg-white p-6 shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10">
              <h3 className="text-base/7 font-semibold tracking-[-0.32px] text-zinc-950 sm:text-sm/6 sm:tracking-[-0.28px] dark:text-white">
                Node status
              </h3>
              <DescriptionList className="mt-4">
                <DescriptionTerm>Status</DescriptionTerm>
                <DescriptionDetails>
                  <span className="inline-flex items-center gap-1.5">
                    <StatusDot tone="running" />
                    Running
                  </span>
                </DescriptionDetails>
                <DescriptionTerm>fnn version</DescriptionTerm>
                <DescriptionDetails>0.9.0-rc7</DescriptionDetails>
                <DescriptionTerm>Node pubkey</DescriptionTerm>
                <DescriptionDetails className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                  02a7c3…e91b
                </DescriptionDetails>
                <DescriptionTerm>RPC</DescriptionTerm>
                <DescriptionDetails className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                  127.0.0.1:8227
                </DescriptionDetails>
              </DescriptionList>
            </section>
          </div>
        </div>
      </PreviewPageCard>
    </AppPreviewShell>
  )
}
