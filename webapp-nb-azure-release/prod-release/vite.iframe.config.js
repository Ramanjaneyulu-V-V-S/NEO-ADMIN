/* global process */
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Separate Vite config for iframe bundle
 *
 * Why separate?
 * - Iframe bundle doesn't need React Fast Refresh (HMR)
 * - Prevents preamble detection errors
 * - Cleaner separation of concerns
 *
 * This config builds ONLY the iframe bundle with React plugin
 * but WITHOUT Fast Refresh (no HMR preamble)
 */

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const basePath = env.VITE_BASE_PATH || "/";

  return {
    // Base path for chunk imports — must match the deployed location
    // so dynamic import() calls resolve to /Case_Management_System/iframe/chunks/...
    base: `${basePath}/iframe/`,
    plugins: [
      react({
        // Process JSX files (needed for transformation)
        include: /\.(jsx|tsx|js|ts)$/,
        exclude: /node_modules/,
        // Disable Fast Refresh completely - no HMR preamble needed
        // This prevents the preamble detection error
        fastRefresh: false,
      }),
    ],
    build: {
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
      outDir: "dist/iframe",
      rollupOptions: {
        input: "./src/iframe/main.jsx",
        output: {
          // Use fixed filename for iframe bundle so it can be referenced reliably
          // The hash is not needed since we control the deployment location
          entryFileNames: "iframeBundle.js",
          chunkFileNames: "chunks/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash].[ext]",
          manualChunks: {
            "markup-handlers": ["./src/iframe/utils/markupHandlers.js"],
            "export-handlers": ["./src/iframe/utils/exportHandlers.js"],
            "core-handlers": [
              "./src/iframe/utils/messageHandlers.js",
              "./src/iframe/utils/viewerLifecycle.js",
              "./src/iframe/utils/postMessageProtocol.js",
              "./src/iframe/utils/saveHandlers.js",
            ],
          },
        },
      },
    },
  };
});
