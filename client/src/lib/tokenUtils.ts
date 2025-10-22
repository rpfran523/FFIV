/**
 * Decode JWT token without verification (client-side only for expiry checking)
 * Never use this for security validation - server must always verify
 */
export const decodeToken = (token: string): any => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
};

/**
 * Check if a JWT token is expired
 * @param token - JWT token string
 * @returns true if expired or invalid, false if still valid
 */
export const isTokenExpired = (token: string | null): boolean => {
  if (!token) return true;
  
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;
  
  // exp is in seconds, Date.now() is in milliseconds
  const expiryTime = decoded.exp * 1000;
  const now = Date.now();
  
  // Add 30 second buffer to account for clock skew
  return now >= (expiryTime - 30000);
};

/**
 * Get time remaining until token expires (in milliseconds)
 * Returns 0 if expired or invalid
 */
export const getTokenTimeRemaining = (token: string | null): number => {
  if (!token) return 0;
  
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return 0;
  
  const expiryTime = decoded.exp * 1000;
  const now = Date.now();
  const remaining = expiryTime - now;
  
  return Math.max(0, remaining);
};

/**
 * Get token expiry date
 */
export const getTokenExpiryDate = (token: string | null): Date | null => {
  if (!token) return null;
  
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return null;
  
  return new Date(decoded.exp * 1000);
};
