import { ArrowLeftRight, Globe, Home, Settings, Wallet } from 'lucide-react'
import { FiberMark } from '@/component/brand/FiberMark'
import { FiberStudioWordmark } from '@/component/brand/FiberStudioWordmark'
import { Badge } from '@/component/ui/badge'
import { Button } from '@/component/ui/button'
import { CapacityBar } from '@/component/ui/capacity-bar'
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from '@/component/ui/description-list'
import { Heading, Subheading } from '@/component/ui/heading'
import { StatusDot } from '@/component/ui/status-dot'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/component/ui/table'
import { Text } from '@/component/ui/text'

/**
 * Static visual clone of the desktop app Home screen (SidebarLayout + HomePage).
 * Labels, layout, and chrome match the Tauri app — demo numbers only.
 */
const NAV = [
  { label: 'Home', icon: Home, current: true },
  { label: 'Wallet', icon: Wallet, current: false },
  { label: 'Channels', icon: ArrowLeftRight, current: false },
  { label: 'Network', icon: Globe, current: false },
  { label: 'Settings', icon: Settings, current: false },
] as const

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

function PreviewStatCard({
  label,
  value,
  unit,
  subtext,
}: {
  label: string
  value: string
  unit?: string
  subtext: string
}) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-950 dark:text-white">
        {value}
        {unit ? (
          <span className="ml-1 text-base font-medium text-zinc-500 dark:text-zinc-400">{unit}</span>
        ) : null}
      </p>
      <Text className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{subtext}</Text>
    </div>
  )
}

export function AppPreview() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none overflow-hidden rounded-xl shadow-xl ring-1 ring-zinc-950/10 dark:ring-white/10"
    >
      <div className="flex min-h-[28rem] bg-zinc-100 dark:bg-zinc-950">
        {/* Sidebar — mirrors AppSidebar */}
        <aside className="hidden w-56 shrink-0 flex-col border-r border-zinc-950/5 bg-white sm:flex dark:border-white/5 dark:bg-zinc-900">
          <div className="flex items-center gap-2 border-b border-zinc-950/5 p-4 dark:border-white/5">
            <FiberMark className="size-6 text-zinc-950 dark:text-white" />
            <FiberStudioWordmark layout="inline" />
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 p-4">
            {NAV.map(({ label, icon: Icon, current }) => (
              <div
                key={label}
                className={
                  current
                    ? 'relative flex items-center gap-3 rounded-lg bg-zinc-950/5 px-2 py-2 text-sm/5 font-medium text-zinc-950 dark:bg-white/5 dark:text-white'
                    : 'flex items-center gap-3 rounded-lg px-2 py-2 text-sm/5 font-medium text-zinc-950 dark:text-white'
                }
              >
                {current ? (
                  <span className="absolute inset-y-2 -left-4 w-0.5 rounded-full bg-zinc-950 dark:bg-white" />
                ) : null}
                <Icon
                  className={
                    current
                      ? 'size-5 shrink-0 text-zinc-950 dark:text-white'
                      : 'size-5 shrink-0 text-zinc-500 dark:text-zinc-400'
                  }
                  aria-hidden
                />
                {label}
              </div>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header — mirrors AppHeader */}
          <div className="flex flex-col gap-3 border-b border-zinc-950/5 bg-zinc-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/5 dark:bg-zinc-950">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <StatusDot tone="running" />
              <span className="text-sm/5 font-medium text-zinc-950 dark:text-white">
                fnn running
              </span>
              <Badge color="zinc">Testnet</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button outline>View logs</Button>
              <Button outline>Stop node</Button>
            </div>
          </div>

          {/* Main — mirrors HomePage inside SidebarLayout content card */}
          <div className="min-w-0 grow p-4 lg:p-6">
            <div className="rounded-lg bg-white p-5 shadow-xs ring-1 ring-zinc-950/5 sm:p-8 dark:bg-zinc-900 dark:ring-white/10">
              <div className="space-y-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <Heading level={1}>Home</Heading>
                    <Text className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      Off-chain CKB payments on the Fiber network.
                    </Text>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button>Send payment</Button>
                    <Button outline>Create invoice</Button>
                  </div>
                </div>

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
                  <section className="min-w-0 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
                    <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                      <Subheading level={3}>Channel liquidity</Subheading>
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

                  <section className="min-w-0 rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
                    <Subheading level={3}>Node status</Subheading>
                    <DescriptionList className="mt-4">
                      <DescriptionTerm>Status</DescriptionTerm>
                      <DescriptionDetails>
                        <span className="inline-flex items-center gap-1.5">
                          <StatusDot tone="running" />
                          Running
                        </span>
                      </DescriptionDetails>
                      <DescriptionTerm>fnn version</DescriptionTerm>
                      <DescriptionDetails>0.8.1</DescriptionDetails>
                      <DescriptionTerm>Node pubkey</DescriptionTerm>
                      <DescriptionDetails className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        02a7c3…e91b
                      </DescriptionDetails>
                      <DescriptionTerm>Saved peers</DescriptionTerm>
                      <DescriptionDetails>
                        Saved peers connected (outbound)
                      </DescriptionDetails>
                      <DescriptionTerm>RPC</DescriptionTerm>
                      <DescriptionDetails className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        127.0.0.1:8227
                      </DescriptionDetails>
                    </DescriptionList>
                    <div className="mt-5 flex gap-2">
                      <Button outline className="flex-1 text-xs">
                        Node settings
                      </Button>
                      <Button plain className="flex-1 text-xs">
                        View logs
                      </Button>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
