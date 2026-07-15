import { SETUP_STEPS, STEP_TITLES, type SetupStep } from "../../lib/setup/types"

export function StepProgress({ currentStep }: { currentStep: SetupStep }) {
  const index = SETUP_STEPS.indexOf(currentStep)
  const total = SETUP_STEPS.length
  const progressPercent = Math.round(((index + 1) / total) * 100)

  return (
    <div className="space-y-2">
      <p
        id="setup-step-label"
        className="text-xs font-medium text-zinc-500 dark:text-zinc-400"
      >
        Step {index + 1} of {total} — {STEP_TITLES[currentStep]}
      </p>
      <div
        role="progressbar"
        aria-labelledby="setup-step-label"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={index + 1}
        className="flex gap-1.5"
      >
        {SETUP_STEPS.map((step, stepIndex) => (
          <div
            key={step}
            className={`h-1 flex-1 rounded-full transition-colors ${
              stepIndex <= index
                ? "bg-sky-500 dark:bg-sky-400"
                : "bg-zinc-200 dark:bg-zinc-800"
            }`}
            aria-hidden
          />
        ))}
      </div>
      <span className="sr-only">{progressPercent}% complete</span>
    </div>
  )
}
