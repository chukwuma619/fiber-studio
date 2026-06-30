import {
  formatCkb,
  parseHexU128,
  paymentKindLabel,
  paymentRouteBadgeLabel,
  paymentRouteTitle,
  paymentStatusBadgeColor,
  paymentStatusTone,
} from "../../lib/fnn/format"
import type { WalletPaymentItem } from "../../lib/fnn/types"
import { truncatePubkey } from "../../lib/public-relays"
import { StatusDot } from "../layout/StatusDot"
import { Badge } from "../ui/badge"
import { CopyButton } from "../ui/copy-button"
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from "../ui/description-list"
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog"
import { Button } from "../ui/button"
import { Text } from "../ui/text"

type PaymentDetailDialogProps = {
  open: boolean
  payment: WalletPaymentItem | null
  onClose: () => void
}

export function PaymentDetailDialog({
  open,
  payment,
  onClose,
}: PaymentDetailDialogProps) {
  const hopCount = payment?.routeHops.length ?? 0
  const feeCkb = payment ? formatCkb(parseHexU128(payment.fee)) : "—"

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <DialogTitle>Payment details</DialogTitle>
      <DialogDescription>
        Outbound payment from your node via Fiber.
      </DialogDescription>
      <DialogBody>
        {payment ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge color="sky">{paymentKindLabel(payment.paymentKind)}</Badge>
              {hopCount > 0 ? (
                <Badge color="zinc">{paymentRouteBadgeLabel(hopCount)}</Badge>
              ) : null}
              <Badge color={paymentStatusBadgeColor(payment.status)}>
                <StatusDot tone={paymentStatusTone(payment.status)} />
                {payment.status}
              </Badge>
            </div>

            <DescriptionList className="sm:grid-cols-[min(40%,9rem)_minmax(0,1fr)]">
              <DescriptionTerm>Amount</DescriptionTerm>
              <DescriptionDetails className="tabular-nums font-medium">
                {payment.amountCkb ?? "—"}
              </DescriptionDetails>

              <DescriptionTerm>Route fee</DescriptionTerm>
              <DescriptionDetails className="tabular-nums">
                {feeCkb} CKB
              </DescriptionDetails>

              {payment.paymentKind === "keysend" && payment.targetPubkey ? (
                <>
                  <DescriptionTerm>To</DescriptionTerm>
                  <DescriptionDetails className="font-mono text-xs">
                    {truncatePubkey(payment.targetPubkey)}
                  </DescriptionDetails>
                </>
              ) : null}

              <DescriptionTerm>{paymentRouteTitle(hopCount)}</DescriptionTerm>
              <DescriptionDetails className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                {hopCount > 0
                  ? payment.routeHops.map((pubkey) => truncatePubkey(pubkey)).join(" → ")
                  : "Route not recorded for this payment"}
              </DescriptionDetails>

              <DescriptionTerm>Payment hash</DescriptionTerm>
              <DescriptionDetails className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md bg-zinc-100 px-3 py-2 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {payment.paymentHash}
                  </code>
                  <CopyButton value={payment.paymentHash} label="Copy hash" />
                </div>
              </DescriptionDetails>
            </DescriptionList>

            {payment.failedError ? (
              <Text className="text-sm text-red-600 dark:text-red-400">
                {payment.failedError}
              </Text>
            ) : null}

            {hopCount === 0 && payment.paymentKind === "unknown" ? (
              <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                Payments sent before this update may not include amount or route
                metadata. New payments record these details locally when you send
                them from Fiber Studio.
              </Text>
            ) : null}
          </div>
        ) : null}
      </DialogBody>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
