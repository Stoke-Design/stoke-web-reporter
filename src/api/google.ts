import { google } from "googleapis";
import { getSetting } from "../db";

let authClient: any = null;

export const getAuthClient = async () => {
  // Always try to fetch fresh credentials if not initialized or if we want to support dynamic updates without restart
  // But for performance, we can cache. However, if user updates settings, we need to invalidate cache.
  // For simplicity in this context, let's rebuild if not present, or maybe just rebuild every time?
  // Rebuilding every time is safer for "settings updated" scenario, but slower.
  // Let's stick to caching but maybe add a way to clear it?
  // Actually, let's just check DB first.

  const dbCredentials = await getSetting("google_service_account_json");
  const credentialsJson =
    dbCredentials || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!credentialsJson) {
    console.warn(
      "Google Service Account JSON is not set in Settings or Environment.",
    );
    return null;
  }

  try {
    const credentials = JSON.parse(credentialsJson as string);
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
    }
    // If we have a cached client and the credentials match (hash check?), we could reuse.
    // But simply recreating the auth client isn't that expensive compared to the API call.
    // Let's recreate to ensure we always use the latest settings.

    authClient = new google.auth.GoogleAuth({
      credentials,
      projectId: credentials.project_id,
      scopes: [
        "https://www.googleapis.com/auth/analytics.readonly",
        "https://www.googleapis.com/auth/webmasters.readonly",
        "https://www.googleapis.com/auth/bigquery.readonly",
      ],
    });
    return authClient;
  } catch (error) {
    console.error("Failed to parse Google Service Account JSON:", error);
    return null;
  }
};

export const listGASites = async () => {
  const auth = await getAuthClient();
  if (!auth) throw new Error("Google Auth not configured");

  const analyticsadmin = google.analyticsadmin({ version: "v1beta", auth });

  try {
    // 1. List Accounts
    const accountsRes = await analyticsadmin.accounts.list();
    const accounts = accountsRes.data.accounts || [];

    const allProperties: any[] = [];

    // 2. List Properties for each account (or just list all accessible properties if possible)
    // Actually, analyticsadmin.properties.list({ filter: 'parent:accounts/...' }) is needed.
    // But there is a method to list all properties accessible?
    // analyticsadmin.properties.list({ filter: 'ancestor:accounts/-' }) might work for all?
    // Let's try listing properties directly with a wildcard if supported, or iterate accounts.

    // Better approach: Use account summaries if available, or iterate accounts.
    // Let's iterate accounts found.

    for (const account of accounts) {
      if (!account.name) continue;
      try {
        const propsRes = await analyticsadmin.properties.list({
          filter: `parent:${account.name}`,
        });
        if (propsRes.data.properties) {
          allProperties.push(...propsRes.data.properties);
        }
      } catch (e) {
        console.warn(
          `Failed to list properties for account ${account.name}`,
          e,
        );
      }
    }

    return allProperties.map((p) => ({
      name: p.displayName,
      id: p.name?.split("/").pop(), // properties/12345 -> 12345
      property: p.name,
    }));
  } catch (error: any) {
    console.error("GA List Error:", error.message);
    throw new Error(`Failed to list GA properties: ${error.message}`);
  }
};

export const listGSCSites = async () => {
  const auth = await getAuthClient();
  if (!auth) throw new Error("Google Auth not configured");

  const searchconsole = google.searchconsole({ version: "v1", auth });

  try {
    const response = await searchconsole.sites.list();
    return (response.data.siteEntry || []).map((s) => ({
      siteUrl: s.siteUrl,
      permissionLevel: s.permissionLevel,
    }));
  } catch (error: any) {
    console.error("GSC List Error:", error.message);
    throw new Error(`Failed to list GSC sites: ${error.message}`);
  }
};

export const fetchGAData = async (
  propertyId: string,
  startDate: string,
  endDate: string,
  dimensions: string[] = ["date"],
  metrics: string[] = ["activeUsers", "sessions", "screenPageViews"],
) => {
  const auth = await getAuthClient();
  if (!auth) throw new Error("Google Auth not configured");

  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  try {
    const requestBody: any = {
      dateRanges: [{ startDate, endDate }],
      metrics: metrics.map((name) => ({ name })),
    };
    if (dimensions.length > 0) {
      requestBody.dimensions = dimensions.map((name) => ({ name }));
    }

    const cleanPropertyId = propertyId.replace("properties/", "");
    const response = await analyticsdata.properties.runReport({
      property: `properties/${cleanPropertyId}`,
      requestBody,
    });

    return response.data;
  } catch (error: any) {
    console.error("GA Error:", error.message);

    if (error.code === 403 || error.message.includes("sufficient permission")) {
      let clientEmail = "";
      try {
        const dbCredentials = await getSetting("google_service_account_json");
        const credentialsJson =
          dbCredentials || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
        if (credentialsJson && typeof credentialsJson === "string") {
          const creds = JSON.parse(credentialsJson);
          clientEmail = creds.client_email || "";
        }
      } catch (e) {
        // Ignore JSON parse error
      }

      if (clientEmail) {
        throw new Error(
          `Access denied. Please add the service account email "${clientEmail}" as a User to the GA4 Property "${propertyId}" in Google Analytics settings.`,
        );
      }
    }

    throw new Error(`Failed to fetch GA data: ${error.message}`);
  }
};

export const fetchGSCData = async (
  siteUrl: string,
  startDate: string,
  endDate: string,
) => {
  const auth = await getAuthClient();
  if (!auth) throw new Error("Google Auth not configured");

  const searchconsole = google.searchconsole({ version: "v1", auth });

  try {
    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["date"],
      },
    });

    return response.data;
  } catch (error: any) {
    console.error("GSC Error:", error.message);

    if (error.code === 403 || error.message.includes("sufficient permission")) {
      let clientEmail = "";
      try {
        const dbCredentials = await getSetting("google_service_account_json");
        const credentialsJson =
          dbCredentials || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
        if (credentialsJson && typeof credentialsJson === "string") {
          const creds = JSON.parse(credentialsJson);
          clientEmail = creds.client_email || "";
        }
      } catch (e) {
        // Ignore JSON parse error
      }

      if (clientEmail) {
        throw new Error(
          `Access denied. Please add the service account email "${clientEmail}" as a User (with 'Full' or 'Restricted' permissions) to the property "${siteUrl}" in Google Search Console settings.`,
        );
      }
    }

    throw new Error(`Failed to fetch GSC data: ${error.message}`);
  }
};

export const fetchBQData = async (
  projectId: string,
  datasetId: string,
  tableId: string,
) => {
  const auth = await getAuthClient();
  if (!auth) throw new Error("Google Auth not configured");

  const bigquery = google.bigquery({ version: "v2", auth });

  try {
    // Example query: get the last 30 days of data if there's a date column,
    // or just a simple SELECT * LIMIT 100 for demonstration.
    // In a real app, this would be tailored to the specific table schema.
    const query = `SELECT * FROM \`${projectId}.${datasetId}.${tableId}\` LIMIT 100`;

    const response = await bigquery.jobs.query({
      projectId,
      requestBody: {
        query,
        useLegacySql: false,
      },
    });

    return response.data;
  } catch (error: any) {
    console.error("BQ Error:", error.message);
    throw new Error(`Failed to fetch BQ data: ${error.message}`);
  }
};

/** Strip full PSI response down to only the fields the dashboard uses.
 *  Keeps the payload well under Appwrite's 65 535-char string limit. */
export const slimPSIData = (data: any): any => {
  const AUDITS_NEEDED = [
    'largest-contentful-paint',
    'total-blocking-time',
    'cumulative-layout-shift',
  ];
  const slim: any = {};
  if (data.lighthouseResult) {
    slim.lighthouseResult = {
      categories: data.lighthouseResult.categories ?? {},
      audits: {} as Record<string, any>,
    };
    for (const key of AUDITS_NEEDED) {
      const audit = data.lighthouseResult.audits?.[key];
      if (audit) {
        slim.lighthouseResult.audits[key] = {
          displayValue: audit.displayValue,
          score: audit.score,
        };
      }
    }
  }
  return slim;
};

export const fetchPSIData = async (
  url: string,
  strategy: "mobile" | "desktop",
) => {
  // PSI is a public API — it only supports API keys, not service account OAuth.
  // Always use the API key regardless of whether a service account is configured.
  const pagespeedonline = google.pagespeedonline({ version: "v5" });

  try {
    const dbKey = await getSetting("google_api_key");
    const key = dbKey || process.env.GOOGLE_API_KEY;

    const response = await pagespeedonline.pagespeedapi.runpagespeed({
      url,
      strategy: strategy.toUpperCase() as "MOBILE" | "DESKTOP",
      key: key as string | undefined,
      category: ["PERFORMANCE", "ACCESSIBILITY", "BEST_PRACTICES", "SEO"],
    });

    return response.data;
  } catch (error: any) {
    console.error("PSI Error:", error.message);

    if (
      error.message?.toLowerCase().includes("quota exceeded") ||
      error.code === 429
    ) {
      throw new Error(
        "Google PageSpeed Insights API quota exceeded. Please ensure a valid Google API Key is set in Settings and that the PageSpeed Insights API is enabled in your Google Cloud Console.",
      );
    }

    throw new Error(`Failed to fetch PSI data: ${error.message}`);
  }
};
