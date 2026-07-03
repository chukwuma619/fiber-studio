import type { ParseInvoicePreview } from "../../lib/fnn/types"
import { sanitizePaymentError } from "../../lib/fnn/format"
import { PageErrorBanner } from "../ui/page-error-banner"
import { Text } from "../ui/text"

type InvoiceParsePreviewProps = {
  preview: ParseInvoicePreview | null
  isLoading?: boolean
  error?: string | null
  onDismissError?: () => void
}

export function InvoiceParsePreview({
  preview,
  isLoading = false,
  error = null,
  onDismissError,
}: InvoiceParsePreviewProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg bg-zinc-50 px-3 py-2.5 dark:bg-zinc-800/50">
        <Text className="text-xs text-zinc-500 dark:text-zinc-400">
          Decoding invoice…
        </Text>
      </div>
    )
  }

  if (error) {
    return (
      <PageErrorBanner
        message={sanitizePaymentError(error)}
        onDismiss={onDismissError}
        className="px-3 py-2.5 text-xs"
      />
    )
  }

  if (!preview) {
    return null
  }

  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-2.5 dark:bg-zinc-800/50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Text className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Invoice decoded
        </Text>
        <Text className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
          {preview.currency}
        </Text>
      </div>
      <dl className="mt-2 space-y-1.5 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500 dark:text-zinc-400">Amount</dt>
          <dd className="font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
            {preview.amountDisplay}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500 dark:text-zinc-400">Currency</dt>
          <dd className="text-zinc-700 dark:text-zinc-300">{preview.currency}</dd>
        </div>
        {preview.description ? (
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500 dark:text-zinc-400">Note</dt>
            <dd className="max-w-[65%] truncate text-right text-zinc-700 dark:text-zinc-300">
              {preview.description}
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500 dark:text-zinc-400">Payment hash</dt>
          <dd className="font-mono text-zinc-600 dark:text-zinc-400">
            {preview.paymentHash.length > 14
              ? `${preview.paymentHash.slice(0, 10)}…`
              : preview.paymentHash}
          </dd>
        </div>
      </dl>
      {preview.networkWarning ? (
        <Text className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          {preview.networkWarning}
        </Text>
      ) : null}
    </div>
  )
}
