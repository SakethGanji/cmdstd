import { createRouter } from '@tanstack/react-router'
import { rootRoute } from './__root'
import { editorRoute } from './editor'
import { indexRoute } from './indexRoute'
import { workflowsRoute } from './workflows'

const routeTree = rootRoute.addChildren([indexRoute, editorRoute, workflowsRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
