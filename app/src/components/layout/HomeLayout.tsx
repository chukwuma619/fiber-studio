import type { ReactNode } from "react"
import { AppUpdateProvider } from "../../lib/updates/AppUpdateProvider"
import { SidebarLayout } from "../ui/sidebar-layout"
import { AppHeader } from "./AppHeader"
import { AppNavbar } from "./AppNavbar"
import { AppSidebar } from "./AppSidebar"
import { NodeControlProvider } from "./NodeControlProvider"
import { PageTransition } from "./PageTransition"

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
          <PageTransition>{children}</PageTransition>
        </SidebarLayout>
      </AppUpdateProvider>
    </NodeControlProvider>
  )
}
