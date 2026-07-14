import clsx from 'clsx'

type FiberStudioWordmarkProps = {
  className?: string
  layout?: 'inline' | 'stacked' | 'display'
}

export function FiberStudioWordmark({
  className,
  layout = 'stacked',
}: FiberStudioWordmarkProps) {
  if (layout === 'display') {
    return (
      <h1
        className={clsx(
          'text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl dark:text-white',
          className
        )}
      >
        <span className="font-semibold">Fiber</span>{' '}
        <span className="font-normal text-zinc-500 dark:text-zinc-400">Studio</span>
      </h1>
    )
  }

  const wordmark = (
    <>
      <span className="font-semibold">Fiber</span>{' '}
      <span className="font-normal text-zinc-500 dark:text-zinc-400">Studio</span>
    </>
  )

  if (layout === 'inline') {
    return (
      <span className={clsx('text-sm/5 font-medium text-zinc-950 dark:text-white', className)}>
        {wordmark}
      </span>
    )
  }

  return (
    <div className={className}>
      <p className="text-sm font-medium leading-tight text-zinc-950 dark:text-white">{wordmark}</p>
    </div>
  )
}
