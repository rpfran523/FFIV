import { useEffect, useRef, useCallback } from 'react';

interface UseSessionTimeoutOptions {
  timeoutMs: number;
  onTimeout: () => void;
  enabled?: boolean;
}

/**
 * Hook to track user inactivity and trigger a timeout callback
 * Tracks mouse movement, keyboard input, clicks, and touches
 * 
 * @param timeoutMs - Milliseconds of inactivity before timeout (e.g., 4 hours)
 * @param onTimeout - Callback to execute when timeout is reached
 * @param enabled - Whether the timeout is active (default: true)
 */
export const useSessionTimeout = ({ 
  timeoutMs, 
  onTimeout, 
  enabled = true 
}: UseSessionTimeoutOptions) => {
  const lastActivityRef = useRef<number>(Date.now());
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Reset activity timestamp
  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!enabled) {
      // Clear existing timers if disabled
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      return;
    }

    // Activity event listeners
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    
    events.forEach(event => {
      window.addEventListener(event, resetActivity, { passive: true });
    });

    // Check for timeout every minute
    checkIntervalRef.current = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      
      if (timeSinceLastActivity >= timeoutMs) {
        console.log('⏰ Session timeout reached due to inactivity');
        onTimeout();
      }
    }, 60 * 1000); // Check every minute

    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, resetActivity);
      });
      
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, [enabled, timeoutMs, onTimeout, resetActivity]);

  return { resetActivity };
};
