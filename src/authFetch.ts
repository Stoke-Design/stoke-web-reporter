import { getJWT } from './auth';

/** Called when the server returns 401 — set by App.tsx to clear React auth state */
let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(cb: () => void) {
  onUnauthorized = cb;
}

/** Wrapper around fetch that attaches the Appwrite JWT for admin API calls. */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const jwt = getJWT();
  const headers = new Headers(options.headers);
  if (jwt) {
    headers.set('Authorization', `Bearer ${jwt}`);
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('appwrite_jwt');
    if (onUnauthorized) {
      onUnauthorized(); // Clears React user state → Login shows form, not redirect
    } else {
      window.location.href = '/login';
    }
  }
  return res;
}
