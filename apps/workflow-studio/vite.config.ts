import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  // @ts-expect-error - vite version mismatch between root and app
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy REST API requests to the backend
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Proxy webhook requests to the backend
      '/webhook': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Proxy execution stream SSE requests to the backend
      '/execution-stream': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})