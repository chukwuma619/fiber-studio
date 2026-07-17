import { ArrowLeftRight, Banknote, Globe, Home, Settings } from 'lucide-react'
import type { ReactNode } from 'react'

import { FiberMark } from '@/component/brand/FiberMark'
import { FiberStudioWordmark } from '@/component/brand/FiberStudioWordmark'
import { Badge } from '@/component/ui/badge'
import { Button } from '@/component/ui/button'
import { StatusDot } from '@/component/ui/status-dot'

export type PreviewNavId = 'Home' | 'Payments' | 'Channels' | 'Network' | 'Settings'

const NAV = [
  { label: 'Home' as const, icon: Home },
  { label: 'Payments' as const, icon: Banknote },
  { label: 'Channels' as const, icon: ArrowLeftRight },
  { label: 'Network' as const, icon: Globe },
  { label: 'Settings' as const, icon: Settings },
]

export function PreviewStatCard({
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
    <div className="rounded-lg bg-white p-6 shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10">
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-950 dark:text-white">
        {value}
        {unit ? (
          <span className="ml-1 text-base font-medium text-zinc-500 dark:text-zinc-400">{unit}</span>
        ) : null}
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{subtext}</p>
    </div>
  )
}

export function AppPreviewShell({
  current,
  children,
  minHeightClassName = 'min-h-[28rem]',
}: {
  current: PreviewNavId
  children: ReactNode
  minHeightClassName?: string
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none overflow-hidden rounded-xl shadow-lg ring-1 ring-zinc-950/10 dark:ring-white/10"
    >
      <div className={`flex bg-zinc-100 dark:bg-zinc-950 ${minHeightClassName}`}>
        <aside className="hidden w-56 shrink-0 flex-col border-r border-zinc-950/5 bg-white sm:flex dark:border-white/5 dark:bg-zinc-900">
          <div className="flex items-center gap-2 border-b border-zinc-950/5 p-4 dark:border-white/5">
            <FiberMark className="size-6 text-zinc-950 dark:text-white" />
            <FiberStudioWordmark layout="inline" />
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 p-4">
            {NAV.map(({ label, icon: Icon }) => {
              const isCurrent = label === current
              return (
                <div
                  key={label}
                  className={
                    isCurrent
                      ? 'relative flex items-center gap-3 rounded-lg bg-zinc-950/5 px-2 py-2 text-sm/5 font-medium text-zinc-950 dark:bg-white/5 dark:text-white'
                      : 'flex items-center gap-3 rounded-lg px-2 py-2 text-sm/5 font-medium text-zinc-950 dark:text-white'
                  }
                >
                  {isCurrent ? (
                    <span className="absolute inset-y-2 -left-4 w-0.5 rounded-full bg-sky-500 dark:bg-sky-400" />
                  ) : null}
                  <Icon
                    className={
                      isCurrent
                        ? 'size-5 shrink-0 text-zinc-950 dark:text-white'
                        : 'size-5 shrink-0 text-zinc-500 dark:text-zinc-400'
                    }
                    aria-hidden
                  />
                  {label}
                </div>
              )
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-col gap-3 border-b border-zinc-950/5 bg-zinc-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/5 dark:bg-zinc-950">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <StatusDot tone="running" />
              <span className="text-sm/5 font-medium text-zinc-950 dark:text-white">
                fnn running
              </span>
              <Badge color="sky">Testnet</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button outline>View logs</Button>
              <Button outline>Stop node</Button>
            </div>
          </div>

          <div className="min-w-0 grow p-4 lg:p-6">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function PreviewPageCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg bg-white p-6 shadow-xs ring-1 ring-zinc-950/10 sm:p-8 dark:bg-zinc-900 dark:ring-white/10">
      {children}
    </div>
  )
}

export function PreviewPageTitle({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl/8 font-semibold tracking-[-0.96px] text-zinc-950 sm:text-xl/8 sm:tracking-[-0.4px] dark:text-white">
          {title}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}
