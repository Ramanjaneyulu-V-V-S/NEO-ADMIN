# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `npm run dev` (port 3000)
- **Build (production):** `npm run build` (builds main app + iframe bundle)
- **Build (UAT):** `npm run build:uat`
- **Build (dev mode):** `npm run build:dev`
- **Lint:** `npm run lint`
- **Tests:** `npm run test` (vitest, single run) or `npm run test:watch`
- **Production server:** `npm run start:prod` (Express via server.js)

Vitest has no separate config file — it uses defaults from `vite.config.js` with `jsdom` and `@testing-library/react`.

## Architecture

React 19 SPA for NABARD's Case Management System (CMS) and Digidak (digital dak/correspondence) modules. Uses Vite, Redux Toolkit with redux-persist (sessionStorage), and React Router v7.

### Two build targets

The app produces two bundles via separate Vite configs:

- **Main app** (`vite.config.js` → `dist/`): the full SPA
- **Iframe bundle** (`vite.iframe.config.js` → `dist/iframe/`): a lightweight standalone build under `src/iframe/` for embedding in external systems. Fast Refresh is disabled here to avoid HMR preamble errors in iframe context. Entry point is `src/iframe/main.jsx`.

### Key directories

- `src/pages/` — route-level page components, organized by domain (`caseManagement/`, `digidak/`, `dashboard/`, `admin/`, `login/`)
- `src/redux/` — Redux Toolkit slices mirroring the page structure; `store.jsx` combines all reducers with session-persisted state; `selectors/` for memoized selectors
- `src/services/` — API layer: `axiosConfig.js` creates the shared axios instance with JWT auth interceptors; `serviceUrl.jsx` centralizes all endpoint paths; service files per domain handle API calls
- `src/components/` — shared UI components (header, sidebar, layout, dialogs, etc.)
- `src/hooks/` — custom hooks (`useServerSideGrid`, `useSessionTimeout`, `usePdfExport`, `useDigidakGroups`, etc.)

### Environment variables

Three env file layers:

- `.env.development`, `.env.uat`, `.env.production` — Vite-consumed via `import.meta.env` (must be `VITE_*` prefixed for client-side access)
- `.env.server` — Server-only (express proxy targets like `SERVER_API_URL`), **never exposed to browser**
- `VITE_BASE_PATH` controls the base URL (defaults to `/`; production uses `/Case_Management_System/`)

### Proxy architecture

- **Dev**: Vite proxies API calls to backends configured in `.env.server`. Key proxy paths: `/proxy/api`, `/proxy/otds*`, `/proxy/brava-*`, `/proxy/files`, `/service`, `/Integration`, `/viewer/`
- **Production**: Express (`server.js`) acts as reverse proxy. Required env vars: `SERVER_API_URL`, `SERVER_OTDS_PROXY_URL`, `SERVER_OTDS_AUTH_URL` (server exits if missing)

### API & Auth pattern

- All API calls go through a shared axios instance (`src/services/axiosConfig.js`) with automatic JWT refresh and CSRF handling
- Endpoints are xCP Designer REST APIs proxied through Vite dev server (dev) or Express reverse proxy (prod)
- `ServiceUrl` class in `serviceUrl.jsx` is the single source of truth for all endpoint paths

**Token management** (`src/services/tokenManager.js`):
- Tokens stored in `sessionStorage` with `nabard_*` key prefix, plus an in-memory cache for fast reads
- JWT validated locally (checks `exp` claim with 30s early expiry buffer) — no cryptographic verification
- Auth interceptor in `authInterceptor.js` does proactive token refresh before requests and queues failed requests (max 50) during refresh to prevent thundering herd
- CSRF token extracted from `x-csrf-token` cookie and forwarded in headers
- `refreshAccessToken()` and `onRefreshFailure()` are dependency-injected to avoid circular imports

**initConfig pattern**: Runtime configuration returned by the token API as a base64-encoded JWT, stored in `sessionStorage` under `nabard_init_config`. Decoded on-access for Brava/IV viewer credentials.

### Redux store

- **Persisted slices** (via redux-persist + sessionStorage): `login`, `dashboard`, `digidakDropdown`, `digidakCorrespondence`
- All other slices are ephemeral (cleared on page refresh)
- Logout dispatches `"user/logout"` which triggers root reducer to return fresh initial state

### useServerSideGrid hook

The primary pattern for all data grids. Key behaviors:
- Server-side filtering via `filterFieldMap` (maps grid column names to API parameter names)
- Text fields listed in `textFilterFields` Set are debounced 1 second before fetch
- Optionally persists grid state (page, filters, sort) to sessionStorage via `storageKey` option
- Changing filters auto-resets to page 1; sorting is client-side only on fetched data

### UI framework

- **KendoReact** (v11) for grids, dropdowns, date pickers, dialogs — licensed component library
- **Bootstrap 5** for layout utilities
- **Chart.js** via react-chartjs-2 for dashboard charts
- **styled-components** for component-level styling
- **Framer Motion** for animations
- **SweetAlert2** for confirmation dialogs

Production build includes a custom PostCSS plugin that strips CSS for ~40 unused Kendo components (scheduler, spreadsheet, gantt, etc.) to reduce bundle size.

### Routing

All routes are lazy-loaded in `App.jsx` with per-route error boundaries (keyed by `pathname` to reset on navigation). Two route guards:

- `ProtectedRoute` — requires authentication
- `NonDDMRoute` — restricts DDM-only users from case management routes

### Session management hooks

- `useSessionSync()` — multi-tab session sync via storage events
- `useSessionTimeout()` — session timeout warning modal with countdown
- `useCheckCGMUser()` — CGM user detection on app init
- `useDDMContext()` — DDM role-based access context

### Production server details

- Base path hardcoded to `/Case_Management_System`
- Hashed assets get `1y` cache; `index.html` gets `no-cache`
- Security headers set: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
- API path detection prevents serving `index.html` for actual API calls

### ESLint rules

Uses modern flat config format (`eslint.config.js`):

- `no-unused-vars` ignores variables starting with uppercase or underscore (`varsIgnorePattern: "^[A-Z_]"`)
- React Hooks rules enforced
- `react-refresh/only-export-components` warns on non-component exports (constant exports allowed)
