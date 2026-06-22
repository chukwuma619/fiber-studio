import { useRouterState } from "@tanstack/react-router"
import { useAppUpdateContext } from "../../lib/updates/AppUpdateProvider"
import { isNavItemActive, NAV_ITEMS } from "../../lib/nav"
import { FiberMarkIcon, FiberStudioWordmark } from "../brand"
import { Badge } from "../ui/badge"
import {
  Sidebar,
  SidebarBody,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
  SidebarSpacer,
} from "../ui/sidebar"

export function AppSidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { hasPendingUpdate } = useAppUpdateContext()

  return (
    <Sidebar>
      <SidebarHeader className="border-r">
        <SidebarItem href="/">
          <FiberMarkIcon data-slot="avatar" />
          <SidebarLabel>
            <FiberStudioWordmark layout="inline" />
          </SidebarLabel>
        </SidebarItem>
      </SidebarHeader>

      <SidebarBody>
        <SidebarSection>
          {NAV_ITEMS.map(({ id, href, label, icon: Icon }) => (
            <SidebarItem
              key={id}
              href={href}
              current={isNavItemActive(pathname, href)}
            >
              <Icon data-slot="icon" aria-hidden />
              <SidebarLabel className="flex items-center gap-2">
                <span>{label}</span>
                {id === "settings" && hasPendingUpdate ? (
                  <Badge color="blue" className="px-1.5 py-0 text-[10px]/4">
                    Update
                  </Badge>
                ) : null}
              </SidebarLabel>
            </SidebarItem>
          ))}
        </SidebarSection>

        <SidebarSpacer />
      </SidebarBody>
    </Sidebar>
  )
}
