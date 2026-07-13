import clsx from "clsx"
import type { CSSProperties } from "react"

type SkeletonProps = {
  className?: string
  style?: CSSProperties
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={clsx(
        "animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800",
        className,
      )}
      style={style}
      aria-hidden
    />
  )
}

type TableRowsSkeletonProps = {
  rows?: number
  cols?: number
}

export function TableRowsSkeleton({ rows = 3, cols = 4 }: TableRowsSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: cols }, (_, colIndex) => (
            <td key={colIndex} className="px-4 py-3">
              <Skeleton className="h-4 w-full max-w-[8rem]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

type ActivityListSkeletonProps = {
  rows?: number
}

export function ActivityListSkeleton({ rows = 3 }: ActivityListSkeletonProps) {
  return (
    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex items-start gap-4 px-5 py-4">
          <Skeleton className="mt-1.5 size-2 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </li>
      ))}
    </ul>
  )
}
