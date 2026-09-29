import { useEffect, useCallback } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { LOGOUT_ACTION, persistor } from "../redux/store";
import { clearAuthSession } from "../services/sessionCleanup";

const CHANNEL_NAME = "nabard-session-sync";

// Broadcast channel instance (created once)
let broadcastChannel = null;

const getBroadcastChannel = () => {
  if (!broadcastChannel && typeof BroadcastChannel !== "undefined") {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  }
  return broadcastChannel;
};

/**
 * Hook to sync session state across browser tabs
 * When logout happens in one tab, all other tabs are notified
 */
export const useSessionSync = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogoutFromOtherTab = useCallback(async () => {
    // Clear Redux state
    dispatch({ type: LOGOUT_ACTION });
    await persistor.purge();

    clearAuthSession();

    // Navigate to login
    navigate("/", { replace: true });
  }, [dispatch, navigate]);

  useEffect(() => {
    const channel = getBroadcastChannel();

    if (channel) {
      // Listen for logout events from other tabs
      const handleMessage = (event) => {
        if (event.data?.type === "LOGOUT") {
          handleLogoutFromOtherTab();
        }
      };

      channel.addEventListener("message", handleMessage);

      return () => {
        channel.removeEventListener("message", handleMessage);
      };
    }

    // Fallback for browsers without BroadcastChannel support
    // Uses localStorage event (fires when another tab modifies localStorage)
    const handleStorageChange = (event) => {
      if (event.key === "logout-sync-event") {
        handleLogoutFromOtherTab();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [handleLogoutFromOtherTab]);
};

/**
 * Broadcast logout event to all other tabs
 * Call this when user logs out
 */
export const broadcastLogout = () => {
  const channel = getBroadcastChannel();

  if (channel) {
    channel.postMessage({ type: "LOGOUT" });
  }

  // Fallback: trigger storage event for older browsers
  localStorage.setItem("logout-sync-event", Date.now().toString());
  localStorage.removeItem("logout-sync-event");
};

export default useSessionSync;
