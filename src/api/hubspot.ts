// ── HubSpot CRM Integration ───────────────────────────────────────────────────
// Uses HubSpot Private App Bearer token (Access Token) for all API calls.
// Matches subscription records by website URL — no per-client ID needed.
// Object: built-in Subscriptions (type ID 0-69) at /crm/v3/objects/subscriptions

import { toZonedTime } from 'date-fns-tz';

const TIMEZONE = 'Australia/Melbourne';

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
  startDate: string | null;   // custom 'start_date' property on the subscription
  createDate: string | null;  // built-in 'createdate' — always present, used as fallback
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
  'start_date',
  'createdate',     // built-in HubSpot field
  'hs_createdate',  // alternate name returned by subscriptions object — used as start_date fallback
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
    startDate:       props.start_date || null,
    createDate:      props.hs_createdate || props.createdate || null,
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

// ── Contact associations ───────────────────────────────────────────────────────

/** Fetch first name, last name, and email of the Contact associated with a subscription record */
export async function getHubSpotContactForSubscription(
  accessToken: string,
  subscriptionRecordId: string
): Promise<{ firstName: string | null; lastName: string | null; email: string | null }> {
  try {
    const assocRes = await fetch(
      `${HUBSPOT_API_BASE}/crm/v3/objects/subscriptions/${subscriptionRecordId}/associations/contacts`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!assocRes.ok) return { firstName: null, lastName: null, email: null };
    const assocData = await assocRes.json();
    const contactId = assocData.results?.[0]?.id;
    if (!contactId) return { firstName: null, lastName: null, email: null };

    const contactRes = await fetch(
      `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactId}?properties=firstname,lastname,email`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!contactRes.ok) return { firstName: null, lastName: null, email: null };
    const contactData = await contactRes.json();
    return {
      firstName: contactData.properties?.firstname ?? null,
      lastName:  contactData.properties?.lastname  ?? null,
      email:     contactData.properties?.email     ?? null,
    };
  } catch {
    return { firstName: null, lastName: null, email: null };
  }
}

// ── Next send date calculation ────────────────────────────────────────────────

/**
 * Given a start_date string (YYYY-MM-DD or ISO timestamp from HubSpot),
 * compute the next monthly send date based on the day-of-month of the start date.
 * e.g. start_date = 2024-02-12 → sends on the 12th of each month.
 */
export function computeNextSendDate(startDateStr: string): string {
  // Handle both epoch-ms strings (HubSpot datetime) and YYYY-MM-DD / ISO strings
  let startDate: Date;
  const asNum = Number(startDateStr);
  if (!isNaN(asNum) && asNum > 1e10) {
    // HubSpot epoch milliseconds e.g. "1706745600000"
    startDate = new Date(asNum);
  } else {
    // YYYY-MM-DD: append noon so timezone offset can't roll the date back a day
    startDate = new Date(startDateStr.length === 10 ? startDateStr + 'T12:00:00' : startDateStr);
  }

  const sendDay = startDate.getDate(); // day-of-month to send on
  // Use Melbourne "today" instead of server-local time
  const now = toZonedTime(new Date(), TIMEZONE);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const candidate = new Date(today.getFullYear(), today.getMonth(), sendDay);
  // Strict > so that if today IS the send day it is kept (email fires today, then advances)
  if (today > candidate) {
    candidate.setMonth(candidate.getMonth() + 1);
  }
  // Manual YYYY-MM-DD to avoid toISOString() UTC shift
  const yyyy = candidate.getFullYear();
  const mm = String(candidate.getMonth() + 1).padStart(2, '0');
  const dd = String(candidate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Advance a next_send_date by exactly one month (preserving the day-of-month).
 */
export function advanceNextSendDate(currentSendDate: string): string {
  const d = new Date(currentSendDate + 'T12:00:00');
  const sendDay = d.getDate();
  const next = new Date(d.getFullYear(), d.getMonth() + 1, sendDay);
  // Manual YYYY-MM-DD to avoid toISOString() UTC shift
  const yyyy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, '0');
  const dd = String(next.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
