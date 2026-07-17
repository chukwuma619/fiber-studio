import { QRCodeSVG } from "qrcode.react"

type InvoiceQrCodeProps = {
  value: string
  size?: number
  title?: string
}

export function InvoiceQrCode({
  value,
  size = 168,
  title = "Invoice QR code",
}: InvoiceQrCodeProps) {
  return (
    <div
      className="inline-flex rounded-lg bg-white p-3 shadow-xs ring-1 ring-zinc-950/10 dark:ring-white/10"
      role="img"
      aria-label={title}
    >
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        bgColor="#ffffff"
        fgColor="#000000"
        title={title}
      />
    </div>
  )
}
