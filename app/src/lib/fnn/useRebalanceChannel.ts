import { useCallback, useState } from "react"
import { getErrorMessage } from "./errors"
import { getPayment, previewRebalanceChannel, rebalanceChannel } from "./invoke"
import type {
  PaymentHashPayload,
  RebalanceChannelPayload,
  RebalanceChannelResult,
  SendPaymentResult,
} from "./types"

export function useRebalanceChannel(onSuccess?: () => void) {
  const [isActing, setIsActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const handlePreview = useCallback(
    async (payload: RebalanceChannelPayload): Promise<RebalanceChannelResult> => {
      return previewRebalanceChannel(payload)
    },
    [],
  )

  const handleRebalance = useCallback(
    async (payload: RebalanceChannelPayload): Promise<RebalanceChannelResult> => {
      setIsActing(true)
      setActionError(null)
      try {
        return await rebalanceChannel({ ...payload, dryRun: false })
      } catch (error) {
        setActionError(getErrorMessage(error))
        throw error
      } finally {
        setIsActing(false)
      }
    },
    [],
  )

  const handleGetPayment = useCallback(
    async (payload: PaymentHashPayload): Promise<SendPaymentResult> => {
      return getPayment(payload)
    },
    [],
  )

  const clearActionError = useCallback(() => {
    setActionError(null)
  }, [])

  const markSettled = useCallback(() => {
    onSuccess?.()
  }, [onSuccess])

  return {
    isActing,
    actionError,
    handlePreview,
    handleRebalance,
    handleGetPayment,
    markSettled,
    clearActionError,
  }
}
