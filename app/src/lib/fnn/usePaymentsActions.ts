import { useCallback, useState } from "react"
import { getErrorMessage } from "./errors"
import {
  cancelInvoice,
  createInvoice,
  getPayment,
  importInvoice,
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
        setActionError(getErrorMessage(error))
        throw error
      } finally {
        setIsActing(false)
      }
    },
    [onSuccess],
  )

  const handlePreviewSendPayment = useCallback(
    async (payload: SendPaymentPayload): Promise<PreviewSendPaymentResult> => {
      // Preview failures stay local to the send panel — do not set actionError.
      return await previewSendPayment(payload)
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
      // Polling errors stay local to the send dialog — do not set actionError.
      return await getPayment(payload)
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
        setActionError(getErrorMessage(error))
        throw error
      } finally {
        setIsActing(false)
      }
    },
    [onSuccess],
  )

  const handleParseInvoicePreview = useCallback(
    async (payload: ParseInvoicePayload): Promise<ParseInvoicePreview> => {
      // Parse failures stay local to the send panel — do not set actionError.
      return await parseInvoicePreview(payload)
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
        setActionError(getErrorMessage(error))
        throw error
      } finally {
        setIsActing(false)
      }
    },
    [],
  )

  const handlePreviewKeysendPayment = useCallback(
    async (payload: KeysendPaymentPayload): Promise<PreviewSendPaymentResult> => {
      // Preview failures stay local to the send panel — do not set actionError.
      return await previewKeysendPayment(payload)
    },
    [],
  )

  const handleImportInvoice = useCallback(
    async (payload: PaymentHashPayload) => {
      setIsActing(true)
      setActionError(null)
      try {
        const result = await importInvoice(payload)
        onSuccess?.()
        return result
      } catch (error) {
        setActionError(getErrorMessage(error))
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
    previewKeysendPayment: handlePreviewKeysendPayment,
    sendKeysendPayment: handleSendKeysendPayment,
    getPayment: handleGetPayment,
    cancelInvoice: handleCancelInvoice,
    importInvoice: handleImportInvoice,
    parseInvoicePreview: handleParseInvoicePreview,
    clearActionError,
  }
}
