import { useEffect, Suspense, lazy } from "react";
import { Routes, Route, useParams, useLocation, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";

// Components
import ProtectedRoute from "./components/ProtectedRoute";
import SessionWarningModal from "./components/sessionWarningModal";
import ErrorBoundary from "./components/errorBoundary/ErrorBoundary";
import { useCheckCGMUser } from "./hooks/useCheckCGMUser";
import { useDigidakGroups } from "./hooks/useDigidakGroups";
import { useSessionSync } from "./hooks/useSessionSync";
import { useSessionTimeout } from "./hooks/useSessionTimeout";
import { useDDMContext } from "./hooks/useDDMContext";

// Redux Selectors
import { selectUserName } from "./redux/selectors/loginSelectors";

// Auth & Dashboard
const Login = lazy(() => import("./pages/login/Login"));
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"));

// Case Management
const Inbox = lazy(() => import("./pages/caseManagement/inbox/Inbox"));
const Cases = lazy(() => import("./pages/caseManagement/cases/Cases"));
const Outbox = lazy(() => import("./pages/caseManagement/outbox/Outbox"));
const ViewCase = lazy(() => import("./pages/caseManagement/viewCase/ViewCases"));
const CreateCase = lazy(() => import("./pages/caseManagement/createCase/CreateCase"));
const SearchCase = lazy(() => import("./pages/caseManagement/searchCase/SearchCase"));
const ReferenceViewCase = lazy(() => import("./pages/caseManagement/viewCase/ReferenceViewCase"));
const OldCases = lazy(() => import("./pages/caseManagement/oldCases/OldCases"));

// Digidak
const DraftEntry = lazy(() => import("./pages/digidak/draftEntry/DraftEntry"));
const InwardEntry = lazy(() => import("./pages/digidak/inwardEntry/InwardEntry"));
const OutwardEntry = lazy(() => import("./pages/digidak/outwardEntry/OutwardEntry"));
const DigidakInbox = lazy(() => import("./pages/digidak/digidakInbox/DigidakInbox"));
const DigidakOutbox = lazy(() => import("./pages/digidak/digidakOutbox/DigidakOutbox"));
const ViewEntry = lazy(() => import("./pages/digidak/viewEntry/ViewEntry"));
const DDMLetters = lazy(() => import("./pages/digidak/ddmLetters/DDMLetters"));
const ForwardDigidak = lazy(() => import("./pages/digidak/forwardLetter/ForwardDigidak"));
const ViewLetters = lazy(() => import("./pages/digidak/viewLetters/ViewLetters"));
const OldLetters = lazy(() => import("./pages/digidak/oldLetters/OldLetters"));
const ViewOldEntry = lazy(() => import("./pages/digidak/viewEntry/ViewOldEntry"));

// NotFound
const NotFound = lazy(() => import("./pages/notFound/NotFound"));
const Maintenance = lazy(() => import("./pages/notFound/Maintenance"));

// Utility wrapper for protected routes
const Protected = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>;

// Redirects DDM users away from case management routes
const NonDDMRoute = ({ children }) => {
  const { isDDM } = useDDMContext();
  if (isDDM) return <Navigate to="/dashboard" replace />;
  return children;
};

// Utility to set the page title dynamically
const setDocumentTitle = (title) => {
  document.title = title;
};

// Component for dynamic route with ID
const ViewCaseWithId = () => {
  const { id } = useParams();
  return id ? <ViewCase id={id} /> : <div>No ID provided</div>;
};

const ReferenceCaseWithId = () => {
  const { refId } = useParams();

  return refId ? <ReferenceViewCase refId={refId} /> : <div>No Ref ID provided</div>;
};

const FullScreenLoader = () => (
  <div className="k-loading-mask">
    <div className="k-loading-image"></div>
  </div>
);

// Per-route error boundary wrapper — resets on route change via key prop
const PageErrorBoundary = ({ children }) => {
  const { pathname } = useLocation();
  return <ErrorBoundary key={pathname}>{children}</ErrorBoundary>;
};

const App = () => {
  const location = useLocation();
  useCheckCGMUser();

  // Multi-tab session synchronization
  useSessionSync();

  // Session timeout with warning modal
  const { showWarning, remainingSeconds, extendSession, logoutNow } = useSessionTimeout();

  // Use memoized selector for user name
  const objectName = useSelector(selectUserName);

  // Fetch groups using the hook
  useDigidakGroups(objectName);

  useEffect(() => {
    const digidakPaths = ["/inward-entry", "/outward-entry", "/draft-entry", "/digidak-inbox", "/digidak-outbox"];
    const isDigidakPath = digidakPaths.some((path) => location.pathname.startsWith(path));

    if (isDigidakPath) {
      setDocumentTitle("NABARD | Digidak");
    } else {
      setDocumentTitle("NABARD | Case Management");
    }
  }, [location]);

  return (
    <>
      {/* Session Warning Modal */}
      <SessionWarningModal visible={showWarning} remainingSeconds={remainingSeconds} onExtend={extendSession} onLogout={logoutNow} />

      <ErrorBoundary>
        <Suspense fallback={<FullScreenLoader />}>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/maintenance" element={<Maintenance />} />
            <Route
              path="/dashboard"
              element={
                <Protected>
                  <PageErrorBoundary>
                    <Dashboard />
                  </PageErrorBoundary>
                </Protected>
              }
            />
            <Route
              path="/create-case"
              element={
                <Protected>
                  <NonDDMRoute>
                    <PageErrorBoundary>
                      <CreateCase />
                    </PageErrorBoundary>
                  </NonDDMRoute>
                </Protected>
              }
            />
            <Route
              path="/inbox"
              element={
                <Protected>
                  <NonDDMRoute>
                    <PageErrorBoundary>
                      <Inbox />
                    </PageErrorBoundary>
                  </NonDDMRoute>
                </Protected>
              }
            />
            <Route
              path="/cases"
              element={
                <Protected>
                  <NonDDMRoute>
                    <PageErrorBoundary>
                      <Cases />
                    </PageErrorBoundary>
                  </NonDDMRoute>
                </Protected>
              }
            />
            <Route
              path="/view-case/:id"
              element={
                <Protected>
                  <NonDDMRoute>
                    <PageErrorBoundary>
                      <ViewCaseWithId />
                    </PageErrorBoundary>
                  </NonDDMRoute>
                </Protected>
              }
            />
            <Route
              path="/view-old-case/:id"
              element={
                <Protected>
                  <NonDDMRoute>
                    <PageErrorBoundary>
                      <ViewCaseWithId />
                    </PageErrorBoundary>
                  </NonDDMRoute>
                </Protected>
              }
            />
            <Route
              path="/reference-case/:refId"
              element={
                <Protected>
                  <NonDDMRoute>
                    <PageErrorBoundary>
                      <ReferenceCaseWithId />
                    </PageErrorBoundary>
                  </NonDDMRoute>
                </Protected>
              }
            />

            <Route
              path="/sent-case"
              element={
                <Protected>
                  <NonDDMRoute>
                    <PageErrorBoundary>
                      <Outbox />
                    </PageErrorBoundary>
                  </NonDDMRoute>
                </Protected>
              }
            />
            <Route
              path="/search-case"
              element={
                <Protected>
                  <NonDDMRoute>
                    <PageErrorBoundary>
                      <SearchCase />
                    </PageErrorBoundary>
                  </NonDDMRoute>
                </Protected>
              }
            />
            <Route
              path="/inward-entry"
              element={
                <Protected>
                  <PageErrorBoundary>
                    <InwardEntry />
                  </PageErrorBoundary>
                </Protected>
              }
            />
            <Route
              path="/outward-entry"
              element={
                <Protected>
                  <PageErrorBoundary>
                    <OutwardEntry />
                  </PageErrorBoundary>
                </Protected>
              }
            />
            <Route
              path="/draft-entry"
              element={
                <Protected>
                  <PageErrorBoundary>
                    <DraftEntry />
                  </PageErrorBoundary>
                </Protected>
              }
            />
            <Route
              path="/digidak-inbox"
              element={
                <Protected>
                  <PageErrorBoundary>
                    <DigidakInbox />
                  </PageErrorBoundary>
                </Protected>
              }
            />
            <Route
              path="/digidak-letterbox"
              element={
                <Protected>
                  <PageErrorBoundary>
                    <DigidakInbox />
                  </PageErrorBoundary>
                </Protected>
              }
            />
            <Route
              path="/ddm-inward"
              element={
                <Protected>
                  <PageErrorBoundary>
                    <DDMLetters mode="Inward" />
                  </PageErrorBoundary>
                </Protected>
              }
            />
            <Route
              path="/ddm-outward"
              element={
                <Protected>
                  <PageErrorBoundary>
                    <DDMLetters mode="Outward" />
                  </PageErrorBoundary>
                </Protected>
              }
            />

            <Route
              path="/forward-digidak"
              element={
                <Protected>
                  <PageErrorBoundary>
                    <ForwardDigidak />
                  </PageErrorBoundary>
                </Protected>
              }
            />

            <Route
              path="/view-letters"
              element={
                <Protected>
                  <PageErrorBoundary>
                    <ViewLetters />
                  </PageErrorBoundary>
                </Protected>
              }
            />

            <Route
              path="/digidak-outbox"
              element={
                <Protected>
                  <PageErrorBoundary>
                    <DigidakOutbox />
                  </PageErrorBoundary>
                </Protected>
              }
            />
            <Route
              path="/digidak-view/:id"
              element={
                <Protected>
                  <PageErrorBoundary>
                    <ViewEntry />
                  </PageErrorBoundary>
                </Protected>
              }
            />
            {/* Old Cases & Old Letters - hidden temporarily */}
            {/* <Route
              path="/old-letters-view/:id"
              element={
                <Protected>
                  <PageErrorBoundary>
                    <ViewOldEntry />
                  </PageErrorBoundary>
                </Protected>
              }
            />
            <Route
              path="/old-cases"
              element={
                <Protected>
                  <NonDDMRoute>
                    <PageErrorBoundary>
                      <OldCases />
                    </PageErrorBoundary>
                  </NonDDMRoute>
                </Protected>
              }
            /> */}
            {/* <Route
              path="/old-letters"
              element={
                <Protected>
                  <PageErrorBoundary>
                    <OldLetters mode="Outbox" />
                  </PageErrorBoundary>
                </Protected>
              }
            />
            <Route
              path="/old-letters-inbox"
              element={
                <Protected>
                  <PageErrorBoundary>
                    <OldLetters mode="Inbox" />
                  </PageErrorBoundary>
                </Protected>
              }
            /> */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  );
};

export default App;
