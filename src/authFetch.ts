import { getJWT } from './auth';

/** Wrapper around fetch that attaches the Appwrite JWT for admin API calls.
 *  If the server returns 401, redirects to the login page. */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const jwt = getJWT();
  const headers = new Headers(options.headers);
  if (jwt) {
    headers.set('Authorization', `Bearer ${jwt}`);
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('appwrite_jwt');
    window.location.href = '/login';
  }
  return res;
}
