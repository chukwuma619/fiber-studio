'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

import {
  GuideOpenChannelPreview,
  GuideReceivePreview,
  GuideSendPreview,
  GuideSetupPreview,
  GuideWelcomePreview,
} from '@/component/get-started/guide-previews'
import { Button } from '@/component/ui/button'
import { Divider } from '@/component/ui/divider'
import { TextLink } from '@/component/ui/text'
import { fadeUp, pageHeaderEnter } from '@/lib/motion'

function GuideStep({
  number,
  title,
  children,
  preview,
}: {
  number: string
  title: string
  children: ReactNode
  preview?: ReactNode
}) {
  return (
    <li className="min-w-0">
      <Divider soft />
      <div className="grid gap-8 py-14 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start lg:gap-12">
        <div className="min-w-0">
          <p className="text-sm/5 font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
            Step {number}
          </p>
          <h2 className="mt-3 text-2xl/8 font-semibold tracking-[-0.96px] text-zinc-950 sm:text-[32px]/[40px] sm:tracking-[-1.28px] dark:text-white">
            {title}
          </h2>
          <div className="mt-5 space-y-5">{children}</div>
        </div>
        {preview ? <div className="min-w-0 lg:sticky lg:top-8">{preview}</div> : null}
      </div>
    </li>
  )
}

function Actions({ children }: { children: ReactNode }) {
  return (
    <ol className="list-decimal space-y-3 pl-5 text-base/7 text-zinc-600 marker:font-medium marker:text-zinc-950 sm:text-lg/7 dark:text-zinc-400 dark:marker:text-white">
      {children}
    </ol>
  )
}

function Ui({ children }: { children: ReactNode }) {
  return (
    <span className="font-medium text-zinc-950 dark:text-white">{children}</span>
  )
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-zinc-50 px-4 py-3 text-sm/6 text-zinc-600 ring-1 ring-zinc-950/10 dark:bg-zinc-800/60 dark:text-zinc-400 dark:ring-white/10">
      {children}
    </p>
  )
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-sm border border-zinc-950/10 bg-zinc-950/2.5 px-1 py-0.5 font-mono text-[0.8125rem] text-zinc-950 dark:border-white/20 dark:bg-white/5 dark:text-white">
      {children}
    </code>
  )
}

export function GetStartedPage() {
  const reduceMotion = useReducedMotion()
  const header = fadeUp(12, reduceMotion)

  return (
    <div className="pb-4 sm:pt-12">
      <motion.header
        initial={header.initial}
        animate={header.animate}
        transition={pageHeaderEnter}
        className="max-w-2xl"
      >
        <h1 className="text-4xl font-semibold tracking-[-2.4px] text-zinc-950 sm:text-6xl sm:tracking-[-3.84px] dark:text-white">
          From install to your first payment
        </h1>
        <p className="mt-4 max-w-xl text-base/6 text-zinc-600 sm:text-lg/7 dark:text-zinc-400">
          This guide walks you through Fiber Studio on testnet: install the app, start
          your local Fiber node, open a channel, then send or receive CKB.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="/download">Download Fiber Studio</Button>
          <Button href="/faq" outline>
            FAQ
          </Button>
        </div>
      </motion.header>

      <section className="mt-14 max-w-2xl sm:mt-16">
        <h2 className="text-base/6 font-semibold tracking-[-0.32px] text-zinc-950 dark:text-white">
          Before you begin
        </h2>
        <ul className="mt-4 space-y-2 text-base/7 text-zinc-600 dark:text-zinc-400">
          <li className="flex gap-3">
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-500" aria-hidden />
            <span>A Mac or Windows computer for the desktop app.</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-500" aria-hidden />
            <span>
              A CKB private key for testnet. Export one from{' '}
              <TextLink href="https://neuron.magickbase.com/" target="_blank" rel="noreferrer">
                Neuron
              </TextLink>
              , or generate one with <Code>ckb-cli account new</Code>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-500" aria-hidden />
            <span>
              Enough testnet CKB on-chain to open a channel. A <Ui>1,000 CKB</Ui> channel
              needs about <Ui>1,109 CKB</Ui> available (capacity + reserve + fee buffer).
            </span>
          </li>
        </ul>
      </section>

      <ol className="mt-4 list-none">
        <GuideStep number="1" title="Install Fiber Studio" preview={<GuideWelcomePreview />}>
          <Actions>
            <li>
              Open the <Ui>Download</Ui> page and get Fiber Studio for your computer.
            </li>
            <li>Install the app, then open it.</li>
            <li>
              On first launch, the <Ui>Setup wizard</Ui> starts automatically. Click{' '}
              <Ui>Continue</Ui> on the welcome screen.
            </li>
          </Actions>
          <div className="pt-1">
            <Button href="/download">Go to Download</Button>
          </div>
        </GuideStep>

        <GuideStep number="2" title="Set up and start your node" preview={<GuideSetupPreview />}>
          <p className="text-base/7 text-zinc-600 sm:text-lg/7 dark:text-zinc-400">
            The wizard configures a local official Fiber Network Node (<Ui>fnn</Ui>). Your
            key stays on this computer — Fiber Studio is not a hosted wallet.
          </p>
          <Actions>
            <li>
              On <Ui>Choose a network</Ui>, select <Ui>Testnet</Ui>, then{' '}
              <Ui>Continue</Ui>. Mainnet is not available yet.
            </li>
            <li>
              On <Ui>Connect to public network</Ui>, click <Ui>Use public node1</Ui> or{' '}
              <Ui>Use public node2</Ui> (or paste a peer pubkey), then{' '}
              <Ui>Continue</Ui>.
            </li>
            <li>
              On <Ui>Wallet key</Ui>, paste your CKB private key (64 hex characters;{' '}
              <Code>0x</Code> prefix is OK), then <Ui>Continue</Ui>.
            </li>
            <li>
              On <Ui>Wallet password</Ui>, enter and confirm a password, then{' '}
              <Ui>Continue</Ui>. Fiber Studio stores it in your OS keychain when you
              finish.
            </li>
            <li>
              On <Ui>Review & start</Ui>, check Network, Peer, and Wallet key, then click{' '}
              <Ui>Start node</Ui>.
            </li>
            <li>
              Wait until the top bar shows <Ui>fnn running</Ui> and a{' '}
              <Ui>Testnet</Ui> badge. You are now in the main app.
            </li>
          </Actions>
          <Note>
            If start fails, read the error on the review screen. Common causes are a bad
            key format or a password that does not match.
          </Note>
        </GuideStep>

        <GuideStep
          number="3"
          title="Connect your peer and open a channel"
          preview={<GuideOpenChannelPreview />}
        >
          <p className="text-base/7 text-zinc-600 sm:text-lg/7 dark:text-zinc-400">
            Fiber payments need an open channel with capacity. First make sure your saved
            peer is connected, then fund a channel.
          </p>
          <Actions>
            <li>
              In the sidebar, open <Ui>Network</Ui>.
            </li>
            <li>
              Find your saved peer. If it says <Ui>Not connected</Ui>, click{' '}
              <Ui>Connect</Ui> and wait for <Ui>Connected</Ui>.
            </li>
            <li>
              In the sidebar, open <Ui>Channels</Ui>, then click <Ui>Open channel</Ui>.
            </li>
            <li>
              Choose the connected peer, set <Ui>Channel capacity (CKB)</Ui> to at least{' '}
              <Ui>1,000</Ui>, then confirm <Ui>Open channel</Ui>.
            </li>
            <li>
              Wait until the channel <Ui>State</Ui> shows <Ui>Ready</Ui> (opening can take
              a short while). Do not send payments until it is Ready.
            </li>
          </Actions>
          <Note>
            Opening a channel spends on-chain testnet CKB from your funding wallet. That
            balance is separate from the local balance inside the channel once it is
            Active.
          </Note>
        </GuideStep>

        <GuideStep number="4" title="Send a payment" preview={<GuideSendPreview />}>
          <p className="text-base/7 text-zinc-600 sm:text-lg/7 dark:text-zinc-400">
            With a <Ui>Ready</Ui> channel, you can move CKB over Fiber from <Ui>Payments</Ui>.
          </p>
          <Actions>
            <li>
              In the sidebar, open <Ui>Payments</Ui>.
            </li>
            <li>
              In <Ui>Send payment</Ui>, leave the mode on <Ui>Invoice</Ui> (or switch to{' '}
              <Ui>Keysend</Ui> to push to a node pubkey).
            </li>
            <li>
              For an invoice: paste the invoice string (testnet invoices start with{' '}
              <Code>fibt</Code>). For keysend: pick a recipient and enter an amount in CKB.
            </li>
            <li>
              Check the route preview (direct or multi-hop, fee), then click{' '}
              <Ui>Review payment</Ui>.
            </li>
            <li>Confirm the send in the dialog and wait for success.</li>
          </Actions>
        </GuideStep>

        <GuideStep number="5" title="Receive a payment" preview={<GuideReceivePreview />}>
          <Actions>
            <li>
              Stay on <Ui>Payments</Ui>.
            </li>
            <li>
              Under <Ui>Receive & invoices</Ui>, click <Ui>Create invoice</Ui>.
            </li>
            <li>
              Enter the <Ui>Amount (CKB)</Ui>, optional note, and expiry, then click{' '}
              <Ui>Create invoice</Ui>.
            </li>
            <li>
              Copy the invoice string and share it with the payer. Status stays{' '}
              <Ui>Awaiting payment</Ui> until it is paid.
            </li>
          </Actions>
          <Note>
            You can also start send or create-invoice flows from <Ui>Home</Ui> with{' '}
            <Ui>Send payment</Ui> and <Ui>Create invoice</Ui>.
          </Note>
        </GuideStep>
      </ol>

      <Divider soft />
      <div className="max-w-2xl py-14 sm:py-16">
        <h2 className="text-2xl/8 font-semibold tracking-[-0.96px] text-zinc-950 sm:text-[32px]/[40px] sm:tracking-[-1.28px] dark:text-white">
          Stuck somewhere?
        </h2>
        <p className="mt-4 max-w-xl text-base/6 text-zinc-600 sm:text-lg/7 dark:text-zinc-400">
          Check that <Ui>fnn running</Ui> is showing, your peer is Connected, and your
          channel State is <Ui>Ready</Ui> before sending. More answers are on the FAQ, or
          open an issue on GitHub.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="/faq">FAQ</Button>
          <Button href="/download" outline>
            Download
          </Button>
        </div>
      </div>
    </div>
  )
}
