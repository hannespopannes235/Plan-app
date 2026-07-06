import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Plan – Haushalt organisieren",
        short_name: "Plan",
        description:
          "Gemeinsam den Haushalt organisieren: Einkaufslisten, Aufgaben, Essensplanung, Budget und Kalender.",
        theme_color: "#f59e0b",
        background_color: "#fffbf5",
        display: "standalone",
        orientation: "portrait",
        lang: "de",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // Diese Pfade gehören PocketBase (API, Admin-UI, Kalender-Feed) und
        // dürfen nicht vom SPA-Fallback (index.html) abgefangen werden.
        navigateFallbackDenylist: [/^\/api\//, /^\/_\//, /^\/ics\//],
        runtimeCaching: [
          {
            // PocketBase-API – immer Netzwerk zuerst, Cache nur als Fallback.
            // Der Realtime-Stream (/api/realtime) wird bewusst NICHT gecacht.
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/api/") && url.pathname !== "/api/realtime",
            handler: "NetworkFirst",
            options: {
              cacheName: "pocketbase-api",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
          pocketbase: ["pocketbase"],
        },
      },
    },
  },
});
