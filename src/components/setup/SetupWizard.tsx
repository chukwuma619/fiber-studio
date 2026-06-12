import { useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import {
  getDefaultDataDirectoryDisplay,
  resolveDataDirectory,
  resolveDefaultDataDirectory,
} from "../../lib/data-directory"
import { getRelay } from "../../lib/public-relays"
import { completeSetup } from "../../lib/setup/storage"
import {
  createDefaultSetupConfig,
  SETUP_STEPS,
  type SetupConfig,
  type SetupStep,
} from "../../lib/setup/types"
import { SetupLayout } from "./SetupLayout"
import { DataDirectoryStep } from "./steps/DataDirectoryStep"
import { KeyFileStep } from "./steps/KeyFileStep"
import { NetworkStep } from "./steps/NetworkStep"
import { PasswordStep } from "./steps/PasswordStep"
import { PublicNetworkStep } from "./steps/PublicNetworkStep"
import { ReviewStep } from "./steps/ReviewStep"
import { WelcomeStep } from "./steps/WelcomeStep"

function renderStepContent(
  step: SetupStep,
  config: SetupConfig,
  updateConfig: (patch: Partial<SetupConfig>) => void,
) {
  switch (step) {
    case "welcome":
      return <WelcomeStep />
    case "network":
      return (
        <NetworkStep
          network={config.network}
          onChange={(network) => {
            const patch: Partial<SetupConfig> = { network }
            if (config.publicConnectionMode === "official-relays") {
              const node1 = getRelay(network, "node1")
              patch.customPublicNodePubkey = node1.pubkey
              patch.customPublicNodeMultiaddr = node1.multiaddr ?? ""
            }
            updateConfig(patch)
          }}
        />
      )
    case "public-network":
      return (
        <PublicNetworkStep
          config={config}
          onChange={(patch) => updateConfig(patch)}
        />
      )
    case "data-directory":
      return (
        <DataDirectoryStep
          dataDirectory={config.dataDirectory}
          onChange={(dataDirectory) => updateConfig({ dataDirectory })}
        />
      )
    case "key-file":
      return (
        <KeyFileStep
          keyFileMode={config.keyFileMode}
          keyFilePath={config.keyFilePath}
          importedPrivateKey={config.importedPrivateKey}
          dataDirectory={config.dataDirectory}
          onModeChange={(keyFileMode) =>
            updateConfig({
              keyFileMode,
              keyFilePath: keyFileMode === "import" ? "" : "ckb/key",
              importedPrivateKey: "",
            })
          }
          onPathChange={(keyFilePath) => updateConfig({ keyFilePath })}
          onPrivateKeyChange={(importedPrivateKey) =>
            updateConfig({ importedPrivateKey })
          }
        />
      )
    case "password":
      return (
        <PasswordStep
          password={config.password}
          onChange={(password) => updateConfig({ password })}
        />
      )
    case "review":
      return <ReviewStep config={config} />
    default: {
      const _exhaustive: never = step
      return _exhaustive
    }
  }
}

export function SetupWizard() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState<SetupStep>("welcome")
  const [config, setConfig] = useState<SetupConfig>(createDefaultSetupConfig)

  useEffect(() => {
    let cancelled = false

    resolveDefaultDataDirectory().then((dir) => {
      if (cancelled) return
      setConfig((prev) => {
        const displayDefault = getDefaultDataDirectoryDisplay()
        if (!prev.dataDirectory || prev.dataDirectory === displayDefault) {
          return { ...prev, dataDirectory: dir }
        }
        return prev
      })
    })

    return () => {
      cancelled = true
    }
  }, [])

  const stepIndex = SETUP_STEPS.indexOf(currentStep)
  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === SETUP_STEPS.length - 1

  function updateConfig(patch: Partial<SetupConfig>) {
    setConfig((prev) => ({ ...prev, ...patch }))
  }

  function goBack() {
    if (!isFirstStep) {
      setCurrentStep(SETUP_STEPS[stepIndex - 1])
    }
  }

  function goNext() {
    if (!isLastStep) {
      setCurrentStep(SETUP_STEPS[stepIndex + 1])
    }
  }

  async function handleComplete() {
    const dataDirectory = await resolveDataDirectory(config.dataDirectory)
    completeSetup({ ...config, dataDirectory })
    navigate({ to: "/" })
  }

  return (
    <SetupLayout
      currentStep={currentStep}
      isFirstStep={isFirstStep}
      isLastStep={isLastStep}
      onBack={goBack}
      onNext={goNext}
      onComplete={handleComplete}
    >
      {renderStepContent(currentStep, config, updateConfig)}
    </SetupLayout>
  )
}
