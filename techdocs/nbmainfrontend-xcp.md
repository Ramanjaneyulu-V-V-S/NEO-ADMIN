# xCP Main Frontend — NABARD Modern UI

> **Location:** `nbmainfrontend/nabard-modern-ui/`
> **Version:** 0.4.0
> **Framework:** React 19.1 + Redux Toolkit + Vite 6
> **UI Library:** Kendo React 11 + Bootstrap 5.3
> **Source Files:** 204

---

## 1. Overview

The NABARD Modern UI is the end-user frontend for the xCP Case Management System. It provides case management, Digidak correspondence, document viewing via OpenText Brava, and dashboard analytics — all connected to the xCP backend through 100+ REST API endpoints.

**At a Glance:** 204 source files, 32 routes, 40+ components, 20+ Redux slices, 100+ API endpoints, 13 custom hooks.

### Technology Stack

| Component | Technology |
|-----------|-----------|
| Framework | React 19.1.0 |
| State | Redux Toolkit 2.8.2 + Redux Persist |
| Build | Vite 6.3.5 (dual build: main + IV iframe) |
| UI Library | Kendo React 11.0.0 (27 packages) |
| CSS | Bootstrap 5.3.6 + Styled Components 6.1.18 |
| HTTP | Axios 1.9.0 (Basic Auth + CSRF) |
| Charts | Chart.js + react-chartjs-2 |
| Viewer | OpenText Brava (iframe + OAuth2) |
| Routing | React Router DOM 7.6.1 |
| Forms | React Hook Form 7.56.4 |
| Alerts | SweetAlert2 + React-Toastify |

---

## 2. Project Structure

```
nabard-modern-ui/
├── package.json             # React 19, 1080+ deps
├── vite.config.js           # Main build (proxy to xCP)
├── vite.iframe.config.js    # Brava IV iframe build
├── .env.development         # Dev URLs (172.172.20.214)
├── .env.production          # Prod URLs (192.168.15.190)
├── src/
│   ├── main.jsx             # Entry: Redux Provider + Router
│   ├── App.jsx              # 32 routes, session hooks
│   ├── components/ (40+)    # Layout, IV, Popups, Forms
│   ├── pages/               # Dashboard, Case, Digidak, Login
│   ├── redux/               # Store, 20+ slices, selectors
│   ├── services/            # Axios config, service URLs, API calls
│   ├── hooks/ (13)          # Session, data fetching, business logic
│   ├── utils/               # Formatters, helpers
│   ├── iframe/              # IV Brava iframe entry
│   └── assets/              # Images, logos
├── public/templates/        # Excel templates
└── dist/                    # Production build output
```

---

## 3. Routing (32 routes)

All routes protected via `ProtectedRoute` wrapper. Lazy-loaded via `React.lazy()`.

### Case Management

| Route | Page | Purpose |
|-------|------|---------|
| `/dashboard` | Dashboard | Statistics, charts, recent cases |
| `/inbox` | Inbox | FYA, EA Tasks, To Be Verified tabs |
| `/create-case` | Create Case | File number, notesheet, doc upload |
| `/cases` | View Cases | All cases grid with filters |
| `/view-case/:id` | Case Detail | 6 tabs, Brava viewer, workflow actions |
| `/sent-case` | Outbox | Sent cases with status |
| `/search-case` | Search | DQL-based case search |
| `/old-cases` | Archive | Legacy case browser |

### Digidak (Correspondence)

| Route | Page | Purpose |
|-------|------|---------|
| `/inward-entry` | Inward | Register incoming letter |
| `/outward-entry` | Outward | Create outgoing correspondence |
| `/draft-entry` | Drafts | Save-as-draft and resume |
| `/digidak-inbox` | Inbox | Incoming correspondence |
| `/digidak-outbox` | Outbox | Sent correspondence |
| `/digidak-view/:id` | Detail | Letter detail + Brava viewer |
| `/view-letters` | Letterbox | DMD Chairman personal letterbox |
| `/forward-digidak` | Forward | Forward to additional recipients |

### Other

| Route | Page |
|-------|------|
| `/` | Login (captcha + Basic Auth) |
| `/ddm-inward` / `/ddm-outward` | DDM Communications |
| `/circular` | Circulars |
| `*` | 404 Not Found |

---

## 4. Components (40+)

### Layout & Navigation

| Component | Purpose |
|-----------|---------|
| `Layout.jsx` | Master layout: header + sidebar + popups |
| `Sidebar.jsx` | 5-section nav (Dashboard, Case, Digidak, Letterbox, Old Cases, DDM) |
| `header/` | Top bar with profile, notifications |
| `ProtectedRoute.jsx` | Auth guard for routes |
| `SessionWarningModal.jsx` | 30-min timeout, 1-min warning |

### Brava Viewer (Integrated Viewer)

Rendered in iframe with PostMessage protocol. Separate Vite build produces `dist/iframe/iframeBundle.js`.

| Component | Purpose |
|-----------|---------|
| `IntegratedBravaViewer.jsx` | Main document viewer |
| `ReadOnlyBravaViewer.jsx` | Read-only mode |
| `CircularViewer.jsx` | Circular documents |
| `DigidakViewer.jsx` | Digidak letters |
| `AnnotationsLayout.jsx` | Markup annotations |
| `bravaconfig.js` | OAuth2 token URL, credentials, viewer config (30s timeout, 3 retries) |

### Popups & Modals

`AcquirePopup` (case acquisition), `PushBackPopup` / `PullbackPopup` (workflow reversal), `ViewProfile` / `profilePopup` (user profile), `NotificationPopup` (notifications), `CaseAction` / `DigidakAction` (action buttons), `SelectItemDialog`, `FileNumberDialog`, `RichTextEditor`

---

## 5. Redux State Management

Central store with Redux Persist (localStorage). `LOGOUT_ACTION` clears all state.

### Slices

**Login:** `loginSlice` — userProfile, dmdChairmanCondition, isCGMUser

**Case Management (8 slices):**
- `caseInboxSlice` — inboxCases, eaInboxCases
- `createCaseSlice` — case creation state
- `searchCaseSlice` — search results
- `viewCaseSlice` — current case view
- `caseDetailsSlice` — case metadata
- `documentSlice` — document management
- `circularsSlice` — circular documents
- `publicationSlice` — IV publications

**Digidak (9 slices):**
- `digidakInwardSlice`, `digidakOutwardSlice`, `digidakInboxSlice`, `digidakOutboxSlice`, `digidakDraftSlice`, `digidakCorrespondenceSlice`, `digidakDDMSlice`, `digidakFolderSlice`, `digidakDropdownSlice`

**Other:** `dashboardSlice`, `notificationSlice`

---

## 6. API Integration

### Axios Config

- **Base URL:** Dynamic from `VITE_API_BASE_URL`
- **Auth:** Basic Auth header with base64-encoded Token from localStorage
- **CSRF:** Token extracted from `x-csrf-token` cookie
- **401 Interceptor:** Auto-logout and redirect to `/login`

### Key Endpoint Groups (100+)

| Category | Example Endpoints |
|----------|------------------|
| Auth | `/realtime-queries/cms_get_userprofile`, `/processes/cms_get_grades` |
| Dashboard | `/dql-queries/cms_get_folder_objects_`, `/processes/cms_digidak_dashboard` |
| Case | `/processes/cms_create_case`, `/tasklist-queries/cms_inbox`, `/processes/cms_linear_process` |
| Digidak | `/processes/cms_digidak_creation`, `/dql-queries/cms_digidak_inbox` |
| Documents | `/files`, `/folders/{id}/objects`, `/contents/cms_note_document/{id}/media` |
| Workflow | `/processes/cms_push_back_pull_back`, `/processes/cms_resubmit_case` |
| IV | `/processes/cms_call_publish_iv_service` |

---

## 7. Custom Hooks (13)

| Hook | Purpose |
|------|---------|
| `useSessionTimeout` | 30-min timeout, 1-min warning, activity tracking (debounced), multi-tab broadcast |
| `useSessionSync` | Cross-tab session sync via BroadcastChannel |
| `useCheckCGMUser` | CGM user role detection |
| `useDDMContext` | DDM user context and route filtering |
| `usePublishIv` | Publish document to Intelligent Viewer |
| `useDigidakDashboardData` | Dashboard statistics |
| `useDigidakGroups` | Group fetching for Digidak |
| `useFileNumbers` | File number dropdown |
| `useInwardDropdownFields` | Inward entry dropdown population |
| `useRecipientSelector` | Multi-select recipient picker |
| `useDigidakDocumentActions` | Document download/delete |
| `usePdfExport` | PDF export |
| `useResponseRecipientDisable` | Conditional recipient disabling |

---

## 8. Authentication & Session

### Login Flow

1. User enters username, password, captcha
2. Captcha validated against generated image
3. Credentials base64-encoded, stored in localStorage as `Token`
4. `loginService.loginAndGetProfile()` calls `/realtime-queries/cms_get_userprofile`
5. Profile stored in Redux (persisted to localStorage)
6. Redirect to `/dashboard`

### Session Management

- **Timeout:** 30 minutes of inactivity
- **Warning:** 1 minute before expiry (modal with countdown)
- **Activity events:** mousedown, keydown, scroll, touchstart (debounced 1s)
- **Multi-tab:** BroadcastChannel API for synchronized logout
- **401 Response:** Automatic logout and redirect

---

## 9. Environment Configuration

### Development

```
VITE_API_BASE_URL = http://172.172.20.214:6060
VITE_BASE_PATH = /Case_Management_System
VITE_BRAVA_TOKEN_URL = http://4.188.241.109:7070/otdsws/oauth2/token
VITE_BRAVA_VIEWER_URL = http://4.188.241.109:3358
VITE_FILE_SERVER_URL = http://4.188.241.109:5001
```

### Production

```
VITE_API_BASE_URL = http://192.168.15.190:6060
VITE_BRAVA_TOKEN_URL = http://192.168.15.138:8080/otdsws/oauth2/token
VITE_BRAVA_VIEWER_URL = http://192.168.15.138:3358
VITE_FILE_SERVER_URL = http://192.168.15.138:5001
```

### Build Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server with proxy to xCP |
| `npm run build` | Production build (main + iframe) |
| `npm run build:main` | Main app only |
| `npm run build:iframe` | Brava IV iframe only |

Output: `dist/` + `dist/iframe/iframeBundle.js`, deployed into xCP WAR at `/Case_Management_System`.
