'use client'

import { motion, useReducedMotion } from 'motion/react'
import { Divider } from '@/component/ui/divider'

function IllustrationLocalNode({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <svg viewBox="0 0 200 140" fill="none" className="h-full w-full" aria-hidden>
      {/* Desk surface */}
      <ellipse cx="100" cy="128" rx="72" ry="6" className="fill-zinc-200/80 dark:fill-zinc-800" />

      {/* Laptop base */}
      <path
        d="M48 108h104l8 8H40l8-8Z"
        className="fill-zinc-300 dark:fill-zinc-600"
      />
      <rect
        x="42"
        y="44"
        width="116"
        height="64"
        rx="5"
        className="fill-zinc-200 stroke-zinc-400 dark:fill-zinc-700 dark:stroke-zinc-500"
        strokeWidth="1.25"
      />

      {/* Screen bezel */}
      <rect x="48" y="50" width="104" height="52" rx="2.5" className="fill-zinc-950" />

      {/* Mini app chrome */}
      <rect x="48" y="50" width="28" height="52" className="fill-zinc-900" />
      <rect x="52" y="56" width="12" height="3" rx="1" className="fill-zinc-600" />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x="52"
          y={64 + i * 7}
          width={i === 0 ? 18 : 14}
          height="3.5"
          rx="1"
          className={i === 0 ? 'fill-white/20' : 'fill-zinc-700'}
        />
      ))}

      {/* Main panel */}
      <text x="84" y="62" className="fill-zinc-400" style={{ fontSize: 5, fontFamily: 'ui-sans-serif, system-ui' }}>
        Home
      </text>

      {/* Status row */}
      <motion.circle
        cx="88"
        cy="72"
        r="2.5"
        className="fill-sky-400"
        animate={reduceMotion ? undefined : { opacity: [1, 0.35, 1], scale: [1, 0.85, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <rect x="94" y="69.5" width="28" height="5" rx="1" className="fill-zinc-600" />
      <rect x="126" y="69" width="18" height="6" rx="1.5" className="fill-zinc-700" />

      {/* Stat blocks */}
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect
            x={84 + i * 22}
            y="80"
            width="18"
            height="16"
            rx="2"
            className="fill-white/5"
          />
          <motion.rect
            x={87 + i * 22}
            y="90"
            width="12"
            height="3"
            rx="1"
            className="fill-sky-500/70"
            animate={
              reduceMotion
                ? undefined
                : { scaleX: [0.4, 1, 0.7, 1], originX: 0 }
            }
            transition={{
              duration: 2.4,
              delay: i * 0.25,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </g>
      ))}

      {/* Floating Fiber mark */}
      <motion.g
        animate={reduceMotion ? undefined : { y: [0, -3, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <circle cx="168" cy="36" r="14" className="fill-white dark:fill-zinc-800" />
        <circle
          cx="168"
          cy="36"
          r="14"
          className="stroke-zinc-300 dark:stroke-zinc-600"
          strokeWidth="1"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M162.5 30h8.4l1.6-2.7h-8.8L163.3 30Zm.7 13.2 5.6-9.6h-3.6l.6-2.6h-3.4l-1.2 6.4h3.1l-1.1 5.8Z"
          className="fill-zinc-950 dark:fill-white"
        />
      </motion.g>

      {/* Soft pulse ring from mark */}
      {!reduceMotion ? (
        <motion.circle
          cx="168"
          cy="36"
          r="14"
          className="stroke-sky-500/40"
          strokeWidth="1"
          fill="none"
          animate={{ r: [14, 22], opacity: [0.5, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
        />
      ) : null}
    </svg>
  )
}

function IllustrationKeysOnDevice({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <svg viewBox="0 0 200 140" fill="none" className="h-full w-full" aria-hidden>
      {/* Soft local boundary */}
      <motion.rect
        x="36"
        y="18"
        width="128"
        height="104"
        rx="14"
        className="stroke-zinc-300 dark:stroke-zinc-600"
        strokeWidth="1.25"
        strokeDasharray="4 4"
        fill="none"
        animate={reduceMotion ? undefined : { strokeDashoffset: [0, -16] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      />

      {/* Device body */}
      <rect
        x="58"
        y="32"
        width="84"
        height="76"
        rx="10"
        className="fill-zinc-100 stroke-zinc-400 dark:fill-zinc-800 dark:stroke-zinc-500"
        strokeWidth="1.25"
      />
      <rect x="66" y="42" width="68" height="44" rx="4" className="fill-white dark:fill-zinc-900" />

      {/* Folder rows on disk */}
      <rect x="72" y="48" width="24" height="14" rx="2" className="fill-zinc-200 dark:fill-zinc-700" />
      <rect x="74" y="46" width="12" height="3" rx="1" className="fill-zinc-300 dark:fill-zinc-600" />
      <text x="100" y="57" className="fill-zinc-500" style={{ fontSize: 5, fontFamily: 'ui-sans-serif, system-ui' }}>
        ckb/key
      </text>
      <rect x="72" y="68" width="24" height="14" rx="2" className="fill-zinc-200 dark:fill-zinc-700" />
      <text x="100" y="77" className="fill-zinc-500" style={{ fontSize: 5, fontFamily: 'ui-sans-serif, system-ui' }}>
        keychain
      </text>

      {/* Animated key sliding into place */}
      <motion.g
        animate={reduceMotion ? undefined : { x: [8, 0, 0], opacity: [0.4, 1, 1] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', times: [0, 0.35, 1] }}
      >
        <circle
          cx="148"
          cy="64"
          r="9"
          className="stroke-zinc-950 dark:stroke-white"
          strokeWidth="2"
          fill="none"
        />
        <circle cx="148" cy="64" r="3.5" className="fill-sky-500" />
        <path
          d="M157 62.5h22v3.5h-10v4h-4v-4h-4v7h-4V62.5Z"
          className="fill-zinc-950 dark:fill-white"
        />
      </motion.g>

      {/* Lock body */}
      <motion.g
        animate={reduceMotion ? undefined : { y: [2, 0, 0] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', times: [0, 0.4, 1] }}
      >
        <path
          d="M86 96v-6a10 10 0 0 1 20 0v6"
          className="stroke-zinc-950 dark:stroke-white"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <rect
          x="82"
          y="96"
          width="28"
          height="20"
          rx="4"
          className="fill-zinc-950 dark:fill-white"
        />
        <circle cx="96" cy="104" r="2.5" className="fill-sky-400" />
        <rect x="94.5" y="106" width="3" height="5" rx="1" className="fill-sky-400" />
      </motion.g>

      {/* Stay-local check pulse */}
      {!reduceMotion ? (
        <motion.circle
          cx="100"
          cy="70"
          r="40"
          className="stroke-sky-500/25"
          strokeWidth="1"
          fill="none"
          animate={{ opacity: [0, 0.6, 0], scale: [0.85, 1.05, 1.05] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeOut' }}
          style={{ transformOrigin: '100px 70px' }}
        />
      ) : null}
    </svg>
  )
}

function IllustrationOutboundNetwork({ reduceMotion }: { reduceMotion: boolean }) {
  const packetTransition = (delay: number) =>
    reduceMotion
      ? undefined
      : {
          animate: { offsetDistance: ['0%', '100%'], opacity: [0, 1, 1, 0] },
          transition: {
            duration: 2.2,
            delay,
            repeat: Infinity,
            ease: 'easeInOut' as const,
            times: [0, 0.15, 0.85, 1],
          },
        }

  return (
    <svg viewBox="0 0 200 140" fill="none" className="h-full w-full" aria-hidden>
      {/* Local machine */}
      <rect
        x="16"
        y="44"
        width="52"
        height="52"
        rx="8"
        className="fill-zinc-100 stroke-zinc-400 dark:fill-zinc-800 dark:stroke-zinc-500"
        strokeWidth="1.25"
      />
      <rect x="24" y="52" width="36" height="24" rx="2" className="fill-zinc-950" />
      <motion.circle
        cx="32"
        cy="64"
        r="3"
        className="fill-sky-400"
        animate={reduceMotion ? undefined : { opacity: [1, 0.4, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <rect x="38" y="61" width="16" height="6" rx="1" className="fill-zinc-600" />
      <text x="28" y="88" className="fill-zinc-500" style={{ fontSize: 5, fontFamily: 'ui-sans-serif, system-ui' }}>
        your node
      </text>

      {/* Outbound paths */}
      <path
        id="path-top"
        d="M72 58 C100 40, 120 34, 152 38"
        className="stroke-zinc-300 dark:stroke-zinc-600"
        strokeWidth="1.25"
        strokeDasharray="3 4"
        fill="none"
      />
      <path
        id="path-mid"
        d="M72 70 H152"
        className="stroke-zinc-950/40 dark:stroke-white/40"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        fill="none"
      />
      <path
        id="path-bot"
        d="M72 82 C100 100, 120 106, 152 102"
        className="stroke-zinc-300 dark:stroke-zinc-600"
        strokeWidth="1.25"
        strokeDasharray="3 4"
        fill="none"
      />

      {/* Animated outbound packets */}
      {!reduceMotion ? (
        <>
          <motion.circle
            r="3"
            className="fill-sky-500"
            style={{ offsetPath: 'path("M72 58 C100 40, 120 34, 152 38")' }}
            {...packetTransition(0)}
          />
          <motion.circle
            r="3"
            className="fill-zinc-950 dark:fill-white"
            style={{ offsetPath: 'path("M72 70 H152")' }}
            {...packetTransition(0.7)}
          />
          <motion.circle
            r="3"
            className="fill-sky-500"
            style={{ offsetPath: 'path("M72 82 C100 100, 120 106, 152 102")' }}
            {...packetTransition(1.3)}
          />
        </>
      ) : null}

      {/* Direction label */}
      <motion.g
        animate={reduceMotion ? undefined : { x: [0, 4, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <path
          d="M96 66h14"
          className="stroke-zinc-950 dark:stroke-white"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M106 62l6 4-6 4"
          className="stroke-zinc-950 dark:stroke-white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.g>

      {/* Remote peers */}
      {[
        { cx: 168, cy: 38, delay: 0.4 },
        { cx: 176, cy: 70, delay: 1.1 },
        { cx: 168, cy: 102, delay: 1.7 },
      ].map((peer) => (
        <g key={`${peer.cx}-${peer.cy}`}>
          <motion.circle
            cx={peer.cx}
            cy={peer.cy}
            r="11"
            className="fill-zinc-100 stroke-zinc-400 dark:fill-zinc-800 dark:stroke-zinc-500"
            strokeWidth="1.25"
            animate={
              reduceMotion
                ? undefined
                : { scale: [1, 1.06, 1] }
            }
            transition={{
              duration: 2.2,
              delay: peer.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{ transformOrigin: `${peer.cx}px ${peer.cy}px` }}
          />
          <motion.circle
            cx={peer.cx}
            cy={peer.cy}
            r="3.5"
            className="fill-sky-500"
            animate={
              reduceMotion
                ? undefined
                : { opacity: [0.35, 1, 0.35] }
            }
            transition={{
              duration: 2.2,
              delay: peer.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </g>
      ))}

      <text x="148" y="128" className="fill-zinc-500" style={{ fontSize: 5, fontFamily: 'ui-sans-serif, system-ui' }}>
        public network
      </text>
    </svg>
  )
}

const POINTS = [
  {
    title: 'Run it on your computer',
    description: 'Start, stop, and check your node from one place.',
    Illustration: IllustrationLocalNode,
  },
  {
    title: 'Your keys stay with you',
    description: 'Your wallet key and password never leave this device.',
    Illustration: IllustrationKeysOnDevice,
  },
  {
    title: 'Join the public network',
    description: 'Connect out to the network — no public IP or server required.',
    Illustration: IllustrationOutboundNetwork,
  },
] as const

export function WhatItIs() {
  const reduceMotion = useReducedMotion() ?? false

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
              <div className="aspect-[10/7] overflow-hidden rounded-xl bg-zinc-50 ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10">
                <point.Illustration reduceMotion={reduceMotion} />
              </div>
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
