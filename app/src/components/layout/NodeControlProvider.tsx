import { createContext, useContext, type ReactNode } from "react"
import { useNodeControl } from "../../lib/fnn/useNodeControl"
import { MigrationRequiredDialog } from "./MigrationRequiredDialog"

type NodeControlValue = ReturnType<typeof useNodeControl>

const NodeControlContext = createContext<NodeControlValue | null>(null)

export function NodeControlProvider({ children }: { children: ReactNode }) {
  const value = useNodeControl()

  return (
    <NodeControlContext.Provider value={value}>
      {children}
      <MigrationRequiredDialog
        open={value.migrationDialog != null}
        message={value.migrationDialog?.message ?? ""}
        hasBreakingChange={value.migrationDialog?.hasBreakingChange ?? false}
        isActing={value.isActing}
        onClose={value.closeMigrationDialog}
        onConfirm={() => {
          void value.handleConfirmMigration()
        }}
      />
    </NodeControlContext.Provider>
  )
}

export function useNodeControlContext(): NodeControlValue {
  const value = useContext(NodeControlContext)
  if (!value) {
    throw new Error("useNodeControlContext must be used within NodeControlProvider")
  }
  return value
}
