import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "@progress/kendo-theme-default/dist/all.css";
import "bootstrap/dist/css/bootstrap.min.css";

import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { store, persistor } from "./redux/store";

import App from "./App.jsx";
import "./App.css";

// ---------------------------------------------------------------------------
// Auto-recover from stale Vite chunk references after a redeploy.
//
// When a user has the app open and we ship a new build, their in-memory
// index.html still references old hashed chunk filenames. Any subsequent
// lazy import() will 404. Detect that and reload the page once so the
// browser picks up the fresh index.html with the new chunk hashes.
// ---------------------------------------------------------------------------
const CHUNK_RELOAD_KEY = "nabard_chunk_reload_attempted";

const isChunkLoadError = (err) => {
  const message = err?.message || "";
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Loading chunk") ||
    message.includes("Importing a module script failed") ||
    message.includes("error loading dynamically imported module")
  );
};

const handleChunkError = (err) => {
  if (!isChunkLoadError(err)) return;
  // Guard against infinite reload loops if the new build is genuinely broken
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  window.location.reload();
};

// Clear the guard once the app successfully loads after a recovery reload
window.addEventListener("load", () => {
  sessionStorage.removeItem(CHUNK_RELOAD_KEY);
});

// React.lazy failures usually surface as unhandled promise rejections
window.addEventListener("unhandledrejection", (event) => {
  handleChunkError(event.reason);
});

// Synchronous script-load errors
window.addEventListener("error", (event) => {
  handleChunkError(event.error);
});

// Vite's own preload error event (fired when <link rel="modulepreload"> fails)
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault(); // stop Vite from re-throwing
  handleChunkError(new Error("Failed to fetch dynamically imported module"));
});

// Determine base path
const basename = import.meta.env.VITE_BASE_PATH || "/";

// Prepare app element with PersistGate to wait for rehydration
const AppElement = (
  <Provider store={store}>
    <PersistGate
      loading={
        <div className="k-loading-mask">
          <div className="k-loading-image"></div>
        </div>
      }
      persistor={persistor}
    >
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </PersistGate>
  </Provider>
);

// Conditionally wrap in StrictMode only in development
const RootElement = AppElement;

createRoot(document.getElementById("root")).render(RootElement);
