'use client'

import clsx from 'clsx'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

const options = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const active = mounted ? (theme ?? 'system') : 'system'

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={clsx(
        'inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800',
        className,
      )}
    >
      {options.map((option) => {
        const Icon = option.icon
        const selected = active === option.value

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            title={option.label}
            disabled={!mounted}
            onClick={() => setTheme(option.value)}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
              selected
                ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-700 dark:text-white'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200',
            )}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            <span className="max-sm:sr-only">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
