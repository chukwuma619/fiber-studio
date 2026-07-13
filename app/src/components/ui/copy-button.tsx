import { useCallback, useEffect, useState } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "./button"

type CopyButtonProps = {
  value: string
  label?: string
  className?: string
}

export function CopyButton({ value, label = "Copy", className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timeout = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timeout)
  }, [copied])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }, [value])

  return (
    <Button
      plain
      type="button"
      className={className}
      onClick={() => void handleCopy()}
      aria-label={copied ? "Copied" : label}
    >
      {copied ? (
        <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="size-4" />
      )}
    </Button>
  )
}
