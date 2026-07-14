import type { ReactNode } from 'react'

import { Badge } from '@/component/ui/badge'
import { Button } from '@/component/ui/button'
import { CapacityBar } from '@/component/ui/capacity-bar'
import { StatusDot } from '@/component/ui/status-dot'
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from '@/component/ui/description-list'

/** Card frame that crops an app UI fragment to the part that matters. */
export function PreviewCrop({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none aspect-[10/7] overflow-hidden rounded-xl bg-zinc-100 ring-1 ring-zinc-950/10 dark:bg-zinc-950 dark:ring-white/10"
    >
      <div className="h-full p-3 sm:p-4">{children}</div>
    </div>
  )
}

/** Home — node running + local status. */
export function HomeCrop() {
  return (
    <PreviewCrop>
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10">
          <StatusDot tone="running" />
          <span className="text-sm/5 font-medium text-zinc-950 dark:text-white">fnn running</span>
          <Badge color="sky">Testnet</Badge>
          <span className="ml-auto hidden sm:inline">
            <Button outline className="text-xs">
              Stop node
            </Button>
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg bg-white p-4 shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10">
          <h3 className="text-sm font-semibold tracking-[-0.28px] text-zinc-950 dark:text-white">
            Node status
          </h3>
          <DescriptionList className="mt-3">
            <DescriptionTerm>Status</DescriptionTerm>
            <DescriptionDetails>
              <span className="inline-flex items-center gap-1.5">
                <StatusDot tone="running" />
                Running
              </span>
            </DescriptionDetails>
            <DescriptionTerm>fnn version</DescriptionTerm>
            <DescriptionDetails>0.8.1</DescriptionDetails>
            <DescriptionTerm>RPC</DescriptionTerm>
            <DescriptionDetails className="font-mono text-xs">127.0.0.1:8227</DescriptionDetails>
          </DescriptionList>
        </div>
      </div>
    </PreviewCrop>
  )
}

/** Settings — CKB wallet keys on device. */
export function SettingsCrop() {
  return (
    <PreviewCrop>
      <div className="flex h-full flex-col overflow-hidden rounded-lg bg-white shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold tracking-[-0.28px] text-zinc-950 dark:text-white">
            CKB wallet
          </h3>
          <Button outline className="text-xs">
            Change password
          </Button>
        </div>
        <dl className="min-h-0 flex-1 divide-y divide-zinc-200 overflow-hidden dark:divide-zinc-800">
          {[
            { label: 'Key file', value: 'ckb/key', mono: true },
            { label: 'Key password', value: 'Stored in OS keychain' },
            { label: 'On-chain address', value: 'ckt1qz…9f2a', mono: true },
          ].map((row) => (
            <div key={row.label} className="grid gap-0.5 px-4 py-2.5">
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">{row.label}</dt>
              <dd
                className={
                  row.mono
                    ? 'truncate font-mono text-sm text-zinc-950 dark:text-white'
                    : 'truncate text-sm text-zinc-950 dark:text-white'
                }
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </PreviewCrop>
  )
}

/** Network — saved peers connected outbound. */
export function NetworkCrop() {
  return (
    <PreviewCrop>
      <div className="flex h-full flex-col overflow-hidden rounded-lg bg-white shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold tracking-[-0.28px] text-zinc-950 dark:text-white">
            Peers
          </h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Saved peers · 2/2 connected
          </p>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-zinc-200 overflow-hidden dark:divide-zinc-800">
          {[
            {
              pubkey: '03f1a8…c42d',
              badges: [
                { label: 'Official relay', color: 'zinc' as const },
                { label: 'Connected', color: 'green' as const },
              ],
            },
            {
              pubkey: '02b9e4…7a11',
              badges: [
                { label: 'Bootnode', color: 'amber' as const },
                { label: 'Connected', color: 'green' as const },
              ],
            },
          ].map((peer) => (
            <li key={peer.pubkey} className="space-y-2 px-4 py-3">
              <p className="font-mono text-sm text-zinc-950 dark:text-white">{peer.pubkey}</p>
              <div className="flex flex-wrap gap-1">
                {peer.badges.map((badge) => (
                  <Badge key={badge.label} color={badge.color}>
                    {badge.label}
                  </Badge>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </PreviewCrop>
  )
}

/** Setup review — guided setup complete. */
export function SetupReviewCrop() {
  return (
    <PreviewCrop>
      <div className="flex h-full flex-col overflow-hidden rounded-lg bg-white p-4 shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10">
        <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          Step 6 of 6 — Review & start
        </p>
        <h3 className="mt-2 text-base font-semibold tracking-[-0.32px] text-zinc-950 dark:text-white">
          Review & start
        </h3>
        <dl className="mt-3 min-h-0 flex-1 divide-y divide-zinc-200 overflow-hidden rounded-lg ring-1 ring-zinc-950/10 dark:divide-zinc-800 dark:ring-white/10">
          {[
            { label: 'Network', value: 'Testnet' },
            { label: 'Saved peer', value: '03f1a8…c42d' },
            { label: 'Wallet key', value: '…/ckb/key' },
            { label: 'Password', value: 'OS keychain' },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-2 px-3 py-2">
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">{row.label}</dt>
              <dd className="truncate text-xs text-zinc-950 dark:text-white">{row.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex justify-end">
          <Button className="text-xs">Start node</Button>
        </div>
      </div>
    </PreviewCrop>
  )
}

/** Channels — open a channel with a connected peer. */
export function ChannelsCrop() {
  return (
    <PreviewCrop>
      <div className="flex h-full flex-col overflow-hidden rounded-lg bg-white shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div>
            <h3 className="text-sm font-semibold tracking-[-0.28px] text-zinc-950 dark:text-white">
              Channels
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              1 active · peer connected
            </p>
          </div>
          <Button className="text-xs">Open channel</Button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-hidden p-4">
          <div className="flex flex-wrap gap-1.5">
            <Badge color="green">Connected</Badge>
            <Badge color="blue">Public</Badge>
            <Badge color="green">Active</Badge>
          </div>
          <p className="font-mono text-xs text-zinc-600 dark:text-zinc-400">03f1a8…c42d</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>Capacity</span>
              <span className="tabular-nums text-zinc-950 dark:text-white">2,000 CKB</span>
            </div>
            <CapacityBar percent={62} showLabel={false} />
            <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
              62% local / 38% remote
            </p>
          </div>
        </div>
      </div>
    </PreviewCrop>
  )
}

/** Wallet — send payment panel. */
export function WalletCrop() {
  return (
    <PreviewCrop>
      <div className="flex h-full flex-col overflow-hidden rounded-lg bg-white p-4 shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10">
        <h3 className="text-sm font-semibold tracking-[-0.28px] text-zinc-950 dark:text-white">
          Send payment
        </h3>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          Pay by invoice or keysend
        </p>
        <div className="mt-3 flex gap-2">
          <Badge color="zinc">Invoice</Badge>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Keysend</span>
        </div>
        <div className="mt-3 truncate rounded-lg bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-500 ring-1 ring-zinc-950/10 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-white/10">
          fibt1000000001p…
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-lg bg-zinc-50 p-3 ring-1 ring-zinc-950/10 dark:bg-zinc-800 dark:ring-white/10">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-zinc-950 dark:text-white">Direct route</p>
            <Badge color="sky">Off-chain</Badge>
          </div>
          <p className="mt-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
            02a7c3…e91b → 03f1a8…c42d
          </p>
        </div>
        <Button className="mt-3 w-full text-xs">Review payment</Button>
      </div>
    </PreviewCrop>
  )
}
