/* global process */
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import dotenv from "dotenv";

// Load server-side proxy targets for local/dev proxying
dotenv.config({ path: ".env.server" });

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  const basePath = env.VITE_BASE_PATH || "/";

  // Server-side targets (prefer VITE_SERVER_*; fallback to SERVER_* from .env.server)
  const apiTarget = env.VITE_SERVER_API_URL || process.env.SERVER_API_URL;
  const otdsProxyTarget = env.VITE_SERVER_OTDS_PROXY_URL || process.env.SERVER_OTDS_PROXY_URL;
  const otdsAuthTarget = env.VITE_SERVER_OTDS_AUTH_URL || process.env.SERVER_OTDS_AUTH_URL;
  const bravaPubTarget = env.VITE_SERVER_BRAVA_PUB_URL || process.env.SERVER_BRAVA_PUB_URL;
  const bravaViewTarget = env.VITE_SERVER_BRAVA_VIEW_URL || process.env.SERVER_BRAVA_VIEW_URL;
  const bravaSearchTarget = env.VITE_SERVER_BRAVA_SEARCH_URL || process.env.SERVER_BRAVA_SEARCH_URL;
  const bravaMarkupTarget = env.VITE_SERVER_BRAVA_MARKUP_URL || process.env.SERVER_BRAVA_MARKUP_URL;
  const fileTarget = env.VITE_SERVER_FILE_URL || process.env.SERVER_FILE_URL;

  const proxyPaths = ["processes", "business-objects", "resources", "realtime-queries", "tasklist-queries", "dql-queries", "folders", "files", "contents", "currentuser"];

  // Shared proxy response handler
  const configureProxyRes = (proxy) => {
    proxy.on("proxyRes", (proxyRes) => {
      delete proxyRes.headers["www-authenticate"];
    });
  };

  const configureStripOrigin = (proxy) => {
    proxy.on("proxyReq", (proxyReq) => {
      proxyReq.removeHeader("origin");
    });
    configureProxyRes(proxy);
  };

  const proxy =
    mode === "production"
      ? undefined
      : (() => {
          const config = {};

          // ─── API Proxy — xCP REST endpoints ────────────────────────────────
          if (apiTarget) {
            config["/proxy/api"] = {
              target: apiTarget,
              changeOrigin: true,
              secure: false,
              rewrite: (path) => path.replace(/^\/proxy\/api/, ""),
              configure: (proxy) => {
                proxy.on("proxyReq", (proxyReq) => {
                  proxyReq.removeHeader("origin");
                });
                proxy.on("proxyRes", (proxyRes) => {
                  if (!proxyRes?.headers) return;

                  delete proxyRes.headers["www-authenticate"];
                });
              },
            };
          }

          if (apiTarget && Array.isArray(proxyPaths)) {
            proxyPaths.forEach((path) => {
              config[`${basePath}/${path}`] = {
                target: apiTarget,
                changeOrigin: true,
                secure: false,
                configure: (proxy) => {
                  proxy.on("proxyRes", (proxyRes) => {
                    if (!proxyRes?.headers) return;

                    delete proxyRes.headers["www-authenticate"];
                  });
                },
              };
            });
          }

          // ─── OTDS Auth ──────────────────────────────────────────────────────
          if (otdsAuthTarget) {
            config["/proxy/otds-auth"] = {
              target: otdsAuthTarget,
              changeOrigin: true,
              secure: false,
              rewrite: (path) => path.replace(/^\/proxy\/otds-auth/, ""),
              configure: configureStripOrigin,
            };
          }

          // ─── OTDS Proxy ─────────────────────────────────────────────────────
          if (otdsProxyTarget) {
            config["/proxy/otds"] = {
              target: otdsProxyTarget,
              changeOrigin: true,
              secure: false,
              rewrite: (path) => path.replace(/^\/proxy\/otds/, ""),
              configure: configureStripOrigin,
            };
          }

          // ─── Brava Publication ──────────────────────────────────────────────
          if (bravaPubTarget) {
            config["/proxy/brava-pub"] = {
              target: bravaPubTarget,
              changeOrigin: true,
              secure: false,
              rewrite: (path) => path.replace(/^\/proxy\/brava-pub/, ""),
              configure: configureProxyRes,
            };
          }

          // ─── Brava Viewer ───────────────────────────────────────────────────
          if (bravaViewTarget) {
            config["/proxy/brava-view"] = {
              target: bravaViewTarget,
              changeOrigin: true,
              secure: false,
              rewrite: (path) => path.replace(/^\/proxy\/brava-view/, ""),
              configure: configureProxyRes,
            };
          }

          // ─── Brava Search ───────────────────────────────────────────────────
          if (bravaSearchTarget) {
            config["/proxy/brava-search"] = {
              target: bravaSearchTarget,
              changeOrigin: true,
              secure: false,
              rewrite: (path) => path.replace(/^\/proxy\/brava-search/, ""),
              configure: configureProxyRes,
            };
          }

          // ─── Brava Markup ───────────────────────────────────────────────────
          if (bravaMarkupTarget) {
            config["/proxy/brava-markup"] = {
              target: bravaMarkupTarget,
              changeOrigin: true,
              secure: false,
              rewrite: (path) => path.replace(/^\/proxy\/brava-markup/, ""),
              configure: configureProxyRes,
            };
          }

          // ─── File Server ────────────────────────────────────────────────────
          if (fileTarget) {
            config["/proxy/files"] = {
              target: fileTarget,
              changeOrigin: true,
              secure: false,
              rewrite: (path) => path.replace(/^\/proxy\/files/, ""),
              configure: configureProxyRes,
            };
          }

          // ─── Brava Viewer static assets (/viewer/) ────────────────────────
          // Matches Apache: ProxyPass /viewer/ http://...:3358/viewer/
          if (bravaViewTarget) {
            config["/viewer"] = {
              target: bravaViewTarget,
              changeOrigin: true,
              secure: false,
              configure: configureProxyRes,
            };
          }

          // ─── Backend /service endpoint ────────────────────────────────────
          // Matches Apache: ProxyPass /service balancer://backend-cluster/service
          if (apiTarget) {
            config["/service"] = {
              target: apiTarget,
              changeOrigin: true,
              secure: false,
              configure: configureStripOrigin,
            };
          }

          // ─── Backend /Integration endpoint ────────────────────────────────
          // Matches Apache: ProxyPass /Integration balancer://backend-cluster/Integration
          if (apiTarget) {
            config["/Integration"] = {
              target: apiTarget,
              changeOrigin: true,
              secure: false,
              configure: configureStripOrigin,
            };
          }

          return config;
        })();

  // ── Kendo CSS tree-shaking (production only) ──────────────────────────
  // Strips CSS rules for Kendo components not used in this app.
  // Uses Vite's built-in PostCSS — no extra packages required.
  const unusedKendoComponents = [
    "k-scheduler",
    "k-spreadsheet",
    "k-gantt",
    "k-chart",
    "k-sparkline",
    "k-stockchart",
    "k-arcgauge",
    "k-lineargauge",
    "k-circulargauge",
    "k-chat",
    "k-mediaplayer",
    "k-pdf-viewer",
    "k-orgchart",
    "k-wizard",
    "k-stepper",
    "k-filemanager",
    "k-imageeditor",
    "k-scrollview",
    "k-signature",
    "k-captcha",
    "k-bottom-nav",
    "k-drawer",
    "k-treeview",
    "k-treelist",
    "k-rating",
    "k-switch",
    "k-slider",
    "k-rangeslider",
    "k-numerictextbox",
    "k-maskedtextbox",
    "k-taskboard",
    "k-pivotgrid",
    "k-listview",
    "k-listbox",
    "k-breadcrumb",
    "k-progressbar",
    "k-tilelayout",
    "k-dock-manager",
    "k-colorpicker",
    "k-colorgradient",
    "k-colorpalette",
    "k-flatcolorpicker",
    "k-coloreditor",
    "k-color-preview",
    "k-daterangepicker",
    "k-datetimepicker",
    "k-timepicker",
    "k-timedurationpicker",
    "k-upload",
    "k-card",
    "k-actionsheet",
    "k-fab",
    "k-notification",
    "k-responsivepanel",
    "k-splitbutton",
    "k-map",
  ];

  const unusedPatterns = unusedKendoComponents.map((prefix) => new RegExp(`\\.${prefix}(?:-|\\s|\\.|:|\\[|\\)|$)`));

  return {
    base: `${basePath}/`,
    plugins: [
      // Auto-redirect /Case_Management_System to /Case_Management_System/
      {
        name: "redirect-base-path",
        configureServer(server) {
          const base = `${basePath}/`;
          server.middlewares.use((req, res, next) => {
            if (req.url === basePath) {
              res.writeHead(301, { Location: base });
              res.end();
              return;
            }
            next();
          });
        },
      },
      // Dev-only: cache image/font responses for 1 hour so they show as
      // (memory cache)/(disk cache) on refresh instead of 304-revalidating.
      // Hard-reload (Cmd/Ctrl+Shift+R) to see in-place asset edits.
      {
        name: "dev-media-cache",
        apply: "serve",
        configureServer(server) {
          const MEDIA_EXT_RE = /\.(png|jpe?g|gif|webp|svg|ico|avif|bmp|woff2?|ttf|otf|eot)$/i;
          server.middlewares.use((req, res, next) => {
            const urlPath = (req.url || "").split("?")[0];
            const query = (req.url || "").split("?")[1] || "";
            // Skip Vite's `?import` virtual modules — those are JS, not the image bytes.
            if (!MEDIA_EXT_RE.test(urlPath) || query.startsWith("import")) return next();
            const originalSetHeader = res.setHeader.bind(res);
            // Block downstream Vite middleware from overriding our Cache-Control.
            res.setHeader = (name, value) => {
              if (typeof name === "string" && name.toLowerCase() === "cache-control") return res;
              return originalSetHeader(name, value);
            };
            originalSetHeader("Cache-Control", "public, max-age=3600");
            next();
          });
        },
      },
      react({
        // Process all JSX/TS files for main app only
        include: /\.(jsx|tsx|js|ts)$/,
        // Exclude node_modules and iframe directory (built separately with vite.iframe.config.js)
        exclude: [/node_modules/, /src\/iframe\/.*/],
        // Enable Fast Refresh for main app
        fastRefresh: true,
      }),
    ],
    server: {
      https: false,
      port: 3000,
      proxy,
      // Ensure public directory is served correctly
      fs: {
        // Allow serving files from public directory
        strict: false,
      },
    },
    // Ensure public directory files are available
    publicDir: "public",
    css:
      mode === "production"
        ? {
            postcss: {
              plugins: [
                {
                  postcssPlugin: "strip-unused-kendo-css",
                  Once(root) {
                    const file = root.source?.input?.file || "";
                    if (!file.includes("kendo-theme-default")) return;

                    // Remove rules targeting only unused Kendo components
                    root.walkRules((rule) => {
                      const selectors = rule.selector.split(",").map((s) => s.trim());
                      const allUnused = selectors.every((sel) => unusedPatterns.some((pattern) => pattern.test(sel)));
                      if (allUnused) rule.remove();
                    });

                    // Remove @keyframes for unused components
                    root.walkAtRules("keyframes", (atRule) => {
                      if (unusedKendoComponents.some((prefix) => atRule.params.includes(prefix))) {
                        atRule.remove();
                      }
                    });

                    // Clean up empty @media / @supports blocks
                    root.walkAtRules((atRule) => {
                      if (atRule.nodes && atRule.nodes.length === 0) atRule.remove();
                    });
                  },
                },
              ],
            },
          }
        : undefined,
    build: {
      outDir: "dist",
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          dead_code: true,
          passes: 2,
        },
        mangle: {
          toplevel: true,
        },
        format: {
          comments: false,
        },
      },
      rollupOptions: {
        input: {
          // Main app entry point only
          // Iframe bundle is built separately using vite.iframe.config.js
          main: "./index.html",
        },
        output: {
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/chunks/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash].[ext]",
          manualChunks: {
            "react-vendor": ["react", "react-dom"],
            "redux-vendor": ["@reduxjs/toolkit", "react-redux", "redux", "redux-persist"],
            "router-vendor": ["react-router-dom"],
            "chart-vendor": ["chart.js", "react-chartjs-2", "chartjs-plugin-datalabels"],
            "kendo-vendor": [
              "@progress/kendo-react-grid",
              "@progress/kendo-react-dropdowns",
              "@progress/kendo-react-dateinputs",
              "@progress/kendo-react-dialogs",
              "@progress/kendo-react-buttons",
              "@progress/kendo-react-inputs",
              "@progress/kendo-react-layout",
              "@progress/kendo-react-data-tools",
              "@progress/kendo-react-indicators",
              "@progress/kendo-data-query",
            ],
          },
        },
      },
    },
  };
});
