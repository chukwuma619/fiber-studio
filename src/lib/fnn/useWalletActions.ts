import { useCallback, useState } from "react"
import {
  cancelInvoice,
  createInvoice,
  getPayment,
  previewSendPayment,
  sendPayment,
} from "./invoke"
import type {
  CreateInvoicePayload,
  PaymentHashPayload,
  PreviewSendPaymentResult,
  SendPaymentPayload,
  SendPaymentResult,
} from "./types"

export function useWalletActions(onSuccess?: () => void) {
  const [isActing, setIsActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleCreateInvoice = useCallback(
    async (payload: CreateInvoicePayload) => {
      setIsActing(true)
      setActionError(null)
      try {
        const result = await createInvoice(payload)
        onSuccess?.()
        return result
      } catch (error) {
        setActionError(error instanceof Error ? error.message : String(error))
        throw error
      } finally {
        setIsActing(false)
      }
    },
    [onSuccess],
  )

  const handlePreviewSendPayment = useCallback(
    async (payload: SendPaymentPayload): Promise<PreviewSendPaymentResult> => {
      setActionError(null)
      try {
        return await previewSendPayment(payload)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setActionError(message)
        throw error
      }
    },
    [],
  )

  const handleSendPayment = useCallback(
    async (payload: SendPaymentPayload): Promise<SendPaymentResult> => {
      setIsActing(true)
      setActionError(null)
      try {
        return await sendPayment(payload)
      } catch (error) {
        setActionError(error instanceof Error ? error.message : String(error))
        throw error
      } finally {
        setIsActing(false)
      }
    },
    [],
  )

  const handleGetPayment = useCallback(
    async (payload: PaymentHashPayload): Promise<SendPaymentResult> => {
      try {
        return await getPayment(payload)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setActionError(message)
        throw error
      }
    },
    [],
  )

  const handleCancelInvoice = useCallback(
    async (payload: PaymentHashPayload) => {
      setIsActing(true)
      setActionError(null)
      try {
        const result = await cancelInvoice(payload)
        onSuccess?.()
        return result
      } catch (error) {
        setActionError(error instanceof Error ? error.message : String(error))
        throw error
      } finally {
        setIsActing(false)
      }
    },
    [onSuccess],
  )

  const clearActionError = useCallback(() => {
    setActionError(null)
  }, [])

  return {
    isActing,
    actionError,
    createInvoice: handleCreateInvoice,
    previewSendPayment: handlePreviewSendPayment,
    sendPayment: handleSendPayment,
    getPayment: handleGetPayment,
    cancelInvoice: handleCancelInvoice,
    clearActionError,
  }
}
