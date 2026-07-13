import { useNavigate } from "@tanstack/react-router"
import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { normalizeCkbPrivateKey } from "../../lib/ckb-key"
import {
  getDataDirectoryDisplayForNetwork,
  resolveDataDirectoryForNetwork,
} from "../../lib/data-directory"
import { completeSetupAndStart } from "../../lib/fnn/invoke"
import { FNN_VERSION } from "../../lib/fnn/types"
import { getRelay } from "../../lib/public-relays"
import { completeSetup } from "../../lib/setup/storage"
import { validateSetupStep } from "../../lib/setup/validation"
import {
  createDefaultSetupConfig,
  SETUP_STEPS,
  type NetworkChoice,
  type SetupConfig,
  type SetupStep,
} from "../../lib/setup/types"
import { Skeleton } from "../ui/skeleton"
import { SetupLayout } from "./SetupLayout"
import { getErrorMessage } from "../../lib/fnn/errors"

const WelcomeStep = lazy(() =>
  import("./steps/WelcomeStep").then((module) => ({ default: module.WelcomeStep })),
)
const NetworkStep = lazy(() =>
  import("./steps/NetworkStep").then((module) => ({ default: module.NetworkStep })),
)
const PublicNetworkStep = lazy(() =>
  import("./steps/PublicNetworkStep").then((module) => ({
    default: module.PublicNetworkStep,
  })),
)
const KeyFileStep = lazy(() =>
  import("./steps/KeyFileStep").then((module) => ({ default: module.KeyFileStep })),
)
const PasswordStep = lazy(() =>
  import("./steps/PasswordStep").then((module) => ({ default: module.PasswordStep })),
)
const ReviewStep = lazy(() =>
  import("./steps/ReviewStep").then((module) => ({ default: module.ReviewStep })),
)

function StepSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="mt-6 h-10 w-full" />
    </div>
  )
}

function applyNetworkChange(
  config: SetupConfig,
  network: NetworkChoice,
): Partial<SetupConfig> {
  const patch: Partial<SetupConfig> = {
    network,
    dataDirectory: getDataDirectoryDisplayForNetwork(network),
  }
  if (config.publicConnectionMode === "official-relays") {
    const node1 = getRelay(network, "node1")
    patch.customPublicNodePubkey = node1.pubkey
    patch.customPublicNodeMultiaddr = node1.multiaddr ?? ""
  }
  return patch
}

function renderStepContent(
  step: SetupStep,
  config: SetupConfig,
  updateConfig: (patch: Partial<SetupConfig>) => void,
  startError: string | null,
  displayedStepError: string | null,
) {
  switch (step) {
    case "welcome":
      return <WelcomeStep />
    case "network":
      return (
        <NetworkStep
          network={config.network}
          onChange={(network) => updateConfig(applyNetworkChange(config, network))}
        />
      )
    case "public-network":
      return (
        <PublicNetworkStep
          config={config}
          onChange={(patch) => updateConfig(patch)}
          error={displayedStepError}
        />
      )
    case "key-file":
      return (
        <KeyFileStep
          importedPrivateKey={config.importedPrivateKey}
          onPrivateKeyChange={(importedPrivateKey) =>
            updateConfig({ importedPrivateKey })
          }
          error={displayedStepError}
        />
      )
    case "password":
      return (
        <PasswordStep
          password={config.password}
          passwordConfirm={config.passwordConfirm}
          onPasswordChange={(password) => updateConfig({ password })}
          onPasswordConfirmChange={(passwordConfirm) =>
            updateConfig({ passwordConfirm })
          }
          error={displayedStepError}
        />
      )
    case "review":
      return <ReviewStep config={config} startError={startError} />
    default: {
      const _exhaustive: never = step
      return _exhaustive
    }
  }
}

export function SetupWizard() {
  const navigate = useNavigate()
  const stepContentRef = useRef<HTMLDivElement>(null)
  const [currentStep, setCurrentStep] = useState<SetupStep>("welcome")
  const [config, setConfig] = useState<SetupConfig>(createDefaultSetupConfig)
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [stepErrorsShown, setStepErrorsShown] = useState(false)

  const stepValidationError = validateSetupStep(currentStep, config)
  const displayedStepError = stepErrorsShown ? stepValidationError : null

  useEffect(() => {
    setStepErrorsShown(false)
  }, [currentStep])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const heading = stepContentRef.current?.querySelector<HTMLElement>("h2")
      heading?.focus()
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [currentStep])

  useEffect(() => {
    if (currentStep !== "password") return
    setConfig((prev) =>
      prev.password || prev.passwordConfirm
        ? { ...prev, password: "", passwordConfirm: "" }
        : prev,
    )
  }, [currentStep])

  const stepIndex = SETUP_STEPS.indexOf(currentStep)
  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === SETUP_STEPS.length - 1

  function updateConfig(patch: Partial<SetupConfig>) {
    setConfig((prev) => ({ ...prev, ...patch }))
  }

  function goBack() {
    if (!isFirstStep && !isStarting) {
      setCurrentStep(SETUP_STEPS[stepIndex - 1])
    }
  }

  function goNext() {
    if (isLastStep || isStarting) return

    const error = validateSetupStep(currentStep, config)
    if (error) {
      setStepErrorsShown(true)
      return
    }

    if (currentStep === "key-file" && config.importedPrivateKey.trim()) {
      setConfig((prev) => ({
        ...prev,
        importedPrivateKey: normalizeCkbPrivateKey(prev.importedPrivateKey),
      }))
    }
    setCurrentStep(SETUP_STEPS[stepIndex + 1])
  }

  const canProceed = !isStarting

  async function handleComplete() {
    setStartError(null)
    setIsStarting(true)

    try {
      const dataDirectory = await resolveDataDirectoryForNetwork(config.network)
      const setupConfig = { ...config, dataDirectory }

      await completeSetupAndStart(setupConfig)

      const { password: _password, passwordConfirm: _confirm, importedPrivateKey: _key, ...persisted } =
        setupConfig
      completeSetup({
        ...persisted,
        dataDirectory: getDataDirectoryDisplayForNetwork(config.network),
        fnnVersion: FNN_VERSION,
        password: "",
        passwordConfirm: "",
        importedPrivateKey: "",
      })
      navigate({ to: "/" })
    } catch (error) {
      const message =
        getErrorMessage(error)
      setStartError(message)
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <SetupLayout
      currentStep={currentStep}
      isFirstStep={isFirstStep}
      isLastStep={isLastStep}
      isStarting={isStarting}
      canProceed={canProceed}
      onBack={goBack}
      onNext={goNext}
      onComplete={handleComplete}
    >
      <div ref={stepContentRef}>
        <Suspense fallback={<StepSkeleton />}>
          {renderStepContent(
            currentStep,
            config,
            updateConfig,
            startError,
            displayedStepError,
          )}
        </Suspense>
      </div>
    </SetupLayout>
  )
}
