// ── MainWP REST API Integration ───────────────────────────────────────────────
// Connects to a self-hosted MainWP dashboard via its REST API.
// Auth: single API key passed as Authorization: Bearer header.
// Docs: https://mainwp.com/help/docs/mainwp-rest-api/

export interface MainWPUpgrade {
  name: string;
  slug: string;
  currentVersion: string;
  newVersion: string;
  type: 'plugin' | 'theme' | 'core' | 'translation';
}

export interface MainWPVersionMap {
  wp: string;
  plugins: Record<string, { name: string; version: string }>;
  themes: Record<string, { name: string; version: string }>;
}

export interface MainWPSiteData {
  siteId: string;
  name: string;
  url: string;
  wpVersion: string;
  phpVersion: string | null;
  mysqlVersion: string | null;
  memoryLimit: string | null;
  activeTheme: string | null;
  serverIp: string | null;
  lastSynced: string | null;
  upgrades: MainWPUpgrade[];
  totalUpgrades: number;
  /** Internal: current versions of all plugins/themes — used for snapshot diffing in server.ts */
  versionMap: MainWPVersionMap;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function mainwpFetch(url: string, apiKey: string): Promise<any> {
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`MainWP API error ${res.status}: ${text}`);
  }
  return res.json();
}

function safeParseJSON(raw: any): any {
  if (!raw) return null;
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

/** Parse plugin_upgrades / theme_upgrades — object keyed by slug */
function parseKeyedUpgrades(raw: any, type: 'plugin' | 'theme' | 'translation'): MainWPUpgrade[] {
  const data = safeParseJSON(raw);
  if (!data || Array.isArray(data) || typeof data !== 'object') return [];
  return Object.entries(data).map(([slug, info]: [string, any]) => ({
    name: info.Name || info.name || slug,
    slug,
    currentVersion: info.Version || info.version || '',
    newVersion: info.update?.new_version || '',
    type,
  }));
}

/** Parse wp_upgrades — may be an object with new_version or an empty array */
function parseCoreUpgrades(raw: any): MainWPUpgrade[] {
  const data = safeParseJSON(raw);
  if (!data) return [];
  if (Array.isArray(data) && data.length === 0) return [];
  if (data.new_version) {
    return [{
      name: 'WordPress Core',
      slug: 'wordpress',
      currentVersion: '',
      newVersion: data.new_version,
      type: 'core',
    }];
  }
  return [];
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function getMainWPSiteData(
  baseUrl: string,
  apiKey: string,
  siteId: string
): Promise<MainWPSiteData> {
  const base = baseUrl.replace(/\/$/, '');
  const raw = await mainwpFetch(`${base}/wp-json/mainwp/v2/sites/${siteId}`, apiKey);

  // v2 response nests everything under raw.data
  const d = raw?.data ?? raw?.site ?? raw;

  const upgrades: MainWPUpgrade[] = [
    ...parseCoreUpgrades(d.wp_upgrades),
    ...parseKeyedUpgrades(d.plugin_upgrades, 'plugin'),
    ...parseKeyedUpgrades(d.theme_upgrades, 'theme'),
    ...parseKeyedUpgrades(d.translation_upgrades, 'translation'),
  ];

  // Build version map for snapshot comparison
  const rawPlugins: any[] = safeParseJSON(d.plugins) || [];
  const rawThemes: any[] = safeParseJSON(d.themes) || [];

  const versionMap: MainWPVersionMap = {
    wp: d.wp_version || '',
    plugins: Object.fromEntries(
      rawPlugins.map((p: any) => [p.slug || p.name, { name: p.name || p.slug, version: p.version || '' }])
    ),
    themes: Object.fromEntries(
      rawThemes.map((t: any) => [t.slug || t.name, { name: t.name || t.slug, version: t.version || '' }])
    ),
  };

  return {
    siteId,
    name: d.name || d.url || siteId,
    url: d.url || '',
    wpVersion: d.wp_version || '',
    phpVersion: d.php_version || null,
    mysqlVersion: d.mysql_version || null,
    memoryLimit: d.memory_limit || null,
    activeTheme: d.active_theme || null,
    serverIp: d.ip || null,
    lastSynced: d.last_sync || null,
    upgrades,
    totalUpgrades: upgrades.length,
    versionMap,
  };
}
