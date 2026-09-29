import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Auto sign-out after a period of no user interaction.
 *
 * Any of `mousedown / keydown / scroll / touchstart / click` before the warning
 * appears pushes the idle timer back (throttled to once per second). Once the
 * "Session Inactive" warning is showing, only an explicit "Continue Session"
 * click dismisses it — stray activity no longer auto-dismisses it.
 *
 * @param {number} warningTime  ms the countdown warning is visible before logout
 * @param {number} logoutTime   ms of inactivity before the session ends
 */
const useIdleTimeout = (warningTime = 30000, logoutTime = 1800000) => {
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  const idleTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const showWarningRef = useRef(false);
  const lastActivityRef = useRef(0);

  const clearTimers = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    idleTimerRef.current = null;
    countdownTimerRef.current = null;
  };

  const handleLogout = () => {
    clearTimers();
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  }, [navigate]);

  const startCountdown = () => {
    showWarningRef.current = true;
    setShowWarning(true);

    let left = warningTime;
    setRemainingTime(left);

    countdownTimerRef.current = setInterval(() => {
      left -= 1000;
      if (left <= 0) {
        setRemainingTime(0);
        handleLogout();
        return;
      }
      setRemainingTime(left);
    }, 1000);
  };

  const resetIdleTimer = () => {
    if (showWarningRef.current) return;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(startCountdown, Math.max(0, logoutTime - warningTime));
  };

  const handleContinue = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = null;
    showWarningRef.current = false;
    setShowWarning(false);
    lastActivityRef.current = Date.now();
    resetIdleTimer();
  }, [resetIdleTimer]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    let lastActivityTime = Date.now();

    const handleActivity = () => {
      // While the warning is up, require an explicit "Continue Session" click.
      if (showWarningRef.current) return;
      const now = Date.now();
      if (now - lastActivityRef.current < 1000) return;
      lastActivityRef.current = now;
      resetIdleTimer();
    };

    events.forEach(event => document.addEventListener(event, handleActivity, { passive: true }));
    resetIdleTimer();

    return () => {
      events.forEach(event => document.removeEventListener(event, handleActivity));
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { showWarning, remainingTime, handleContinue };
};

export default useIdleTimeout;
