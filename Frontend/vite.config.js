import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Bare denne maskinen som standard. Sett VITE_HOST=0.0.0.0 for å åpne for nettverket.
const devHost = process.env.VITE_HOST || "localhost";
// Ekstra vertsnavn (f.eks. en tunnel) kommaseparert i VITE_ALLOWED_HOSTS.
const allowedHosts = (process.env.VITE_ALLOWED_HOSTS || "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);
const devPort = Number(process.env.VITE_PORT || 5173);
const apiProxyTarget =
  process.env.VITE_API_PROXY_TARGET || "http://localhost:5277";
const hmrHost = process.env.VITE_HMR_HOST || undefined;
const hmrClientPort = process.env.VITE_HMR_CLIENT_PORT
  ? Number(process.env.VITE_HMR_CLIENT_PORT)
  : undefined;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "lucide-react": "lucide-react/dist/cjs/lucide-react.js",
    },
  },
  server: {
    host: devHost,
    port: devPort,
    strictPort: true,
    allowedHosts,
    hmr:
      hmrHost || hmrClientPort
        ? {
            host: hmrHost,
            clientPort: hmrClientPort,
          }
        : undefined,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
      },
      "/tiles": {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
