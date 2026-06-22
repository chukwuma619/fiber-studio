import { useRouterState } from "@tanstack/react-router"
import { isNavItemActive, NAV_ITEMS } from "../../lib/nav"
import { FiberMarkIcon, FiberStudioWordmark } from "../brand"
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
              <Icon data-slot="icon" aria-hidden  />
              <SidebarLabel>{label}</SidebarLabel>
            </SidebarItem>
          ))}
        </SidebarSection>

        <SidebarSpacer />
      </SidebarBody>


    </Sidebar>
  )
}
