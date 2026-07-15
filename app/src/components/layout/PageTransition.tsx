import { useRouterState } from '@tanstack/react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { pageEnter } from '../../lib/motion'

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const reduceMotion = useReducedMotion()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={reduceMotion ? false : pageEnter.initial}
        animate={pageEnter.animate}
        exit={reduceMotion ? undefined : pageEnter.exit}
        transition={pageEnter.transition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
