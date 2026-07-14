import type { ReactNode } from 'react'

import { FiberMark } from '@/component/brand/FiberMark'
import { FiberStudioWordmark } from '@/component/brand/FiberStudioWordmark'
import { PreviewCrop } from '@/component/home/preview-crops'
import { Badge } from '@/component/ui/badge'
import { Button } from '@/component/ui/button'

function WizardShell({
  stepLabel,
  stepIndex,
  primaryAction,
  children,
}: {
  stepLabel: string
  stepIndex: number
  primaryAction: string
  children: ReactNode
}) {
  return (
    <PreviewCrop>
      <div className="flex h-full flex-col overflow-hidden rounded-lg bg-zinc-100 shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-950 dark:ring-white/10">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-950/5 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-zinc-900">
          <span className="flex min-w-0 items-center gap-1.5 text-zinc-950 dark:text-white">
            <FiberMark className="size-4 shrink-0" />
            <span className="truncate text-xs font-medium">
              <FiberStudioWordmark layout="inline" />
              <span className="ml-1 text-zinc-500 dark:text-zinc-400">Setup</span>
            </span>
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {Array.from({ length: 6 }, (_, index) => (
              <span
                key={index}
                className={
                  index <= stepIndex
                    ? 'size-1.5 rounded-full bg-sky-500'
                    : 'size-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700'
                }
              />
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-3">
          <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            {stepLabel}
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
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-zinc-950 dark:text-white">{label}</p>
      {children}
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

/** Setup wizard — Welcome (first launch after install). */
export function GuideWelcomePreview() {
  return (
    <WizardShell stepLabel="Step 1 of 6 — Welcome" stepIndex={0} primaryAction="Continue">
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

/** Setup wizard — Review & start (end of node setup). */
export function GuideSetupPreview() {
  return (
    <WizardShell
      stepLabel="Step 6 of 6 — Review & start"
      stepIndex={5}
      primaryAction="Start node"
    >
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">Review & start</h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Confirm setup, then start the official Fiber node.
          </p>
        </div>
        <dl className="divide-y divide-zinc-200 overflow-hidden rounded-lg ring-1 ring-zinc-950/10 dark:divide-zinc-800 dark:ring-white/10">
          {[
            { label: 'Network', value: 'Testnet' },
            { label: 'Peer', value: '03f1a8…c42d' },
            { label: 'Wallet key', value: 'Will be saved to …/ckb/key' },
            { label: 'Password', value: 'Will be stored in OS keychain when you start' },
          ].map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-2 px-2.5 py-2">
              <dt className="shrink-0 text-[10px] text-zinc-500 dark:text-zinc-400">{row.label}</dt>
              <dd className="truncate text-right text-[10px] text-zinc-950 dark:text-white">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </WizardShell>
  )
}

/** Channels — Open channel dialog. */
export function GuideOpenChannelPreview() {
  return (
    <DialogShell
      title="Open channel"
      description="Open a public channel with a connected saved peer."
      primaryAction="Open channel"
    >
      <Field label="Connected peer">
        <FakeInput mono>03f1a8…c42d</FakeInput>
      </Field>
      <Field label="Peer connection">
        <div className="flex flex-wrap gap-1.5">
          <Badge color="green">Connected</Badge>
          <Badge color="blue">0 channels</Badge>
        </div>
      </Field>
      <Field label="Channel capacity (CKB)">
        <FakeInput>1000</FakeInput>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
          Minimum 1000 CKB to open a channel.
        </p>
      </Field>
    </DialogShell>
  )
}

/** Wallet — Send payment panel. */
export function GuideSendPreview() {
  return (
    <PreviewCrop>
      <div className="flex h-full flex-col overflow-hidden rounded-lg bg-white p-4 shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10">
        <h3 className="text-sm font-semibold tracking-[-0.28px] text-zinc-950 dark:text-white">
          Send payment
        </h3>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          Pay by invoice or push CKB to a known node pubkey (keysend)
        </p>
        <div className="mt-3 flex gap-2">
          <Badge color="zinc">Invoice</Badge>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Keysend</span>
        </div>
        <div className="mt-3 space-y-1">
          <p className="text-xs font-medium text-zinc-950 dark:text-white">Invoice string</p>
          <FakeInput mono>fibt1000000001p…</FakeInput>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Bech32m invoice (Fibt on testnet)
          </p>
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-lg bg-zinc-50 p-3 ring-1 ring-zinc-950/10 dark:bg-zinc-800 dark:ring-white/10">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-zinc-950 dark:text-white">Direct route</p>
            <Badge color="sky">Off-chain (Fiber)</Badge>
          </div>
          <p className="mt-2 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
            02a7c3…e91b → 03f1a8…c42d
          </p>
          <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">Fee 0.01 CKB</p>
        </div>
        <Button className="mt-3 w-full text-xs">Review payment</Button>
      </div>
    </PreviewCrop>
  )
}

/** Wallet — Create invoice dialog. */
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
        <Field label="Expiry (hours)">
          <FakeInput>24</FakeInput>
        </Field>
      </div>
      <Field label="Note (optional)">
        <FakeInput>Payment description</FakeInput>
      </Field>
      <div className="rounded-lg bg-zinc-50 px-2.5 py-2 ring-1 ring-zinc-950/10 dark:bg-zinc-800 dark:ring-white/10">
        <p className="text-[10px] font-medium text-zinc-950 dark:text-white">Invoice string</p>
        <p className="mt-1 truncate font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
          fibt1000000001p…
        </p>
        <Badge color="green" className="mt-2">
          Awaiting payment
        </Badge>
      </div>
    </DialogShell>
  )
}
