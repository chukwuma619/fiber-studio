import { useNavigate } from "@tanstack/react-router"
import { lazy, Suspense, useEffect, useRef, useState } from "react"
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
  stepValidationError: string | null,
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
          error={stepValidationError}
        />
      )
    case "key-file":
      return (
        <KeyFileStep
          importedPrivateKey={config.importedPrivateKey}
          onPrivateKeyChange={(importedPrivateKey) =>
            updateConfig({ importedPrivateKey })
          }
          error={stepValidationError}
        />
      )
    case "password":
      return (
        <PasswordStep
          password={config.password}
          onChange={(password) => updateConfig({ password })}
          error={stepValidationError}
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

  const stepValidationError = validateSetupStep(currentStep, config)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const heading = stepContentRef.current?.querySelector<HTMLElement>("h2")
      heading?.focus()
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
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
    if (!isLastStep && !isStarting && stepValidationError === null) {
      setCurrentStep(SETUP_STEPS[stepIndex + 1])
    }
  }

  const canProceed = stepValidationError === null

  async function handleComplete() {
    setStartError(null)
    setIsStarting(true)

    try {
      const dataDirectory = await resolveDataDirectoryForNetwork(config.network)
      const setupConfig = { ...config, dataDirectory }

      await completeSetupAndStart(setupConfig)

      const { password: _password, importedPrivateKey: _key, ...persisted } =
        setupConfig
      completeSetup({
        ...persisted,
        dataDirectory: getDataDirectoryDisplayForNetwork(config.network),
        fnnVersion: FNN_VERSION,
        password: "",
        importedPrivateKey: "",
      })
      navigate({ to: "/" })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error)
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
            stepValidationError,
          )}
        </Suspense>
      </div>
    </SetupLayout>
  )
}
