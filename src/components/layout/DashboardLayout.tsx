import type { ReactNode } from "react"
import { SidebarLayout } from "../ui/sidebar-layout"
import { AppHeader } from "./AppHeader"
import { AppNavbar } from "./AppNavbar"
import { AppSidebar } from "./AppSidebar"
import { NodeControlProvider } from "./NodeControlProvider"

type DashboardLayoutProps = {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <NodeControlProvider>
      <SidebarLayout
        navbar={<AppNavbar />}
        sidebar={<AppSidebar />}
        header={<AppHeader />}
      >
        {children}
      </SidebarLayout>
    </NodeControlProvider>
  )
}
