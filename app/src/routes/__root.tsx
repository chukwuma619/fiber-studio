import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background-secondary text-foreground">
      <Outlet />
    </div>
  )
}
