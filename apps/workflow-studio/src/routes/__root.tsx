import { useEffect } from 'react'
import { createRootRoute, Outlet } from '@tanstack/react-router'

import { AppSidebar } from '@/components/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useNodeCreatorStore } from '@/stores/nodeCreatorStore'

export const rootRoute = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const closePanel = useNodeCreatorStore((s) => s.closePanel)

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePanel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closePanel])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="h-full w-full relative">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
