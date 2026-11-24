import { useRouterState } from "@tanstack/react-router"
import { useAppUpdateContext } from "../../lib/updates/AppUpdateProvider"
import {
  ADVANCED_NAV_ITEMS,
  isNavItemActive,
  PRIMARY_NAV_ITEMS,
  type NavItem,
} from "../../lib/nav"
import { FiberMarkIcon, FiberStudioWordmark } from "../brand"
import { Badge } from "../ui/badge"
import {
  Sidebar,
  SidebarBody,
  SidebarHeader,
  SidebarHeading,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
  SidebarSpacer,
} from "../ui/sidebar"

function NavItems({
  items,
  pathname,
  hasPendingUpdate,
}: {
  items: NavItem[]
  pathname: string
  hasPendingUpdate: boolean
}) {
  return (
    <>
      {items.map(({ id, href, label, icon: Icon }) => (
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
    </>
  )
}

export function AppSidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { hasPendingUpdate } = useAppUpdateContext()

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarItem href="/" className="[&>a]:gap-0">
          <FiberMarkIcon data-slot="avatar" />
          <SidebarLabel>
            <FiberStudioWordmark layout="inline" />
          </SidebarLabel>
        </SidebarItem>
      </SidebarHeader>

      <SidebarBody>
        <SidebarSection>
          <NavItems
            items={PRIMARY_NAV_ITEMS}
            pathname={pathname}
            hasPendingUpdate={hasPendingUpdate}
          />
        </SidebarSection>

        <SidebarSection>
          <SidebarHeading>Advanced</SidebarHeading>
          <NavItems
            items={ADVANCED_NAV_ITEMS}
            pathname={pathname}
            hasPendingUpdate={hasPendingUpdate}
          />
        </SidebarSection>

        <SidebarSpacer />
      </SidebarBody>
    </Sidebar>
  )
}
