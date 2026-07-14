'use client'

import { motion } from 'motion/react'
import type { ReactNode } from 'react'

import { Button } from '@/component/ui/button'
import { Divider } from '@/component/ui/divider'
import { TextLink } from '@/component/ui/text'

const GITHUB_ISSUES = 'https://github.com/chukwuma619/fiber-studio/issues'
const FIBER_DOCS = 'https://www.fiber.world/docs'

function Ui({ children }: { children: ReactNode }) {
  return (
    <span className="font-medium text-zinc-950 dark:text-white">{children}</span>
  )
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-sm border border-zinc-950/10 bg-zinc-950/2.5 px-1 py-0.5 font-mono text-[0.8125rem] text-zinc-950 dark:border-white/20 dark:bg-white/5 dark:text-white">
      {children}
    </code>
  )
}

function FaqItem({
  question,
  children,
}: {
  question: string
  children: ReactNode
}) {
  return (
    <li>
      <Divider soft />
      <div className="max-w-2xl py-8 sm:py-10">
        <h2 className="text-lg/7 font-semibold tracking-[-0.48px] text-zinc-950 sm:text-xl/8 sm:tracking-[-0.64px] dark:text-white">
          {question}
        </h2>
        <div className="mt-3 space-y-3 text-base/7 text-zinc-600 dark:text-zinc-400">
          {children}
        </div>
      </div>
    </li>
  )
}

export function FaqPage() {
  return (
    <div className="pb-4 sm:pt-12">
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.175, 0.885, 0.32, 1.1] }}
        className="max-w-2xl"
      >
        <h1 className="text-4xl font-semibold tracking-[-2.4px] text-zinc-950 sm:text-6xl sm:tracking-[-3.84px] dark:text-white">
          FAQ
        </h1>
        <p className="mt-4 max-w-xl text-base/6 text-zinc-600 sm:text-lg/7 dark:text-zinc-400">
          Short answers about Fiber Studio, local nodes, channels, and first-launch
          warnings.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="/download">Download</Button>
          <Button href="/get-started" outline>
            Get started
          </Button>
        </div>
      </motion.header>

      <motion.ul
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05, ease: [0.175, 0.885, 0.32, 1.1] }}
        className="mt-10 list-none sm:mt-12"
      >
        <FaqItem question="What is Fiber Studio?">
          <p>
            A desktop app for{' '}
            <TextLink href={FIBER_DOCS} target="_blank" rel="noopener noreferrer">
              Fiber Network
            </TextLink>{' '}
            payments on Nervos CKB. It runs the official Fiber Network Node (
            <Ui>fnn</Ui>) on your computer and gives you a UI for setup, channels, and
            payments — without living in a terminal.
          </p>
        </FaqItem>

        <FaqItem question="Is this a hosted wallet?">
          <p>
            No. Fiber Studio is local-first. Your CKB key stays on disk, your wallet
            password is stored in the OS keychain, and <Ui>fnn</Ui> runs on your machine.
            There is no Fiber Studio account and no hosted custody.
          </p>
        </FaqItem>

        <FaqItem question="Can I use mainnet?">
          <p>
            Not yet. The setup wizard supports <Ui>Testnet</Ui> only. Mainnet may appear
            in the UI but is not available for setup today. Both sides of a payment must
            be on the same network (testnet).
          </p>
        </FaqItem>

        <FaqItem question="Which platforms are supported?">
          <p>
            macOS (Apple Silicon and Intel), Windows 64-bit, and Linux (x64 and ARM64).
            Grab the installer for your machine on the{' '}
            <TextLink href="/download">Download</TextLink> page.
          </p>
        </FaqItem>

        <FaqItem question="macOS says it can’t verify Fiber Studio. Is that safe?">
          <p>
            Yes for GitHub builds today. Releases are not Apple-notarized yet, so
            Gatekeeper may show <Ui>“Fiber Studio” Not Opened</Ui>. Do not click{' '}
            <Ui>Move to Bin</Ui>. Use <Ui>System Settings → Privacy & Security → Open
            Anyway</Ui>, or right-click the app in Finder → <Ui>Open</Ui>. Full steps are
            on <TextLink href="/download">Download</TextLink>.
          </p>
          <p>
            On Windows, SmartScreen can show a similar warning — choose{' '}
            <Ui>More info → Run anyway</Ui>.
          </p>
        </FaqItem>

        <FaqItem question="What’s the difference between a peer and a channel?">
          <p>
            A <Ui>peer</Ui> connection is a P2P link on <Ui>Network</Ui>. A{' '}
            <Ui>channel</Ui> is the off-chain CKB lane you open on <Ui>Channels</Ui>. You
            need a connected peer <em>and</em> a channel in state <Ui>Ready</Ui> before
            you can send or receive. Connecting alone is not enough.
          </p>
          <p>
            Bootnodes under discovery help you find the network; you cannot open payment
            channels with them.
          </p>
        </FaqItem>

        <FaqItem question="How much CKB do I need to open a channel?">
          <p>
            Capacity is at least <Ui>1,000 CKB</Ui>. For a 1,000 CKB open, plan on about{' '}
            <Ui>1,109 CKB</Ui> available on-chain (capacity + reserve + fee buffer). Fund
            the on-chain wallet shown on <Ui>Channels</Ui> before you open.
          </p>
        </FaqItem>

        <FaqItem question="Why can’t I send or receive yet?">
          <p>Check these in order:</p>
          <ul className="list-disc space-y-2 pl-5 marker:text-zinc-400">
            <li>
              Top bar shows <Ui>fnn running</Ui>
            </li>
            <li>
              Your saved peer on <Ui>Network</Ui> is <Ui>Connected</Ui>
            </li>
            <li>
              A channel on <Ui>Channels</Ui> shows <Ui>State: Ready</Ui>
            </li>
            <li>
              Sender has enough in-channel balance for the amount plus fees
            </li>
          </ul>
          <p>
            Walk through the full path on{' '}
            <TextLink href="/get-started">Get started</TextLink>.
          </p>
        </FaqItem>

        <FaqItem question="Can two people pay if they’re not on the same Wi‑Fi?">
          <p>
            Yes. On the same LAN you can open a direct channel with each other. Far apart
            on normal home internet, the usual path is multi-hop: each person opens a
            channel with the same public hub (for example official testnet node1/node2),
            then payments route through that hub.
          </p>
          <p>
            Direct over the internet needs a dialable multiaddr (often port forwarding on{' '}
            <Code>8228</Code>). Pubkey alone is usually not enough for a fresh home node.
          </p>
        </FaqItem>

        <FaqItem question="Which release files should I download?">
          <p>
            Only the installer for your OS: <Code>.dmg</Code>, <Code>-setup.exe</Code>,{' '}
            <Code>.msi</Code>, <Code>.AppImage</Code>, <Code>.deb</Code>, or{' '}
            <Code>.rpm</Code>. Ignore <Code>.sig</Code> files, <Code>latest.json</Code>,
            and <Code>*.app.tar.gz</Code> — those are for in-app updates, not manual
            install.
          </p>
        </FaqItem>

        <FaqItem question="How do updates work?">
          <p>
            After install, Fiber Studio can check for updates on launch and from{' '}
            <Ui>Settings → Updates</Ui>. In-app updates use a separate Tauri signing key —
            that is not the same as Apple or Windows code signing for the first download.
          </p>
        </FaqItem>

        <FaqItem question="Where can I get help?">
          <p>
            Start with <TextLink href="/get-started">Get started</TextLink> and{' '}
            <TextLink href="/download">Download</TextLink>. For bugs or questions, open an
            issue on{' '}
            <TextLink href={GITHUB_ISSUES} target="_blank" rel="noopener noreferrer">
              GitHub
            </TextLink>
            . Protocol details live in the{' '}
            <TextLink href={FIBER_DOCS} target="_blank" rel="noopener noreferrer">
              Fiber docs
            </TextLink>
            .
          </p>
        </FaqItem>
      </motion.ul>

      <Divider soft />
      <div className="max-w-2xl py-14 sm:py-16">
        <h2 className="text-2xl/8 font-semibold tracking-[-0.96px] text-zinc-950 sm:text-[32px]/[40px] sm:tracking-[-1.28px] dark:text-white">
          Ready to try it?
        </h2>
        <p className="mt-4 max-w-xl text-base/6 text-zinc-600 sm:text-lg/7 dark:text-zinc-400">
          Install Fiber Studio, start your local node, open a channel, then send or
          receive on testnet.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="/download">Download Fiber Studio</Button>
          <Button href="/get-started" outline>
            Get started
          </Button>
        </div>
      </div>
    </div>
  )
}
