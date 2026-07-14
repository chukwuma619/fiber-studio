'use client'

import { motion } from 'motion/react'

import { Divider } from '@/component/ui/divider'

const STEPS = [
  {
    step: '01',
    title: 'Install',
    description: 'Download Fiber Studio and open it on your computer.',
  },
  {
    step: '02',
    title: 'Set up',
    description: 'Follow the guided setup to run the official Fiber node.',
  },
  {
    step: '03',
    title: 'Send and receive',
    description: 'Move payments from the app — no command line required.',
  },
] as const

export function HowItWorks() {
  return (
    <section className="pt-16 sm:pt-20">
      <Divider soft />
      <div className="pt-16 sm:pt-20">
        <h2 className="text-2xl/8 font-semibold tracking-[-0.96px] text-zinc-950 sm:text-[32px]/[40px] sm:tracking-[-1.28px] dark:text-white">
          How it works
        </h2>
        <p className="mt-4 max-w-xl text-base/6 text-zinc-600 sm:text-lg/7 dark:text-zinc-400">
          Three steps from download to your first payment on Fiber Network.
        </p>

        <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((item, index) => (
            <motion.li
              key={item.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: index * 0.1, ease: 'easeOut' }}
              className="min-w-0"
            >
              <p className="text-sm/5 font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
                {item.step}
              </p>
              <p className="mt-3 text-base/6 font-semibold tracking-[-0.32px] text-zinc-950 dark:text-white">
                {item.title}
              </p>
              <p className="mt-1 text-sm/5 text-zinc-600 dark:text-zinc-400">{item.description}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  )
}
