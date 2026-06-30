import { CopyButton } from "../ui/copy-button"
import { Text } from "../ui/text"
import { InvoiceQrCodeLazy } from "./InvoiceQrCodeLazy"

type InvoiceSharePanelProps = {
  invoiceAddress: string
  currency?: string
  subtitle?: string
}

export function InvoiceSharePanel({
  invoiceAddress,
  currency,
  subtitle = "Scan the QR code or share the Bech32m string with the payer",
}: InvoiceSharePanelProps) {
  return (
    <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
      {currency ? (
        <Text className="text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Invoice ({currency})
        </Text>
      ) : null}
      <Text className="mt-1 text-center text-xs text-zinc-500 dark:text-zinc-400">
        {subtitle}
      </Text>
      <div className="mt-4 flex justify-center">
        <InvoiceQrCodeLazy value={invoiceAddress} />
      </div>
      <div className="mt-4 flex min-w-0 items-center gap-2">
        <code
          className="min-w-0 flex-1 break-all rounded-md bg-white px-3 py-2 font-mono text-xs leading-relaxed text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
          title={invoiceAddress}
        >
          {invoiceAddress}
        </code>
        <CopyButton value={invoiceAddress} label="Copy invoice" className="shrink-0" />
      </div>
    </div>
  )
}
