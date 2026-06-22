import type { ReactNode } from "react"
import { AppUpdateProvider } from "../../lib/updates/AppUpdateProvider"
import { SidebarLayout } from "../ui/sidebar-layout"
import { AppHeader } from "./AppHeader"
import { AppNavbar } from "./AppNavbar"
import { AppSidebar } from "./AppSidebar"
import { NodeControlProvider } from "./NodeControlProvider"

type HomeLayoutProps = {
  children: ReactNode
}

export function HomeLayout({ children }: HomeLayoutProps) {
  return (
    <NodeControlProvider>
      <AppUpdateProvider>
        <SidebarLayout
          navbar={<AppNavbar />}
          sidebar={<AppSidebar />}
          header={<AppHeader />}
        >
          {children}
        </SidebarLayout>
      </AppUpdateProvider>
    </NodeControlProvider>
  )
}
