import { useCallback, useState } from "react"
import {
  cancelInvoice,
  createInvoice,
  getPayment,
  parseInvoicePreview,
  previewKeysendPayment,
  previewSendPayment,
  sendKeysendPayment,
  sendPayment,
} from "./invoke"
import type {
  CreateInvoicePayload,
  KeysendPaymentPayload,
  ParseInvoicePayload,
  ParseInvoicePreview,
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

  const handleParseInvoicePreview = useCallback(
    async (payload: ParseInvoicePayload): Promise<ParseInvoicePreview> => {
      setActionError(null)
      try {
        return await parseInvoicePreview(payload)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setActionError(message)
        throw error
      }
    },
    [],
  )

  const handleSendKeysendPayment = useCallback(
    async (payload: KeysendPaymentPayload): Promise<SendPaymentResult> => {
      setIsActing(true)
      setActionError(null)
      try {
        return await sendKeysendPayment(payload)
      } catch (error) {
        setActionError(error instanceof Error ? error.message : String(error))
        throw error
      } finally {
        setIsActing(false)
      }
    },
    [],
  )

  const handlePreviewKeysendPayment = useCallback(
    async (payload: KeysendPaymentPayload): Promise<PreviewSendPaymentResult> => {
      setActionError(null)
      try {
        return await previewKeysendPayment(payload)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setActionError(message)
        throw error
      }
    },
    [],
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
    previewKeysendPayment: handlePreviewKeysendPayment,
    sendKeysendPayment: handleSendKeysendPayment,
    getPayment: handleGetPayment,
    cancelInvoice: handleCancelInvoice,
    parseInvoicePreview: handleParseInvoicePreview,
    clearActionError,
  }
}
