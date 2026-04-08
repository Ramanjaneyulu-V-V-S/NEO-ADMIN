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
    ↓ axios → http://localhost:8080/api
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

- **Pages**: Login, Cases, Workflows, Groups, Users, Query — routed under `/dashboard/*`
- **Layout**: `MainLayout` wraps protected routes with `Sidebar` + `Topbar`
- **API layer**: `api/axios.js` — axios instance pointing to `localhost:8080/api`
- **Auth**: User object stored in localStorage after login; MainLayout guards protected routes
- **Hooks**: `useQueryHistory` for DQL query history persistence

Routes: `/login` (public) → `/dashboard/cases` (default after login)

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
- [`techdocs/frontend-architecture.md`](techdocs/frontend-architecture.md) — Frontend: all pages/components, routing, role-based nav, state management, API call reference

- [`techdocs/case-type-metadata.md`](techdocs/case-type-metadata.md) — Case Type metadata: full-stack implementation, DQL queries, Documentum storage, API endpoints
- [`techdocs/designpatterns.md`](techdocs/designpatterns.md) — Module separation (CMS vs Digidak), endpoint conventions, metadata implementation patterns

- [`techdocs/nbmainbackend-xcp.md`](techdocs/nbmainbackend-xcp.md) — xCP Main Backend: 47 processes, data model (cms_case_folder, cms_digidak_folder), 8 Java modules, integrations, NBSupportApp mapping
- [`techdocs/nbmainfrontend-xcp.md`](techdocs/nbmainfrontend-xcp.md) — xCP Main Frontend: React 19 + Redux + Kendo UI, 32 routes, 40+ components, Brava viewer, 100+ API endpoints

HTML versions with interactive sidebar navigation: `techdocs/backend-architecture.html`, `techdocs/frontend-architecture.html`, `techdocs/nbmainbackend-xcp.html`, `techdocs/nbmainfrontend-xcp.html`

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
- Tailwind CSS for all styling (custom brand blue: `#0A66C2`)
- Framer Motion for animations (150ms hover, 300ms modal, 500ms page)
- Modals: max 70vh height, fixed header/footer, scrollable content with `scrollbar-thin`

### Metadata Pattern (follow the Case Type implementation)
When adding new metadata types, follow the **Case Type** pattern (`techdocs/case-type-metadata.md`):
1. **Documentum:** Store entries as `dm_folder` objects under `/ECM CONFIG/<Metadata Name>/`
2. **Backend Service (`MetadataService`):** Add `list<Name>()` (DQL `SELECT r_object_id, object_name FROM dm_folder WHERE FOLDER('/ECM CONFIG/<Name>')`) and `create<Name>(String objectName)` (resolve parent folder via `resolveFolderInfo()`, POST new folder inheriting ACL)
3. **Backend Controller (`MetadataController`):** Add `GET /api/metadata/<name>s` and `POST /api/metadata/<name>s` endpoints
4. **Frontend (`MetadataPage.jsx`):** Add a `<Name>Tab` component with create form + list display, wire into the appropriate section's tab group

### UI/UX (from Agents.md)
- Skeleton loaders for initial data, spinners for actions
- Toast notifications: top-center/right, 3s success / 5s error auto-dismiss
- Server-side pagination for datasets > 50 items
- Inline two-step confirmation for destructive actions (no `window.confirm()`)
