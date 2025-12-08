"use client"

import * as React from "react"
import { Link, useMatchRoute } from "@tanstack/react-router"
import { Moon, Sun, Sparkles, Workflow } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useTheme } from "@/components/theme-provider"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarGroup,
  SidebarGroupContent,
  useSidebar,
} from "@/components/ui/sidebar"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const matchRoute = useMatchRoute()
  const isEditorActive = matchRoute({ to: '/editor' })
  const { theme, setTheme } = useTheme()

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <Sidebar collapsible="icon" variant="floating" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Command Studio">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg border-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-950">
                <Sparkles className="size-4 text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold tracking-wide uppercase text-blue-600 dark:text-blue-400">Command</span>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-blue-600 dark:bg-blue-500 text-white">Studio</span>
                </div>
                <span className="truncate text-[10px] text-muted-foreground/60 italic">by Luna</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={!!isEditorActive} tooltip="Editor">
                  <Link to="/editor">
                    <Workflow />
                    <span>Editor</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleTheme} tooltip={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              <Sun className="h-4 w-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
              <Moon className="absolute h-4 w-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
              <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Profile">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg">SG</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Saketh G</span>
                <span className="truncate text-xs">saketh@example.com</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
