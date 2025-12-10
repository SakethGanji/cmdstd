import { useEffect } from 'react'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { Toaster } from 'sonner'

import { AppSidebar } from '@/shared/components/app-sidebar'
import { ThemeProvider } from '@/shared/components/theme-provider'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import { SidebarInset, SidebarProvider } from '@/shared/components/ui/sidebar'
import { useNodeCreatorStore } from '@/features/workflow-editor/stores/nodeCreatorStore'

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
      <ErrorBoundary>
        <SidebarProvider defaultOpen={false}>
          <AppSidebar />
          <SidebarInset>
            <div className="h-full w-full relative">
              <Outlet />
            </div>
          </SidebarInset>
        </SidebarProvider>
      </ErrorBoundary>
      <Toaster position="bottom-right" richColors closeButton />
    </ThemeProvider>
  )
}
