import type { ReactNode } from "react"
import { STEP_TITLES, type SetupStep } from "../../lib/setup/types"
import { FiberStudioLogo } from "../brand"
import { Button } from "../ui/button"
import { StepProgress } from "./StepProgress"

type SetupLayoutProps = {
  currentStep: SetupStep
  isFirstStep: boolean
  isLastStep: boolean
  isStarting?: boolean
  onBack: () => void
  onNext: () => void
  onComplete: () => void
  children: ReactNode
}

export function SetupLayout({
  currentStep,
  isFirstStep,
  isLastStep,
  isStarting = false,
  onBack,
  onNext,
  onComplete,
  children,
}: SetupLayoutProps) {
  return (
    <div className="flex h-dvh flex-col bg-zinc-100 dark:bg-zinc-950">
      <header className="border-b border-zinc-950/5 bg-white px-6 py-5 dark:border-white/10 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-6">
          <FiberStudioLogo subtitle="Setup wizard" />
          <div className="hidden w-48 sm:block">
            <StepProgress currentStep={currentStep} />
          </div>
        </div>
        <div className="mx-auto mt-4 max-w-2xl sm:hidden">
          <StepProgress currentStep={currentStep} />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-2xl">
          <p className="mb-4 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {STEP_TITLES[currentStep]}
          </p>
          <div className="rounded-lg bg-white p-6 shadow-xs ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
            {children}
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-950/5 bg-white px-6 py-4 dark:border-white/10 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <Button
            outline
            onClick={onBack}
            disabled={isFirstStep || isStarting}
            className="min-w-24"
          >
            Back
          </Button>

          <p className="hidden text-xs text-zinc-500 sm:block dark:text-zinc-400">
            {STEP_TITLES[currentStep]}
          </p>

          {isLastStep ? (
            <Button
              onClick={onComplete}
              disabled={isStarting}
              className="min-w-32"
            >
              {isStarting ? "Starting node…" : "Start node"}
            </Button>
          ) : (
            <Button
              onClick={onNext}
              disabled={isStarting}
              className="min-w-24"
            >
              Continue
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}
