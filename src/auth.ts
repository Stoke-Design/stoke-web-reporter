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

/** Try to get the current session user. Returns null if not logged in. */
export async function getCurrentUser() {
  try {
    return await getAccount().get();
  } catch {
    // Session expired or not logged in — clear stored JWT
    localStorage.removeItem(JWT_KEY);
    return null;
  }
}

/** Email + password login — creates session then obtains a JWT for server-side validation */
export async function login(email: string, password: string) {
  await getAccount().createEmailPasswordSession(email, password);
  // Create a JWT so we can pass it to our Express backend
  const jwtResponse = await getAccount().createJWT(3600); // 1 hour max
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
