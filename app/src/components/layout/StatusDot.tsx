import clsx from 'clsx'

export type StatusDotTone = 'running' | 'stopped' | 'warning' | 'danger' | 'info'

const TONE_CLASS: Record<StatusDotTone, string> = {
  running: 'bg-sky-500 dark:bg-sky-400',
  stopped: 'bg-zinc-400 dark:bg-zinc-500',
  warning: 'bg-amber-500 dark:bg-amber-400',
  danger: 'bg-red-500 dark:bg-red-400',
  info: 'bg-sky-400 dark:bg-sky-500',
}

export function StatusDot({ tone }: { tone: StatusDotTone }) {
  return (
    <span
      className={clsx('inline-block size-2 shrink-0 rounded-full', TONE_CLASS[tone])}
      aria-hidden
    />
  )
}
