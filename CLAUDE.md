# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NBSupportApp is an enterprise support portal for NABARD that manages cases, workflows, users, and groups. It integrates with **Documentum ECM** via its REST API as the backend data store — there is no traditional database.

## Prerequisites

- Java 17 (specified in `pom.xml`)
- Maven (installed globally — no Maven wrapper in repo; `mvnw` is gitignored)
- Node.js (LTS recommended)

## Commands

### Full Stack
```bash
./start_services.sh   # Start both services (uses mvn, not mvnw)
./stop_services.sh    # Stop both services (kills processes on ports 8080 & 5173)
```

### Backend (Spring Boot 3.4.1 / Java 17)
```bash
cd backend
mvn spring-boot:run          # Run dev server on port 8080
mvn clean install            # Build
mvn test                     # Run tests
```

### Frontend (React 19 / Vite 7 / Tailwind CSS)
```bash
cd frontend
npm install        # First time only — node_modules is gitignored
npm run dev        # Vite dev server on port 5173
npm run build      # Production build
npm run lint       # ESLint
npm run preview    # Preview production build
```

## Architecture

```
React (Vite, port 5173)
    ↓ axios (baseURL /neoadminBackend/api, dev-proxied to http://localhost:8080)
Spring Boot Controllers
    ↓
Service Layer (business logic)
    ↓ RestClient (HTTPS, self-signed cert bypass)
Documentum REST API (dctm-rest)
    ↓
ECM Repository (NABARDUAT)
```

### Backend (`backend/src/main/java/com/example/backend/`)

Layered architecture: **Controller → Service → Documentum REST calls** (no JPA/repository layer).

- **Controllers**: Auth, Case, Workflow, Group, User, Query, Settings — all under `/api/`
- **Services**: Each controller has a corresponding service. `DctmAuthService` handles service-account login tickets with 9-minute caching.
- **Config**: `DctmConfig` (Documentum connection), `AppConfig` (app settings), `RestClientConfig` (SSL-bypassing RestClient bean)
- **DTOs**: `AuthResponse`, `LoginRequest`
- **Auth flow**: Basic Auth against Documentum → login ticket generation → support team can impersonate users via `generateUserLoginTicket`

Key Documentum object types: `cms_case_folder`, `dm_process`, `dm_user`, `dm_group`. Queries use DQL (Documentum Query Language).

### Frontend (`frontend/src/`)

- **Pages** (`frontend/src/pages/`): ~16 pages — Login, Users, Cases, Reports, Workflows, Groups, Inbox, NABARD Department Management, HO Vertical Management, RO/TE Department Head Assignment, Metadata, SFS, Query (+ redirect stubs) — routed under `/dashboard/*`
- **Layout**: `MainLayout` wraps protected routes with a drawer `Sidebar` (Records / Configuration / Tools sections, role-gated) + a slim `Topbar` (breadcrumb + profile dropdown)
- **Design system**: "Field ledger" — semantic Tailwind tokens + a shared primitive library in `frontend/src/components/ui/` (barrel `index.js`). See `frontend/src/components/ui/README.md` and `techdocs/frontend-architecture.md`
- **API layer**: `api/axios.js` — axios instance, `baseURL: "/neoadminBackend/api"`, dev-proxied to `http://localhost:8080` (strips `/neoadminBackend`) in `vite.config.js`; request interceptor attaches a `Bearer` token from `localStorage` when present
- **Auth**: OTDS login → `token` + `user` persisted in `localStorage`; `MainLayout` guards protected routes and gates on `admin_role` (`Super Admin` / `Local Admin`)
- **Hooks**: `useQueryHistory` (DQL history), `useIdleTimeout` (idle warning + auto sign-out), `usePrefersReducedMotion`

Router: `<Router basename="/neoadmin/">`; Vite `base: '/neoadmin/'`. `/login` (public) → `/dashboard/users` (default after login)

### Services Layer (`services/dctm-rest/`)

The `services/dctm-rest/` folder contains the **Documentum REST Services** WAR (v25.2.0000.0104) — the REST API layer over Documentum ECM that the Spring Boot backend communicates with.

**Key facts:**
- **95 files** across 29 directories (19 config files, 47 licenses, 4 FreeMarker templates)
- **OpenAPI spec**: `services/dctm-rest/docs/rest.yaml` (OpenAPI 3.0.3, 70+ endpoint tags)
- **Swagger UI**: `services/dctm-rest/public/openapi/index.html`
- **Context root**: `/dctm-rest`
- **Container**: Tomcat / JBoss / WebLogic compatible

**Request flow**: Spring Boot backend → HTTPS (RestClient) → dctm-rest.war → DFC → DocBroker (`10.245.37.221:1489`) → ECM Repository (NABARDUAT)

**Configuration files** (all under `WEB-INF/classes/`):

| File | Purpose |
|------|---------|
| `dfc.properties` | DocBroker connection (host, port, repo, session limits) |
| `log4j2.properties` | Logging (INFO root, WARN for REST, rolling file appender) |
| `rest-api-runtime.properties` | Runtime config (empty = defaults; template has 150+ options) |
| `trust.properties` | Default credentials |
| `mailapp.properties` | MSG file / email processing |
| `rest-api-common-ehcache.xml` | Distributed caching |
| `rest-antisamy-*.sample.xml` | HTML/string input sanitization |
| `rest-api-custom-resource-registry.yaml` | Custom URI templates, resource overrides |
| Spring XML configs (`META-INF/spring/`) | Security (OAuth 2.0, OTDS, anonymous), filters, marshalling |

**API endpoint categories**: Repositories, Cabinets, Folders, Documents, Objects, Content, Users, Groups, ACLs, Search (DQL), Batch, Workflows/Tasks, Audit, Relations, Virtual Documents, Versions, Lifecycle

**NBSupportApp backend service → DCTM-REST mapping**:

| Backend Service | Endpoints Used | Object Type |
|----------------|----------------|-------------|
| `DctmAuthService` | Authentication, login tickets | — |
| `CaseService` | Objects, Folders, Search | `cms_case_folder` |
| `WorkflowService` | Processes, Tasks | `dm_process` |
| `UserService` | Users | `dm_user` |
| `GroupService` | Groups | `dm_group` |
| `QueryService` | Search (raw DQL) | Any |

**Auth methods**: Basic Auth (default), OAuth 2.0, OTDS SSO. Anonymous access for `/static/**`, `/services`, `/repositories`.

## Technical Documentation

Detailed architecture docs are in `techdocs/`:
- [`techdocs/backend-architecture.md`](techdocs/backend-architecture.md) — Backend: all API endpoints, service layer, auth flows, OTDS/email integration, Mermaid sequence diagrams
- [`techdocs/frontend-architecture.md`](techdocs/frontend-architecture.md) — Frontend: stack, `/neoadmin/` routing, the "Field ledger" design system, `components/ui/` primitive library, the drawer shell + role-based nav, per-page catalog, API call reference
- [`techdocs/designpatterns.md`](techdocs/designpatterns.md) — Module separation (CMS vs Digidak), endpoint conventions, metadata implementation patterns
- [`techdocs/OTDS_Authentication.md`](techdocs/OTDS_Authentication.md) — OTDS SSO authentication details

## Critical Constraints

- **`services/dctm-rest/` is READ-ONLY** — never modify files here. Use it only for API reference (`services/dctm-rest/docs/rest.yaml`).
- **CORS**: `@CrossOrigin` on each controller. Most allow `localhost:5173` and `localhost:5174`; `SettingsController` only allows `5173`.
- **SSL**: `RestClientConfig` trusts all certificates (required for self-signed Documentum endpoint).
- **Service account credentials** can be overridden via `DCTM_SERVICE_USERNAME` / `DCTM_SERVICE_PASSWORD` env vars; defaults are in `application.properties`.

## Coding Conventions

### Backend
- Constructor injection via Lombok `@RequiredArgsConstructor` (no `@Autowired`)
- DTOs for all request/response payloads
- SLF4J logging via `@Slf4j` (no `System.out.println`)

### Frontend
- Functional components, PascalCase filenames
- Tailwind CSS via semantic "Field ledger" tokens only — `canopy` (#14532D) primary, `paper` / `ink` / `line` neutrals, `harvest` accent, `danger` / `info` for status; no hard-coded hex. Fonts: Fraunces (display, mastheads only), IBM Plex Sans (body), IBM Plex Mono (identifiers / counts / dates / DQL). See `frontend/src/components/ui/README.md`
- Animation via CSS keyframe tokens + Framer Motion: `sheet-up` / `pop-in` 0.2s, `fade-rise` 0.18s, `toast-in` 0.15s, `spine-grow` 0.12s; all motion respects `prefers-reduced-motion`
- Modals: use the shared `Modal` primitive — centred dialog (`max-h-[85dvh]`) on desktop, full-height bottom sheet on phones; sticky header/footer, `scrollbar-thin` body, Esc / backdrop close
- Build UI from the `components/ui/` primitives (`PageHeader`, `DataTable`, `Pagination`, `Button`, `Input`, `CustomSelect`, `FormGrid`, `Card`, `Badge`, `Tabs`, `EmptyState`, `Modal`, `useToast`) rather than re-implementing them inline

### Metadata Pattern (follow the Case Type implementation)
When adding new metadata types, follow the **Case Type** pattern (see `techdocs/designpatterns.md`):
1. **Documentum:** Store entries as `dm_folder` objects under `/ECM CONFIG/<Metadata Name>/`
2. **Backend Service (`MetadataService`):** Add `list<Name>()` (DQL `SELECT r_object_id, object_name FROM dm_folder WHERE FOLDER('/ECM CONFIG/<Name>')`) and `create<Name>(String objectName)` (resolve parent folder via `resolveFolderInfo()`, POST new folder inheriting ACL)
3. **Backend Controller (`MetadataController`):** Add `GET /api/metadata/<name>s` and `POST /api/metadata/<name>s` endpoints
4. **Frontend (`MetadataPage.jsx`):** Add a `<Name>Tab` component with create form + list display, wire into the appropriate section's tab group

### UI/UX (from Agents.md)
- Skeleton loaders for initial data, spinners for actions
- Toast notifications via the app-wide `useToast()` / `ToastProvider` (mounted once in `MainLayout`) — `toast.success/error/info(msg)`; 3s success / 5s error auto-dismiss
- Server-side pagination for datasets > 50 items
- Inline two-step confirmation for destructive actions (no `window.confirm()`)
- Every view must be usable at 375px: `DataTable` reflows rows to "folio cards" below `md`, forms collapse to a single column, modals become bottom sheets
