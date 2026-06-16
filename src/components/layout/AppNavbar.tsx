import { Badge } from "../ui/badge"
import {
  Navbar,
  NavbarLabel,
  NavbarSection,
  NavbarSpacer,
} from "../ui/navbar"
import {
  formatNetworkLabel,
  nodeHeaderLabel,
} from "../../lib/fnn/useNodeControl"
import { useNodeControlContext } from "./NodeControlProvider"

export function AppNavbar() {
  const { config, status, isLoading } = useNodeControlContext()

  return (
    <Navbar>
      <NavbarSection>
        <NavbarLabel>Fiber Studio</NavbarLabel>
      </NavbarSection>
      <NavbarSpacer />
      <NavbarSection>
        <Badge color="zinc">{formatNetworkLabel(config?.network)}</Badge>
        <span className="hidden text-sm/5 text-zinc-500 sm:inline dark:text-zinc-400">
          {nodeHeaderLabel(status, isLoading)}
        </span>
      </NavbarSection>
    </Navbar>
  )
}
