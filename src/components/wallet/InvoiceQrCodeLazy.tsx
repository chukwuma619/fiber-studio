import { lazy, Suspense } from "react"
import { Skeleton } from "../ui/skeleton"

const InvoiceQrCode = lazy(() =>
  import("./InvoiceQrCode").then((module) => ({
    default: module.InvoiceQrCode,
  })),
)

type InvoiceQrCodeLazyProps = {
  value: string
  size?: number
  title?: string
}

export function InvoiceQrCodeLazy({
  value,
  size = 168,
  title = "Invoice QR code",
}: InvoiceQrCodeLazyProps) {
  return (
    <Suspense
      fallback={<Skeleton className="rounded-lg" style={{ width: size + 24, height: size + 24 }} />}
    >
      <InvoiceQrCode value={value} size={size} title={title} />
    </Suspense>
  )
}
