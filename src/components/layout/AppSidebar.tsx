import { useRouterState } from "@tanstack/react-router"
import { isNavItemActive, NAV_ITEMS } from "../../lib/nav"
import { Avatar } from "../ui/avatar"
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
        <SidebarItem href="/" >
          <Avatar
            square
            initials="F"
          />
          <SidebarLabel>Fiber Studio</SidebarLabel>
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
