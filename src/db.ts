import { Client, Databases, Query, ID } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

// ── Appwrite client (server-side only, never exposed to browser) ────────────
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://appwrite.stokecloud.dev/v1')
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);

const DB_ID    = process.env.APPWRITE_DATABASE_ID!;
const COL_CLIENTS  = process.env.APPWRITE_COLLECTION_CLIENTS!;
const COL_SETTINGS = process.env.APPWRITE_COLLECTION_SETTINGS!;
const COL_PSI      = process.env.APPWRITE_COLLECTION_PSI_SNAPSHOTS!;
const COL_GA       = process.env.APPWRITE_COLLECTION_GA_METRICS!;
const COL_GSC      = process.env.APPWRITE_COLLECTION_GSC_METRICS!;

// ── Interfaces ───────────────────────────────────────────────────────────────
export interface Client_ {
  id: string;
  client_id_number: string | null;
  name: string;
  slug: string;
  website_url: string | null;
  enabled_pages: string | null;
  ga_property_id: string | null;
  gsc_site_url: string | null;
  bq_project_id: string | null;
  bq_dataset_id: string | null;
  bq_table_id: string | null;
  psi_url: string | null;
  uptime_kuma_slug: string | null;
  mainwp_site_id: string | null;
  care_plan: string | null;
  is_active: number;
  created_at: string;
}

// Keep the exported name as Client for backwards compatibility with server.ts
export type { Client_ as Client };

export interface PSISnapshot {
  id: string;
  client_id: string;
  strategy: string;
  data: string; // JSON string
  created_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Map an Appwrite document to our Client interface */
function docToClient(doc: Record<string, any>): Client_ {
  return {
    id: doc.$id,
    client_id_number: doc.client_id_number ?? null,
    name: doc.name,
    slug: doc.slug,
    website_url: doc.website_url ?? null,
    enabled_pages: doc.enabled_pages ?? null,
    ga_property_id: doc.ga_property_id ?? null,
    gsc_site_url: doc.gsc_site_url ?? null,
    bq_project_id: doc.bq_project_id ?? null,
    bq_dataset_id: doc.bq_dataset_id ?? null,
    bq_table_id: doc.bq_table_id ?? null,
    psi_url: doc.psi_url ?? null,
    uptime_kuma_slug: doc.uptime_kuma_slug ?? null,
    mainwp_site_id: doc.mainwp_site_id ?? null,
    care_plan: doc.care_plan ?? null,
    // Stored as Boolean in Appwrite; convert to 0/1 for the rest of the app
    is_active: doc.is_active ? 1 : 0,
    created_at: doc.$createdAt,
  };
}

/** Map an Appwrite document to our PSISnapshot interface */
function docToPSI(doc: Record<string, any>): PSISnapshot {
  return {
    id: doc.$id,
    client_id: doc.client_id,
    strategy: doc.strategy,
    data: doc.data,
    created_at: doc.$createdAt,
  };
}

// ── Clients ──────────────────────────────────────────────────────────────────

export const getClients = async (): Promise<Client_[]> => {
  // Fetch up to 100 clients (adjust if your instance grows beyond this)
  const result = await databases.listDocuments(DB_ID, COL_CLIENTS, [
    Query.orderAsc('name'),
    Query.limit(100),
  ]);
  return result.documents.map(docToClient);
};

export const getClientById = async (id: string): Promise<Client_ | undefined> => {
  try {
    const doc = await databases.getDocument(DB_ID, COL_CLIENTS, id);
    return docToClient(doc);
  } catch (e: any) {
    if (e.code === 404) return undefined;
    throw e;
  }
};

export const getClientBySlug = async (slug: string): Promise<Client_ | undefined> => {
  const result = await databases.listDocuments(DB_ID, COL_CLIENTS, [
    Query.equal('slug', slug),
    Query.limit(1),
  ]);
  if (result.documents.length === 0) return undefined;
  return docToClient(result.documents[0]);
};

// Core fields written on every create/update — does NOT include care_plan
// (care_plan is written separately via setClientCarePlan once the Appwrite attribute exists)
const clientFields = (client: Omit<Client_, 'id' | 'created_at'>) => ({
  client_id_number: client.client_id_number ?? '',
  name: client.name,
  slug: client.slug,
  website_url: client.website_url ?? '',
  enabled_pages: client.enabled_pages ?? null,
  ga_property_id: client.ga_property_id ?? null,
  gsc_site_url: client.gsc_site_url ?? null,
  bq_project_id: client.bq_project_id ?? null,
  bq_dataset_id: client.bq_dataset_id ?? null,
  bq_table_id: client.bq_table_id ?? null,
  psi_url: client.psi_url ?? null,
  uptime_kuma_slug: client.uptime_kuma_slug ?? null,
  mainwp_site_id: client.mainwp_site_id ?? null,
  is_active: client.is_active !== 0,
});

export const createClient = async (client: Omit<Client_, 'id' | 'created_at'>): Promise<Client_> => {
  const doc = await databases.createDocument(DB_ID, COL_CLIENTS, ID.unique(), clientFields(client));
  return docToClient(doc);
};

export const updateClient = async (id: string, client: Omit<Client_, 'id' | 'created_at'>): Promise<Client_> => {
  const doc = await databases.updateDocument(DB_ID, COL_CLIENTS, id, clientFields(client));
  return docToClient(doc);
};

/** Patch only the care_plan field — used by HubSpot sync after the Appwrite attribute is added */
export const setClientCarePlan = async (id: string, carePlan: string | null): Promise<void> => {
  await databases.updateDocument(DB_ID, COL_CLIENTS, id, { care_plan: carePlan });
};

export const deleteClient = async (id: string): Promise<void> => {
  await databases.deleteDocument(DB_ID, COL_CLIENTS, id);
};

// ── Settings (key-value store) ───────────────────────────────────────────────
// We use the setting key as the Appwrite document ID for O(1) lookups.

export const getSetting = async (key: string): Promise<string | undefined> => {
  try {
    const doc = await databases.getDocument(DB_ID, COL_SETTINGS, key);
    return doc.value ?? undefined;
  } catch (e: any) {
    if (e.code === 404) return undefined;
    throw e;
  }
};

export const setSetting = async (key: string, value: string): Promise<void> => {
  try {
    await databases.updateDocument(DB_ID, COL_SETTINGS, key, { value });
  } catch (e: any) {
    if (e.code === 404) {
      // Document doesn't exist yet — create it using the key as the document ID
      try {
        await databases.createDocument(DB_ID, COL_SETTINGS, key, { key, value });
      } catch (createErr: any) {
        console.error(`[setSetting] Failed to CREATE "${key}":`, createErr);
        throw createErr;
      }
    } else {
      console.error(`[setSetting] Failed to UPDATE "${key}":`, e);
      throw e;
    }
  }
};

// ── PSI Snapshots ────────────────────────────────────────────────────────────

export const savePSISnapshot = async (clientId: string, strategy: string, data: any): Promise<void> => {
  await databases.createDocument(DB_ID, COL_PSI, ID.unique(), {
    client_id: clientId,
    strategy,
    data: JSON.stringify(data),
  });
};

export const getLatestPSISnapshot = async (clientId: string, strategy: string): Promise<PSISnapshot | undefined> => {
  const result = await databases.listDocuments(DB_ID, COL_PSI, [
    Query.equal('client_id', clientId),
    Query.equal('strategy', strategy),
    Query.orderDesc('$createdAt'),
    Query.limit(1),
  ]);
  if (result.documents.length === 0) return undefined;
  return docToPSI(result.documents[0]);
};

export const getPSISnapshots = async (clientId: string, strategy: string, limit: number = 30): Promise<PSISnapshot[]> => {
  const result = await databases.listDocuments(DB_ID, COL_PSI, [
    Query.equal('client_id', clientId),
    Query.equal('strategy', strategy),
    Query.orderDesc('$createdAt'),
    Query.limit(limit),
  ]);
  return result.documents.map(docToPSI);
};

// ── GA Metrics ───────────────────────────────────────────────────────────────

export const saveGAMetrics = async (
  clientId: string,
  date: string,
  metrics: { activeUsers: number; sessions: number; screenPageViews: number }
): Promise<void> => {
  const data = {
    client_id: clientId,
    date,
    active_users: metrics.activeUsers,
    sessions: metrics.sessions,
    screen_page_views: metrics.screenPageViews,
  };

  // Check if a record already exists for this client + date
  const existing = await databases.listDocuments(DB_ID, COL_GA, [
    Query.equal('client_id', clientId),
    Query.equal('date', date),
    Query.limit(1),
  ]);

  if (existing.documents.length > 0) {
    await databases.updateDocument(DB_ID, COL_GA, existing.documents[0].$id, data);
  } else {
    await databases.createDocument(DB_ID, COL_GA, ID.unique(), data);
  }
};

export const getGAMetrics = async (clientId: string, startDate: string, endDate: string): Promise<any[]> => {
  const result = await databases.listDocuments(DB_ID, COL_GA, [
    Query.equal('client_id', clientId),
    Query.greaterThanEqual('date', startDate),
    Query.lessThanEqual('date', endDate),
    Query.orderAsc('date'),
    Query.limit(100),
  ]);
  return result.documents.map(doc => ({
    client_id: doc.client_id,
    date: doc.date,
    active_users: doc.active_users,
    sessions: doc.sessions,
    screen_page_views: doc.screen_page_views,
    created_at: doc.$createdAt,
  }));
};

// ── GSC Metrics ──────────────────────────────────────────────────────────────

export const saveGSCMetrics = async (
  clientId: string,
  date: string,
  metrics: { clicks: number; impressions: number; ctr: number; position: number }
): Promise<void> => {
  const data = {
    client_id: clientId,
    date,
    clicks: metrics.clicks,
    impressions: metrics.impressions,
    ctr: metrics.ctr,
    position: metrics.position,
  };

  const existing = await databases.listDocuments(DB_ID, COL_GSC, [
    Query.equal('client_id', clientId),
    Query.equal('date', date),
    Query.limit(1),
  ]);

  if (existing.documents.length > 0) {
    await databases.updateDocument(DB_ID, COL_GSC, existing.documents[0].$id, data);
  } else {
    await databases.createDocument(DB_ID, COL_GSC, ID.unique(), data);
  }
};

export const getGSCMetrics = async (clientId: string, startDate: string, endDate: string): Promise<any[]> => {
  const result = await databases.listDocuments(DB_ID, COL_GSC, [
    Query.equal('client_id', clientId),
    Query.greaterThanEqual('date', startDate),
    Query.lessThanEqual('date', endDate),
    Query.orderAsc('date'),
    Query.limit(100),
  ]);
  return result.documents.map(doc => ({
    client_id: doc.client_id,
    date: doc.date,
    clicks: doc.clicks,
    impressions: doc.impressions,
    ctr: doc.ctr,
    position: doc.position,
    created_at: doc.$createdAt,
  }));
};
