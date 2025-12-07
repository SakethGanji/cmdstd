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
      // Proxy tRPC requests to the backend
      '/trpc': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Proxy webhook requests to the backend
      '/webhook': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})