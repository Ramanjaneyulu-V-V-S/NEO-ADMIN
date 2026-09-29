/* global process */
import express from "express";
import compression from "compression";
import { createProxyMiddleware } from "http-proxy-middleware";
import path from "path";
import { fileURLToPath } from "url";

// Load server-side env vars from .env.server (set by deploy step)
try {
  const dotenv = await import("dotenv");
  dotenv.default.config({ path: ".env.server" });
} catch {
  // dotenv not installed — rely on process.env set externally
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const BASE_PATH = "/Case_Management_System";
const API_PATH_PREFIXES = ["processes", "business-objects", "resources", "realtime-queries", "tasklist-queries", "dql-queries", "folders", "files", "contents", "currentuser"];
const isApiPath = (requestPath) => API_PATH_PREFIXES.some((prefix) => requestPath === `/${prefix}` || requestPath.startsWith(`/${prefix}/`));

// ─── Backend targets (server-side only, NEVER exposed to browser) ────────────
const API_TARGET = process.env.SERVER_API_URL;
const OTDS_PROXY_TARGET = process.env.SERVER_OTDS_PROXY_URL;
const OTDS_AUTH_TARGET = process.env.SERVER_OTDS_AUTH_URL;
const BRAVA_PUB_TARGET = process.env.SERVER_BRAVA_PUB_URL;
const BRAVA_VIEW_TARGET = process.env.SERVER_BRAVA_VIEW_URL;
const BRAVA_SEARCH_TARGET = process.env.SERVER_BRAVA_SEARCH_URL;
const BRAVA_MARKUP_TARGET = process.env.SERVER_BRAVA_MARKUP_URL;
const FILE_TARGET = process.env.SERVER_FILE_URL;

// Validate required env vars
const required = { SERVER_API_URL: API_TARGET, SERVER_OTDS_PROXY_URL: OTDS_PROXY_TARGET, SERVER_OTDS_AUTH_URL: OTDS_AUTH_TARGET };
const missing = Object.entries(required)
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  console.error("Create .env.server from the correct .env.server.* file for your environment.");
  process.exit(1);
}

// ─── Proxy helper ────────────────────────────────────────────────────────────
const createServiceProxy = (target, stripPrefix, stripOrigin = false) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    secure: false,
    pathRewrite: { [`^${stripPrefix}`]: "" },
    cookieDomainRewrite: { "*": "" },
    on: {
      proxyReq: (proxyReq) => {
        if (stripOrigin) proxyReq.removeHeader("origin");
      },
      proxyRes: (proxyRes) => {
        delete proxyRes.headers["www-authenticate"];
      },
    },
  });

// ─── 1. API Proxy — /proxy/api/* → strips /proxy/api → forwards to xCP ──────
// Browser sees: /proxy/api/Case_Management_System/realtime-queries/...
// Backend gets: /Case_Management_System/realtime-queries/...
app.use("/proxy/api", createServiceProxy(API_TARGET, "/proxy/api", true));

// ─── 1a. Direct API Proxy — /Case_Management_System/* API families → xCP ─────
const directApiProxy = createProxyMiddleware({
  target: API_TARGET,
  changeOrigin: true,
  secure: false,
  pathRewrite: (path) => `${BASE_PATH}${path}`,
  cookieDomainRewrite: { "*": "" },
  on: {
    proxyReq: (proxyReq) => {
      proxyReq.removeHeader("origin");
    },
    proxyRes: (proxyRes) => {
      delete proxyRes.headers["www-authenticate"];
    },
  },
});

app.use(BASE_PATH, (req, res, next) => {
  if (!isApiPath(req.path)) return next();
  return directApiProxy(req, res, next);
});

// ─── 1b. Backend /service endpoint — forwarded as-is to xCP ─────────────────
// Mirrors vite.config.js dev proxy. Critical for /service/j_spring_security_logout
// to reach xCP so the server can invalidate the session and Set-Cookie clear
// the HttpOnly JSESSIONID. cookieDomainRewrite/cookiePathRewrite ensure the
// Set-Cookie response matches the cookie's original scope on this host.
app.use(
  "/service",
  createProxyMiddleware({
    target: API_TARGET,
    changeOrigin: true,
    secure: false,
    cookieDomainRewrite: { "*": "" },
    cookiePathRewrite: { "*": "/" },
    on: {
      proxyReq: (proxyReq) => {
        proxyReq.removeHeader("origin");
      },
      proxyRes: (proxyRes) => {
        delete proxyRes.headers["www-authenticate"];
      },
    },
  }),
);

// ─── 2. Service Proxies — /proxy/* routes ────────────────────────────────────
app.use("/proxy/otds", createServiceProxy(OTDS_PROXY_TARGET, "/proxy/otds"));
app.use("/proxy/otds-auth", createServiceProxy(OTDS_AUTH_TARGET, "/proxy/otds-auth"));
if (BRAVA_PUB_TARGET) app.use("/proxy/brava-pub", createServiceProxy(BRAVA_PUB_TARGET, "/proxy/brava-pub"));
if (BRAVA_VIEW_TARGET) app.use("/proxy/brava-view", createServiceProxy(BRAVA_VIEW_TARGET, "/proxy/brava-view"));
if (BRAVA_SEARCH_TARGET) app.use("/proxy/brava-search", createServiceProxy(BRAVA_SEARCH_TARGET, "/proxy/brava-search"));
if (BRAVA_MARKUP_TARGET) app.use("/proxy/brava-markup", createServiceProxy(BRAVA_MARKUP_TARGET, "/proxy/brava-markup"));
if (FILE_TARGET) app.use("/proxy/files", createServiceProxy(FILE_TARGET, "/proxy/files"));

// ─── 3. Gzip/Brotli Compression ─────────────────────────────────────────────
app.use(compression());

// ─── 4. Security Headers ─────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
  );
  next();
});

// ─── 5. Static Files — serve built React app from dist/ ──────────────────────
// Hashed assets (filename contains `-<hash>.<ext>`) get 1y immutable cache.
// Static media (images, fonts) ALSO get 1y immutable, even when not hashed —
//   if you replace a public/* image in place without renaming, users with it
//   cached will see the old copy until hard-reload. Rename the file to bust.
// Other non-hashed files (iframeBundle.js, *.html) get short revalidating cache
//   so a redeploy is picked up without users being stuck on stale code.
const HASHED_FILE_RE = /-[a-zA-Z0-9_-]{8,}\.[a-z0-9]+$/i;
const IMMUTABLE_MEDIA_RE = /\.(png|jpe?g|gif|webp|svg|ico|avif|bmp|woff2?|ttf|otf|eot)$/i;
app.use(
  `${BASE_PATH}/`,
  express.static(path.join(__dirname, "dist"), {
    etag: true,
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        return;
      }
      if (HASHED_FILE_RE.test(filePath) || IMMUTABLE_MEDIA_RE.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return;
      }
      // Non-hashed code (e.g. iframeBundle.js): revalidate with the server.
      res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
    },
  }),
);

// Serve entry HTML with no-cache so new deploys pick up new JS chunk names.
app.get(`${BASE_PATH}/`, (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// ─── 6. SPA Fallback — serve index.html for client-side routes ───────────────
app.use(`${BASE_PATH}/`, (req, res, next) => {
  // Never serve index.html for API/proxy paths; let them 404 clearly.
  const pathWithoutBase = req.path.replace(new RegExp(`^${BASE_PATH}`), "");
  if (pathWithoutBase.startsWith("/proxy/")) return next();
  if (API_PATH_PREFIXES.some((prefix) => pathWithoutBase.startsWith(`/${prefix}`))) return next();
  if (path.extname(req.path)) return next();
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Redirect root to base path
app.get("/", (req, res) => res.redirect(301, `${BASE_PATH}/`));

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  process.stdout.write(`Server running on port ${PORT}\n`);
  process.stdout.write(`App available at http://localhost:${PORT}${BASE_PATH}/\n`);
});
