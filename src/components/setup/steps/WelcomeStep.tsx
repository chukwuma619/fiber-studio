import { Heading } from "../../ui/heading"
import { Text } from "../../ui/text"

const FEATURES = [
  {
    title: "Runs fnn locally",
    description:
      "Start, stop, and monitor your node from a single interface.",
  },
  {
    title: "Keys stay on device",
    description:
      "Your CKB key file is stored under your data directory and encrypted with a password.",
  },
  {
    title: "Public network access",
    description:
      "Use Fiber's recommended relays or connect to any public Fiber node — no VPS required.",
  },
] as const

export function WelcomeStep() {
  return (
    <div className="space-y-6">
      <div>
        <Heading level={2}>Welcome to Fiber Studio</Heading>
        <Text className="mt-2 leading-relaxed">
          Fiber Studio is a local-first desktop app for running and managing your
          Fiber Network Node (fnn). Your CKB keys and wallet data stay on this
          device — nothing is sent to a remote server.
        </Text>
      </div>

      <ul className="space-y-3">
        {FEATURES.map((item) => (
          <li
            key={item.title}
            className="flex gap-3 rounded-lg bg-zinc-950/2.5 px-4 py-3 ring-1 ring-zinc-950/5 dark:bg-white/5 dark:ring-white/10"
          >
            <span
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-white dark:text-zinc-900"
              aria-hidden
            >
              ✓
            </span>
            <div>
              <p className="text-sm font-medium text-zinc-950 dark:text-white">
                {item.title}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {item.description}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
