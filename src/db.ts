export interface Client {
  id: string;
  client_id_number: string | null;
  name: string;
  slug: string;
  website_url: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_email: string | null;
  enabled_pages: string | null;
  ga_property_id: string | null;
  gsc_site_url: string | null;
  bq_project_id: string | null;
  bq_dataset_id: string | null;
  bq_table_id: string | null;
  psi_url: string | null;
  is_active: number;
  created_at: string;
}

export interface PSISnapshot {
  id: string;
  client_id: string;
  strategy: string;
  data: string; // JSON string
  created_at: string;
}

// In-memory data stores
let clients: Client[] = [];
let psiSnapshots: PSISnapshot[] = [];
let gaMetrics: any[] = [];
let gscMetrics: any[] = [];
let settings: Record<string, string> = {};

const generateId = () => Math.random().toString(36).substring(2, 15);

export const getClients = async (): Promise<Client[]> => {
  return [...clients].sort((a, b) => a.name.localeCompare(b.name));
};

export const getLatestPSISnapshot = async (clientId: string, strategy: string): Promise<PSISnapshot | undefined> => {
  const filtered = psiSnapshots
    .filter(d => d.client_id === clientId && d.strategy === strategy)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return filtered.length > 0 ? filtered[0] : undefined;
};

export const savePSISnapshot = async (clientId: string, strategy: string, data: any): Promise<void> => {
  psiSnapshots.push({
    id: generateId(),
    client_id: clientId,
    strategy,
    data: JSON.stringify(data),
    created_at: new Date().toISOString()
  });
};

export const getPSISnapshots = async (clientId: string, strategy: string, limit: number = 30): Promise<PSISnapshot[]> => {
  return psiSnapshots
    .filter(d => d.client_id === clientId && d.strategy === strategy)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
};

export const saveGAMetrics = async (clientId: string, date: string, metrics: { activeUsers: number, sessions: number, screenPageViews: number }): Promise<void> => {
  const existingIndex = gaMetrics.findIndex(m => m.client_id === clientId && m.date === date);
  const newMetric = {
    client_id: clientId,
    date,
    active_users: metrics.activeUsers,
    sessions: metrics.sessions,
    screen_page_views: metrics.screenPageViews,
    created_at: new Date().toISOString()
  };
  if (existingIndex >= 0) {
    gaMetrics[existingIndex] = { ...gaMetrics[existingIndex], ...newMetric };
  } else {
    gaMetrics.push(newMetric);
  }
};

export const getGAMetrics = async (clientId: string, startDate: string, endDate: string): Promise<any[]> => {
  return gaMetrics
    .filter(d => d.client_id === clientId && d.date >= startDate && d.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date));
};

export const saveGSCMetrics = async (clientId: string, date: string, metrics: { clicks: number, impressions: number, ctr: number, position: number }): Promise<void> => {
  const existingIndex = gscMetrics.findIndex(m => m.client_id === clientId && m.date === date);
  const newMetric = {
    client_id: clientId,
    date,
    clicks: metrics.clicks,
    impressions: metrics.impressions,
    ctr: metrics.ctr,
    position: metrics.position,
    created_at: new Date().toISOString()
  };
  if (existingIndex >= 0) {
    gscMetrics[existingIndex] = { ...gscMetrics[existingIndex], ...newMetric };
  } else {
    gscMetrics.push(newMetric);
  }
};

export const getGSCMetrics = async (clientId: string, startDate: string, endDate: string): Promise<any[]> => {
  return gscMetrics
    .filter(d => d.client_id === clientId && d.date >= startDate && d.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date));
};

export const deleteClient = async (id: string): Promise<void> => {
  clients = clients.filter(c => c.id !== id);
};

export const getClientBySlug = async (slug: string): Promise<Client | undefined> => {
  return clients.find(c => c.slug === slug);
};

export const getClientById = async (id: string): Promise<Client | undefined> => {
  return clients.find(c => c.id === id);
};

export const createClient = async (client: Omit<Client, 'id' | 'created_at'>): Promise<Client> => {
  const newClient: Client = {
    ...client,
    id: generateId(),
    created_at: new Date().toISOString()
  };
  clients.push(newClient);
  return newClient;
};

export const updateClient = async (id: string, client: Omit<Client, 'id' | 'created_at'>): Promise<Client> => {
  const index = clients.findIndex(c => c.id === id);
  if (index === -1) throw new Error('Client not found');
  clients[index] = { ...clients[index], ...client };
  return clients[index];
};

export const getSetting = async (key: string): Promise<string | undefined> => {
  return settings[key];
};

export const setSetting = async (key: string, value: string): Promise<void> => {
  settings[key] = value;
};
