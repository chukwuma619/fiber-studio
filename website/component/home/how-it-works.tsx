'use client'

import { motion } from 'motion/react'

import {
  ChannelsCrop,
  SetupReviewCrop,
  WalletCrop,
} from '@/component/home/preview-crops'
import { Divider } from '@/component/ui/divider'

const STEPS = [
  {
    step: '01',
    title: 'Set up your node',
    description:
      'Install Fiber Studio, save a peer, add your CKB key, and start the official Fiber node.',
    Preview: SetupReviewCrop,
  },
  {
    step: '02',
    title: 'Open a channel',
    description:
      'Connect to that peer and open a channel with CKB. Fiber payments need channel capacity first.',
    Preview: ChannelsCrop,
  },
  {
    step: '03',
    title: 'Send and receive',
    description:
      'Pay invoices or create invoices from Payments once your channel is active.',
    Preview: WalletCrop,
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
          Fiber Studio walks you through the real Fiber path: run a node, open a channel,
          then send and receive payments.
        </p>

        <ol className="mt-12 grid gap-8 sm:grid-cols-3 sm:gap-6">
          {STEPS.map((item, index) => (
            <motion.li
              key={item.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: index * 0.1, ease: 'easeOut' }}
              className="min-w-0"
            >
              <item.Preview />
              <p className="mt-4 text-sm/5 font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
                {item.step}
              </p>
              <p className="mt-2 text-base/6 font-semibold tracking-[-0.32px] text-zinc-950 dark:text-white">
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
