// ── HubSpot CRM Integration ───────────────────────────────────────────────────
// Uses HubSpot Private App Bearer token (Access Token) for all API calls.
// Matches subscription records by website URL — no per-client ID needed.
// Object: built-in Subscriptions (type ID 0-69) at /crm/v3/objects/subscriptions

export interface HubSpotSubscriptionData {
  recordId: string;
  carePlan: string | null;
  billingMethod: string | null;
  slaType: string | null;
  billingFrequency: string | null;
  nextReviewDate: string | null;
  websiteUrl: string | null;
  reportUrl: string | null;
  contactEmail: string | null;
}

const HUBSPOT_API_BASE = 'https://api.hubapi.com';
const OBJECT_TYPE = 'subscriptions'; // Built-in HubSpot Subscriptions object (0-69)

// Properties to fetch from each subscription record
// Include common variants of care_plan property name in case the internal name differs
const SUBSCRIPTION_PROPERTIES = [
  'care_plan',
  'hs_care_plan',
  'billing_method',
  'sla_type',
  'billing_frequency',
  'recurring_billing_frequency',
  'next_review_date',
  'website_url',
  'report_url',
  'contact_email',
];

function authHeaders(accessToken: string): HeadersInit {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

function mapSubscription(data: any): HubSpotSubscriptionData {
  const props = data.properties || {};
  return {
    recordId:        data.id || '',
    carePlan:        props.care_plan || props.hs_care_plan || null,
    billingMethod:   props.billing_method || null,
    slaType:         props.sla_type || null,
    billingFrequency: props.billing_frequency || props.recurring_billing_frequency || null,
    nextReviewDate:  props.next_review_date || null,
    websiteUrl:      props.website_url || null,
    reportUrl:       props.report_url || null,
    contactEmail:    props.contact_email || null,
  };
}

// ── Search subscription by website URL ────────────────────────────────────────

export async function getHubSpotSubscriptionByUrl(
  accessToken: string,
  websiteUrl: string
): Promise<HubSpotSubscriptionData | null> {
  // Normalise URL: try both with and without trailing slash
  const cleanUrl = websiteUrl.replace(/\/$/, '');

  const body = {
    filterGroups: [
      {
        filters: [
          { propertyName: 'website_url', operator: 'EQ', value: cleanUrl },
        ],
      },
      {
        filters: [
          { propertyName: 'website_url', operator: 'EQ', value: cleanUrl + '/' },
        ],
      },
    ],
    properties: SUBSCRIPTION_PROPERTIES,
    limit: 1,
  };

  const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/${OBJECT_TYPE}/search`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`HubSpot search error ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (!data.results || data.results.length === 0) return null;
  // Log raw properties to help debug property name mismatches
  console.log('[HubSpot] Raw subscription properties:', JSON.stringify(data.results[0].properties, null, 2));
  return mapSubscription(data.results[0]);
}

// ── Push report URL to the subscription record ────────────────────────────────

export async function pushReporterUrlToHubSpot(
  accessToken: string,
  recordId: string,
  reporterUrl: string
): Promise<void> {
  const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/${OBJECT_TYPE}/${recordId}`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      properties: { report_url: reporterUrl },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`HubSpot PATCH error ${res.status}: ${text}`);
  }
}
