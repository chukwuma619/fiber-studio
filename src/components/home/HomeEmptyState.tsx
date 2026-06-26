import { Button } from "../ui/button"
import { Text } from "../ui/text"

type HomeEmptyStateProps = {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function HomeEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: HomeEmptyStateProps) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="text-sm font-medium text-zinc-950 dark:text-white">{title}</p>
      <Text className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {description}
      </Text>
      {actionLabel && onAction ? (
        <div className="mt-4">
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      ) : null}
    </div>
  )
}
