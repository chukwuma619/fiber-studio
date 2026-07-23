/** Geist ease — matches `--ease-geist` in globals.css. */
export const easeGeist = [0.175, 0.885, 0.32, 1.1] as const

/** Page hero / header enter. */
export const pageHeaderEnter = {
  duration: 0.2,
  ease: easeGeist,
} as const

/** Follow-up block under a page header. */
export const pageBodyEnter = {
  duration: 0.25,
  delay: 0.05,
  ease: easeGeist,
} as const

/** Scroll-in cards / sections (no built-in delay). */
export const sectionCardEnter = {
  duration: 0.25,
  ease: easeGeist,
} as const

/** Stagger between scroll-in cards (30–80ms). */
export function sectionCardDelay(index: number) {
  return index * 0.05
}

export function fadeUp(distancePx: number, reduceMotion: boolean | null) {
  if (reduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
    } as const
  }

  return {
    initial: { opacity: 0, transform: `translateY(${distancePx}px)` },
    animate: { opacity: 1, transform: 'translateY(0px)' },
  } as const
}
