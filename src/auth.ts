import { Client, Account } from 'appwrite';

let client: Client | null = null;
let account: Account | null = null;

const JWT_KEY = 'appwrite_jwt';

/** Initialise the Appwrite browser client (called once after fetching config from server) */
export function initAuth(endpoint: string, projectId: string) {
  client = new Client().setEndpoint(endpoint).setProject(projectId);
  account = new Account(client);
}

export function getAccount(): Account {
  if (!account) throw new Error('Auth not initialised — call initAuth() first');
  return account;
}

/** Try to get the current session user. Also refreshes the JWT so authFetch always has a valid token. */
export async function getCurrentUser() {
  try {
    const user = await getAccount().get();
    // Always refresh JWT when session is confirmed valid
    const jwtResponse = await getAccount().createJWT(3600);
    localStorage.setItem(JWT_KEY, jwtResponse.jwt);
    return user;
  } catch {
    localStorage.removeItem(JWT_KEY);
    return null;
  }
}

/** Email + password login — creates session then obtains a JWT for server-side validation */
export async function login(email: string, password: string) {
  await getAccount().createEmailPasswordSession(email, password);
  const jwtResponse = await getAccount().createJWT(3600);
  localStorage.setItem(JWT_KEY, jwtResponse.jwt);
  return jwtResponse;
}

/** Get the stored JWT (for passing to server) */
export function getJWT(): string | null {
  return localStorage.getItem(JWT_KEY);
}

/** Logout — delete current session and clear JWT */
export async function logout() {
  try {
    await getAccount().deleteSession('current');
  } catch {
    // Session may already be expired
  }
  localStorage.removeItem(JWT_KEY);
}
