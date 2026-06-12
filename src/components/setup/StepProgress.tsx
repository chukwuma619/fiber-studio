import { SETUP_STEPS, type SetupStep } from "../../lib/setup/types"

export function StepProgress({ currentStep }: { currentStep: SetupStep }) {
  const index = SETUP_STEPS.indexOf(currentStep)
  const total = SETUP_STEPS.length

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Step {index + 1} of {total}
      </p>
      <div className="flex gap-1.5">
        {SETUP_STEPS.map((step, stepIndex) => (
          <div
            key={step}
            className={`h-1 flex-1 rounded-full transition-colors ${
              stepIndex <= index
                ? "bg-zinc-900 dark:bg-white"
                : "bg-zinc-200 dark:bg-zinc-800"
            }`}
            aria-hidden
          />
        ))}
      </div>
    </div>
  )
}
