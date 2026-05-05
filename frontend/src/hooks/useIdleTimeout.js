import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const useIdleTimeout = (warningTime = 30000, logoutTime = 60000) => {
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  const idleTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const isIdleRef = useRef(false);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  }, [navigate]);

  const resetIdleTimer = useCallback(() => {
    if (isIdleRef.current) return;

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    idleTimerRef.current = setTimeout(() => {
      isIdleRef.current = true;
      setShowWarning(true);
      setRemainingTime(warningTime);

      countdownTimerRef.current = setInterval(() => {
        setRemainingTime(prev => {
          if (prev <= 1000) {
            clearInterval(countdownTimerRef.current);
            handleLogout();
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
    }, logoutTime - warningTime);
  }, [warningTime, logoutTime, handleLogout]);

  const handleContinue = useCallback(() => {
    isIdleRef.current = false;
    setShowWarning(false);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    resetIdleTimer();
  }, [resetIdleTimer]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    let lastActivityTime = Date.now();

    const handleActivity = () => {
      if (isIdleRef.current) {
        handleContinue();
      } else {
        const now = Date.now();
        if (now - lastActivityTime > 500) {
          lastActivityTime = now;
          resetIdleTimer();
        }
      }
    };

    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    resetIdleTimer();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [handleContinue, resetIdleTimer]);

  return { showWarning, remainingTime, handleContinue };
};

export default useIdleTimeout;
