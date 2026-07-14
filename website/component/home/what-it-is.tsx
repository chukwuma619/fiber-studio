'use client'

import { motion } from 'motion/react'

import {
  HomeCrop,
  NetworkCrop,
  SettingsCrop,
} from '@/component/home/preview-crops'
import { Divider } from '@/component/ui/divider'

const POINTS = [
  {
    title: 'Run it on your computer',
    description: 'Start, stop, and check your node from one place.',
    Preview: HomeCrop,
  },
  {
    title: 'Your keys stay with you',
    description: 'Your wallet key and password never leave this device.',
    Preview: SettingsCrop,
  },
  {
    title: 'Join the public network',
    description: 'Connect out to the network — no public IP or server required.',
    Preview: NetworkCrop,
  },
] as const

export function WhatItIs() {
  return (
    <section className="pt-16 sm:pt-20">
      <Divider soft />
      <div className="pt-16 sm:pt-20">
        <h2 className="text-2xl/8 font-semibold tracking-[-0.96px] text-zinc-950 sm:text-[32px]/[40px] sm:tracking-[-1.28px] dark:text-white">
          What Fiber Studio is
        </h2>
        <p className="mt-4 max-w-xl text-base/6 text-zinc-600 sm:text-lg/7 dark:text-zinc-400">
          Fiber Network is Nervos CKB’s network for fast peer-to-peer payments. To use it,
          you run the official Fiber Network Node — a small program that connects you to
          the network.
        </p>
        <p className="mt-4 max-w-xl text-base/6 text-zinc-600 sm:text-lg/7 dark:text-zinc-400">
          Fiber Studio is the desktop app for that node. It guides setup and everyday
          tasks so you don’t need the command line. Your CKB key stays on your computer,
          and your password stays in your system’s keychain. Fiber Studio does not replace
          the official node or change the protocol — and it is not a hosted wallet.
        </p>

        <ul className="mt-12 grid gap-8 sm:grid-cols-3 sm:gap-6">
          {POINTS.map((point, index) => (
            <motion.li
              key={point.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: index * 0.1, ease: 'easeOut' }}
              className="min-w-0"
            >
              <point.Preview />
              <p className="mt-4 text-base/6 font-semibold tracking-[-0.32px] text-zinc-950 dark:text-white">
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
