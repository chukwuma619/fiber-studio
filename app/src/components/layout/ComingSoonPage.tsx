import { Badge } from "../ui/badge"
import { Heading } from "../ui/heading"
import { Text } from "../ui/text"

type ComingSoonPageProps = {
  title: string
  description: string
}

export function ComingSoonPage({ title, description }: ComingSoonPageProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <Badge color="zinc">Coming soon</Badge>
      <Heading level={1} className="mt-4">
        {title}
      </Heading>
      <Text className="mt-2 max-w-md leading-relaxed text-zinc-500 dark:text-zinc-400">
        {description}
      </Text>
    </div>
  )
}
