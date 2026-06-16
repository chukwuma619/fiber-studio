import { createContext, useContext, type ReactNode } from "react"
import { useNodeControl } from "../../lib/fnn/useNodeControl"

type NodeControlValue = ReturnType<typeof useNodeControl>

const NodeControlContext = createContext<NodeControlValue | null>(null)

export function NodeControlProvider({ children }: { children: ReactNode }) {
  const value = useNodeControl()

  return (
    <NodeControlContext.Provider value={value}>{children}</NodeControlContext.Provider>
  )
}

export function useNodeControlContext(): NodeControlValue {
  const value = useContext(NodeControlContext)
  if (!value) {
    throw new Error("useNodeControlContext must be used within NodeControlProvider")
  }
  return value
}
