import { useEffect } from 'react'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { Toaster } from 'sonner'

import { AppSidebar } from '@/components/app-sidebar'
import { ThemeProvider } from '@/components/theme-provider'
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
    <ThemeProvider defaultTheme="system" storageKey="workflow-studio-theme">
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <SidebarInset>
          <div className="h-full w-full relative">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster position="bottom-right" richColors closeButton />
    </ThemeProvider>
  )
}
