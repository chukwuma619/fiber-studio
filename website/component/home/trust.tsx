'use client'

import { motion } from 'motion/react'

import { Divider } from '@/component/ui/divider'

const POINTS = [
  {
    title: 'Keys stay on your device',
    description:
      'Your CKB key and password stay on this computer. Fiber Studio is not a cloud wallet.',
  },
  {
    title: 'Official Fiber node',
    description:
      'It runs the same official Fiber Network Node — not a fork, and not a replacement for the protocol.',
  },
  {
    title: 'No server required',
    description:
      'Connect out to the public network. You do not need a public IP or a VPS.',
  },
] as const

export function Trust() {
  return (
    <section className="pt-16 sm:pt-20">
      <Divider soft />
      <div className="pt-16 sm:pt-20">
        <h2 className="text-2xl/8 font-semibold tracking-[-0.96px] text-zinc-950 sm:text-[32px]/[40px] sm:tracking-[-1.28px] dark:text-white">
          Built to stay on your computer
        </h2>
        <p className="mt-4 max-w-xl text-base/6 text-zinc-600 sm:text-lg/7 dark:text-zinc-400">
          Fiber Studio is a local desktop app. Your node runs with you — not on someone
          else’s servers.
        </p>

        <ul className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {POINTS.map((point, index) => (
            <motion.li
              key={point.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: index * 0.1, ease: 'easeOut' }}
              className="min-w-0"
            >
              <p className="text-base/6 font-semibold tracking-[-0.32px] text-zinc-950 dark:text-white">
                {point.title}
              </p>
              <p className="mt-1 text-sm/5 text-zinc-600 dark:text-zinc-400">{point.description}</p>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  )
}
