import { useState, useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { LOGOUT_ACTION, persistor } from "../redux/store";
import { selectIsAuthenticated } from "../redux/selectors/loginSelectors";
import { broadcastLogout } from "./useSessionSync";
import { clearAuthSession } from "../services/sessionCleanup";
import { loginService } from "../services/login/loginService";

const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_EXPIRY = 1 * 60 * 1000; // Show warning 1 minute before expiry
const ELAPSED_CHECK_INTERVAL = 30 * 1000; // Check elapsed time every 30 seconds

/**
 * Hook to manage session timeout with warning modal
 * - Tracks user activity via DOM events
 * - Uses timestamp-based checks to handle browser throttling and computer sleep
 * - Shows warning before session expires
 * - Auto-logout when session expires
 */
export const useSessionTimeout = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Use refs to avoid dependency issues and prevent infinite re-renders
  const sessionTimeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const elapsedCheckIntervalRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const isAuthenticatedRef = useRef(isAuthenticated);
  const showWarningRef = useRef(showWarning);

  // Keep refs in sync with state
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    showWarningRef.current = showWarning;
  }, [showWarning]);

  // Clear all timers utility function
  const clearAllTimers = useCallback(() => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
      sessionTimeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (elapsedCheckIntervalRef.current) {
      clearInterval(elapsedCheckIntervalRef.current);
      elapsedCheckIntervalRef.current = null;
    }
  }, []);

  // Perform logout
  const performLogout = useCallback(async () => {
    // Clear all timeouts
    clearAllTimers();

    // Destroy server session, clear cookies & tokens
    await loginService.logout();

    // Broadcast to other tabs
    broadcastLogout();

    // Clear Redux state
    dispatch({ type: LOGOUT_ACTION });
    await persistor.purge();

    clearAuthSession();

    // Hide warning and navigate
    setShowWarning(false);
    navigate("/", { replace: true });
  }, [dispatch, navigate, clearAllTimers]);

  // Start countdown for warning modal
  const startCountdown = useCallback(() => {
    const warningDurationSeconds = Math.floor(WARNING_BEFORE_EXPIRY / 1000);
    setRemainingSeconds(warningDurationSeconds);

    // Clear any existing countdown
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    countdownIntervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          performLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [performLogout]);

  /**
   * Timestamp-based elapsed time check.
   * Handles cases where setTimeout is unreliable:
   * - Computer sleep/wake (timers pause during sleep)
   * - Browser background tab throttling
   * - visibilitychange when tab becomes active again
   */
  const checkElapsedTime = useCallback(() => {
    if (!isAuthenticatedRef.current) return;

    const elapsed = Date.now() - lastActivityRef.current;

    if (elapsed >= SESSION_DURATION) {
      // Session fully expired — logout immediately
      performLogout();
    } else if (elapsed >= SESSION_DURATION - WARNING_BEFORE_EXPIRY && !showWarningRef.current) {
      // Should be in warning phase — show warning with correct remaining time
      clearAllTimers();
      const remainingMs = SESSION_DURATION - elapsed;
      setShowWarning(true);
      setRemainingSeconds(Math.max(1, Math.ceil(remainingMs / 1000)));

      countdownIntervalRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
            performLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [performLogout, clearAllTimers]);

  // Reset session timeout - called on user activity
  const resetTimeout = useCallback(() => {
    // Don't reset if warning is showing or not authenticated
    if (showWarningRef.current || !isAuthenticatedRef.current) {
      return;
    }

    // Clear existing timeouts
    clearAllTimers();

    // Update last activity timestamp
    lastActivityRef.current = Date.now();

    // Hide warning if shown
    setShowWarning(false);

    // Calculate time until warning should show
    const timeUntilWarning = SESSION_DURATION - WARNING_BEFORE_EXPIRY;

    // Set warning timeout (fires before session expires)
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(true);
      startCountdown();
    }, timeUntilWarning);

    // Set session timeout (final logout - backup in case countdown fails)
    sessionTimeoutRef.current = setTimeout(() => {
      performLogout();
    }, SESSION_DURATION);

    // Periodic elapsed-time check as a safety net for sleep/throttling
    elapsedCheckIntervalRef.current = setInterval(checkElapsedTime, ELAPSED_CHECK_INTERVAL);
  }, [clearAllTimers, startCountdown, performLogout, checkElapsedTime]);

  // Extend session (called from warning modal)
  const extendSession = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);

    // Small delay to ensure state is updated before resetting timeout
    setTimeout(() => {
      resetTimeout();
    }, 100);
  }, [clearAllTimers, resetTimeout]);

  // Logout immediately (called from warning modal)
  const logoutNow = useCallback(() => {
    performLogout();
  }, [performLogout]);

  // Setup activity listeners, visibility change handler, and initial timeout
  useEffect(() => {
    if (!isAuthenticated) {
      // Clear everything if not authenticated
      clearAllTimers();
      setShowWarning(false);
      return;
    }

    // Debounce timer for activity events
    let activityDebounceTimer = null;

    // Handle user activity with debouncing
    const handleActivity = () => {
      // Don't reset if warning is showing
      if (showWarningRef.current) return;

      // Debounce activity events - only reset timeout once per second max
      if (activityDebounceTimer) {
        clearTimeout(activityDebounceTimer);
      }

      activityDebounceTimer = setTimeout(() => {
        // Double-check conditions before resetting
        if (isAuthenticatedRef.current && !showWarningRef.current) {
          resetTimeout();
        }
      }, 1000);
    };

    // Check elapsed time when tab becomes visible again (handles sleep/wake and tab switch)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isAuthenticatedRef.current) {
        checkElapsedTime();
      }
    };

    // Activity events to track
    const activityEvents = ["mousedown", "keydown", "scroll", "touchstart"];

    // Add activity listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Add visibility change listener
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Start initial session timeout
    resetTimeout();

    return () => {
      // Cleanup
      clearAllTimers();

      if (activityDebounceTimer) {
        clearTimeout(activityDebounceTimer);
      }

      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });

      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthenticated, resetTimeout, clearAllTimers, checkElapsedTime]);

  return {
    showWarning,
    remainingSeconds,
    extendSession,
    logoutNow,
  };
};

export default useSessionTimeout;
