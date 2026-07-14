import type { ReactNode } from 'react'

import { FiberMark } from '@/component/brand/FiberMark'
import { FiberStudioWordmark } from '@/component/brand/FiberStudioWordmark'
import { PreviewCrop } from '@/component/home/preview-crops'
import { Badge } from '@/component/ui/badge'
import { Button } from '@/component/ui/button'

/** Matches app truncatePubkey + testnet public node1. */
const DEMO_PEER = '02b6d4…be71'

function WizardShell({
  stepOf,
  stepTitle,
  stepIndex,
  primaryAction,
  children,
}: {
  stepOf: string
  stepTitle: string
  stepIndex: number
  primaryAction: string
  children: ReactNode
}) {
  return (
    <PreviewCrop>
      <div className="flex h-full flex-col overflow-hidden rounded-lg bg-zinc-100 shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-950 dark:ring-white/10">
        <div className="border-b border-zinc-950/5 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-1.5">
              <FiberMark className="size-4 shrink-0 text-zinc-950 dark:text-white" />
              <span className="min-w-0">
                <FiberStudioWordmark layout="inline" />
                <span className="mt-0.5 block text-[10px] text-zinc-500 dark:text-zinc-400">
                  Setup wizard
                </span>
              </span>
            </span>
            <div className="hidden w-28 shrink-0 space-y-1 sm:block">
              <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">{stepOf}</p>
              <div className="flex gap-1">
                {Array.from({ length: 6 }, (_, index) => (
                  <div
                    key={index}
                    className={
                      index <= stepIndex
                        ? 'h-1 flex-1 rounded-full bg-zinc-900 dark:bg-white'
                        : 'h-1 flex-1 rounded-full bg-zinc-200 dark:bg-zinc-800'
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-3">
          <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            {stepTitle}
          </p>
          <div className="mt-2 h-[calc(100%-1.25rem)] overflow-hidden rounded-lg bg-white p-3 shadow-xs ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
            {children}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-zinc-950/5 bg-white px-3 py-2 dark:border-white/10 dark:bg-zinc-900">
          <Button outline className="text-xs" disabled={stepIndex === 0}>
            Back
          </Button>
          <Button className="text-xs">{primaryAction}</Button>
        </div>
      </div>
    </PreviewCrop>
  )
}

function DialogShell({
  title,
  description,
  primaryAction,
  children,
}: {
  title: string
  description: string
  primaryAction: string
  children: ReactNode
}) {
  return (
    <PreviewCrop>
      <div className="flex h-full flex-col overflow-hidden rounded-lg bg-white shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold tracking-[-0.28px] text-zinc-950 dark:text-white">
            {title}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-hidden px-4 py-3">{children}</div>
        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
          <Button plain className="text-xs">
            Cancel
          </Button>
          <Button className="text-xs">{primaryAction}</Button>
        </div>
      </div>
    </PreviewCrop>
  )
}

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-zinc-950 dark:text-white">{label}</p>
      {children}
      {hint ? <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{hint}</p> : null}
    </div>
  )
}

function FakeInput({ children, mono }: { children: ReactNode; mono?: boolean }) {
  return (
    <div
      className={
        mono
          ? 'truncate rounded-lg bg-zinc-50 px-2.5 py-1.5 font-mono text-xs text-zinc-500 ring-1 ring-zinc-950/10 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-white/10'
          : 'truncate rounded-lg bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-500 ring-1 ring-zinc-950/10 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-white/10'
      }
    >
      {children}
    </div>
  )
}

/** Setup wizard — WelcomeStep */
export function GuideWelcomePreview() {
  return (
    <WizardShell
      stepOf="Step 1 of 6 — Welcome"
      stepTitle="Welcome"
      stepIndex={0}
      primaryAction="Continue"
    >
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
            Welcome to Fiber Studio
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Run and manage your Fiber Network Node (fnn) from one desktop app.
          </p>
        </div>
        <ul className="space-y-1.5 overflow-hidden">
          {[
            { title: 'Run fnn locally', description: 'Start, stop, and monitor your node.' },
            {
              title: 'Keys stay on device',
              description: 'Your wallet key and password stay on this computer.',
            },
            {
              title: 'Connect to the public network',
              description: 'Outbound only — no public IP or VPS required.',
            },
          ].map((item) => (
            <li
              key={item.title}
              className="flex gap-2 rounded-lg bg-zinc-950/2.5 px-2.5 py-2 ring-1 ring-zinc-950/5 dark:bg-white/5 dark:ring-white/10"
            >
              <span
                className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[9px] font-bold text-white dark:bg-white dark:text-zinc-900"
                aria-hidden
              >
                ✓
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-zinc-950 dark:text-white">{item.title}</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </WizardShell>
  )
}

/** Setup wizard — ReviewStep */
export function GuideSetupPreview() {
  return (
    <WizardShell
      stepOf="Step 6 of 6 — Review & start"
      stepTitle="Review & start"
      stepIndex={5}
      primaryAction="Start node"
    >
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">Review & start</h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Check your choices, then start your node.
          </p>
        </div>
        <dl className="divide-y divide-zinc-200 overflow-hidden rounded-lg ring-1 ring-zinc-950/10 dark:divide-zinc-800 dark:ring-white/10">
          {[
            { label: 'Network', value: 'Testnet' },
            { label: 'Peer', value: DEMO_PEER },
            { label: 'Data directory', value: '~/Library/fiber-studio-testnet' },
            { label: 'Wallet key', value: 'Will be saved to …/ckb/key' },
            { label: 'Password', value: 'Will be stored in OS keychain when you start' },
          ].map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-2 px-2.5 py-1.5">
              <dt className="shrink-0 text-[10px] text-zinc-500 dark:text-zinc-400">{row.label}</dt>
              <dd className="truncate text-right font-mono text-[10px] text-zinc-950 dark:text-white">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </WizardShell>
  )
}

/** Channels — OpenChannelDialog */
export function GuideOpenChannelPreview() {
  return (
    <DialogShell
      title="Open channel"
      description="Open a public channel with a connected saved peer. You can open multiple channels with the same peer."
      primaryAction="Open channel"
    >
      <Field
        label="Connected peer"
        hint="Only connected saved peers are listed. Multiple channels can share the same peer connection."
      >
        <FakeInput mono>{DEMO_PEER}</FakeInput>
      </Field>
      <Field label="Peer connection">
        <Badge color="green">Connected</Badge>
      </Field>
      <Field label="Channel capacity (CKB)" hint="Minimum 1000 CKB to open a channel.">
        <FakeInput>1000</FakeInput>
      </Field>
    </DialogShell>
  )
}

/** Wallet — SendPaymentPanel */
export function GuideSendPreview() {
  return (
    <PreviewCrop>
      <div className="flex h-full flex-col overflow-hidden rounded-lg bg-white p-4 shadow-xs ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
        <h3 className="text-sm font-semibold tracking-[-0.28px] text-zinc-950 dark:text-white">
          Send payment
        </h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Pay by invoice or push CKB to a known node pubkey (keysend)
        </p>
        <div className="mt-3 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
          <span className="flex-1 rounded-md bg-white px-2 py-1 text-center text-xs font-medium text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-white">
            Invoice
          </span>
          <span className="flex-1 rounded-md px-2 py-1 text-center text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Keysend
          </span>
        </div>
        <div className="mt-3 space-y-1">
          <p className="text-xs font-medium text-zinc-950 dark:text-white">Invoice string</p>
          <FakeInput mono>fibt1000000001p…</FakeInput>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Bech32m invoice (Fibt on testnet)
          </p>
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-lg bg-zinc-50 px-3 py-2.5 dark:bg-zinc-800/50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Direct route</p>
            <div className="flex items-center gap-2">
              <Badge color="sky">Off-chain (Fiber)</Badge>
              <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">0.01 CKB</span>
            </div>
          </div>
          <p className="mt-2 font-mono text-[10px] break-all text-zinc-600 dark:text-zinc-400">
            02a7c3…e91b → {DEMO_PEER}
          </p>
        </div>
        <Button className="mt-3 w-full text-xs">Review payment</Button>
      </div>
    </PreviewCrop>
  )
}

/** Wallet — CreateInvoiceDialog (form before create) */
export function GuideReceivePreview() {
  return (
    <DialogShell
      title="Create invoice"
      description="Generate a Fibt invoice to receive CKB over the Fiber network."
      primaryAction="Create invoice"
    >
      <div className="grid grid-cols-2 gap-2">
        <Field label="Amount (CKB)">
          <FakeInput>120</FakeInput>
        </Field>
        <Field label="Expiry (hours)" hint="Invoice expires after this duration">
          <FakeInput>24</FakeInput>
        </Field>
      </div>
      <Field label="Note (optional)">
        <FakeInput>Payment description</FakeInput>
      </Field>
    </DialogShell>
  )
}
