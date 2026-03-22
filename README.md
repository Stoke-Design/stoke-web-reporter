# Stoke Web Reporter

A multi-client website performance monitoring and reporting dashboard for digital agencies. Aggregates data from Google Analytics, Google Search Console, PageSpeed Insights, Uptime Kuma, MainWP, and HubSpot into a unified client-facing portal with AI-generated performance summaries, automated email reports, and PDF export.

---

## Features

- **Multi-client dashboard** — manage and view performance reports across all client sites from a single admin interface
- **Google Analytics 4** — sessions, users, page views, engagement rate, traffic sources, top pages, country breakdown
- **Google Search Console** — clicks, impressions, CTR, average position, top queries, device split
- **PageSpeed Insights** — Lighthouse scores (Performance, Accessibility, Best Practices, SEO) with historical trend tracking
- **Uptime Kuma** — real-time availability monitoring and uptime percentage via Socket.IO
- **MainWP** — WordPress site health, pending plugin/theme/core updates, PHP and WP version
- **HubSpot CRM** — subscription/care plan data synced from CRM, contact details pulled from associated contacts, "View in HubSpot" deep link from admin
- **AI Report Generation** — Claude-powered monthly performance summaries written in Australian English, personalised with the contact's first name
- **Automated Email Reports** — monthly HTML email reports sent via Postmark SMTP with configurable send hour (Australia/Melbourne timezone)
- **PDF Export** — programmatic jsPDF report generation covering all active dashboard sections
- **Webhooks** — outbound event notifications for client, report, and monitoring lifecycle events
- **CSV Import/Export** — bulk client management via CSV with template download and conflict detection
- **Activity & Email Logs** — persistent Appwrite-backed logging of all background sync events and email send history
- **Background sync** — automated PSI snapshots and analytics data synced every 12 hours, weekly HubSpot resync, hourly email job

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4 |
| Routing | React Router 7 |
| Charts | Recharts |
| Maps | React Simple Maps |
| Animations | Motion |
| PDF | jsPDF |
| Icons | Lucide React |
| Backend | Node.js, Express 4 |
| Database | Appwrite (BaaS) |
| AI | Anthropic Claude (via API) |
| Email | Nodemailer + Postmark SMTP |
| Date handling | date-fns, date-fns-tz (Australia/Melbourne) |
| Real-time | Socket.IO Client (Uptime Kuma) |

---

## Project Structure

```
stoke-web-reporter/
├── server.ts                   # Express backend — all API routes + background jobs
├── vite.config.ts              # Vite build configuration
├── index.html                  # HTML entry point
├── package.json
├── .env                        # Environment variables (see setup below)
├── src/
│   ├── main.tsx                # React entry point
│   ├── App.tsx                 # Client-side router
│   ├── db.ts                   # Appwrite database client + all DB operations
│   ├── index.css               # Global styles
│   ├── api/
│   │   ├── google.ts           # GA4, GSC, PSI API wrappers
│   │   ├── hubspot.ts          # HubSpot CRM integration + date computation
│   │   ├── mainwp.ts           # MainWP WordPress API
│   │   ├── uptimeKuma.ts       # Uptime Kuma Socket.IO client
│   │   ├── email.ts            # HTML email template + Postmark SMTP sender
│   │   └── webhooks.ts         # Outbound webhook dispatcher
│   ├── components/
│   │   └── Logo.tsx            # Stoke Design SVG logo
│   └── pages/
│       ├── Admin.tsx           # Client manager (CRUD, HubSpot sync, send reports)
│       ├── Settings.tsx        # Global settings, CSV import/export, webhook config
│       └── ClientDashboard.tsx # Client-facing performance dashboard + PDF export
└── public/
    └── logo-white.png          # White logo for email header
```

---

## Prerequisites

- Node.js v18+
- An [Appwrite](https://appwrite.io) instance (self-hosted or cloud)
- A Google Cloud project with the following APIs enabled:
  - Google Analytics Data API
  - Google Analytics Admin API
  - Google Search Console API
  - PageSpeed Insights API
- A Google Service Account with access to the above APIs
- A [Postmark](https://postmarkapp.com) account for transactional email (optional — only needed for automated reports)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root with the following:

```env
# Appwrite
APPWRITE_ENDPOINT=https://your-appwrite-instance/v1
APPWRITE_PROJECT_ID=your_project_id
APPWRITE_API_KEY=your_api_key
APPWRITE_DATABASE_ID=your_database_id
APPWRITE_COLLECTION_CLIENTS=clients
APPWRITE_COLLECTION_SETTINGS=settings
APPWRITE_COLLECTION_PSI_SNAPSHOTS=psi_snapshots
APPWRITE_COLLECTION_GA_METRICS=ga_metrics
APPWRITE_COLLECTION_GSC_METRICS=gsc_metrics
APPWRITE_COLLECTION_EMAIL_LOGS=email_logs
APPWRITE_COLLECTION_ACTIVITY_LOGS=activity_logs

# Optional — fallback base URL for report links in emails
# If unset, defaults to https://reports.stokedesign.co
APP_BASE_URL=https://reports.stokedesign.co
```

### 3. Create Appwrite collections

Create the following collections in your Appwrite database. Attribute names must match exactly.

#### `clients`
| Attribute | Type | Notes |
|---|---|---|
| `name` | String | Required |
| `slug` | String | Required, unique |
| `client_id_number` | String | Optional |
| `website_url` | String | Optional |
| `enabled_pages` | String | JSON array of page IDs, e.g. `[1,2,3,4,5,6,7,8,9]` |
| `ga_property_id` | String | GA4 property ID |
| `gsc_site_url` | String | Full site URL (use `sc-domain:` prefix for domain properties) |
| `psi_url` | String | URL to test with PageSpeed Insights |
| `uptime_kuma_slug` | String | Monitor slug from Uptime Kuma |
| `mainwp_site_id` | String | Site ID from MainWP |
| `bq_project_id` | String | BigQuery project (optional) |
| `bq_dataset_id` | String | BigQuery dataset (optional) |
| `bq_table_id` | String | BigQuery table (optional) |
| `care_plan` | String | HubSpot-synced care plan label |
| `contact_email` | String | Recipient email for reports (synced from HubSpot contact) |
| `first_name` | String | Contact first name (synced from HubSpot contact) |
| `last_name` | String | Contact last name (synced from HubSpot contact) |
| `next_send_date` | String | Next scheduled email date (`YYYY-MM-DD`) |
| `hubspot_record_id` | String | HubSpot subscription object ID (for deep links) |
| `email_notifications` | Boolean | Whether automated monthly emails are enabled |
| `is_active` | Boolean | Whether client is active |
| `report_cache` | String | JSON blob — cached AI report overview |

#### `settings`
| Attribute | Type | Notes |
|---|---|---|
| `key` | String | Setting key (used as document ID) |
| `value` | String | Setting value |

#### `psi_snapshots`
| Attribute | Type | Notes |
|---|---|---|
| `client_id` | String | References `clients.$id` |
| `strategy` | String | `mobile` or `desktop` |
| `data` | String | JSON blob of PSI result |

#### `ga_metrics`
| Attribute | Type | Notes |
|---|---|---|
| `client_id` | String | |
| `date` | String | `YYYY-MM-DD` |
| `active_users` | Integer | |
| `sessions` | Integer | |
| `screen_page_views` | Integer | |

#### `gsc_metrics`
| Attribute | Type | Notes |
|---|---|---|
| `client_id` | String | |
| `date` | String | `YYYY-MM-DD` |
| `clicks` | Integer | |
| `impressions` | Integer | |
| `ctr` | Float | |
| `position` | Float | |

#### `email_logs`
| Attribute | Type | Notes |
|---|---|---|
| `client_id` | String | |
| `client_name` | String | |
| `website_url` | String | |
| `recipient_email` | String | |
| `subject` | String | |
| `status` | String | `sent` or `failed` |
| `error` | String | Error message (null on success) |

#### `activity_logs`
| Attribute | Type | Notes |
|---|---|---|
| `type` | String | `psi`, `ga`, `gsc`, `hubspot`, `email`, `mainwp`, `system` |
| `status` | String | `success`, `error`, `info`, `warn` |
| `message` | String | Human-readable log message |
| `client` | String | Client name (optional) |

### 4. Configure in-app settings

Start the app and navigate to `/admin/settings` to configure:

| Setting | Description |
|---|---|
| **Google Service Account JSON** | Full JSON key file for a Google Service Account. The account must be added as a Viewer on each GA4 property and GSC site. |
| **Google API Key** | API key for the PageSpeed Insights API (does not require OAuth). |
| **Anthropic API Key** | API key for Claude report generation. |
| **GTM Container ID** | Google Tag Manager container ID (e.g. `GTM-XXXXXX`), injected on all client dashboard pages. |
| **Uptime Kuma URL** | Base URL of your Uptime Kuma instance (e.g. `https://status.example.com`). |
| **Uptime Kuma Username / Password** | Credentials for Uptime Kuma Socket.IO authentication. |
| **HubSpot Access Token** | Private app token for reading the Subscriptions CRM object (type 0-69). |
| **MainWP URL** | URL of your MainWP dashboard (e.g. `https://wp.example.com`). |
| **MainWP API Key** | API key generated in MainWP → REST API. |
| **Postmark Server Token** | Server token for Postmark SMTP transactional email. |
| **SMTP From Email** | Sender address for report emails. |
| **SMTP From Name** | Sender display name (defaults to "Stoke Design"). |
| **SMTP Reply-To** | Reply-to address for report emails. |
| **Daily Send Time** | Hour of day (0–23) for automated email dispatch (Australia/Melbourne timezone, default 9 AM). |
| **Webhook URL** | Endpoint to receive outbound webhook events. |
| **Webhook Secret** | Used to HMAC-sign outbound webhook payloads. |
| **Webhook Inbound Token** | Token for validating inbound webhooks at `POST /api/webhook`. |
| **Global Notification** | Alert banner displayed on all client dashboards. |

---

## Running Locally

```bash
# Development — hot reload for both client and server
npm run dev

# Production build
npm run build

# Serve production build
npm start

# Type check
npm run lint
```

The app runs on **http://localhost:3000** by default.

---

## Background Jobs

Four background jobs run automatically on startup and repeat on schedule:

| Job | Interval | Description |
|---|---|---|
| **PSI Sync** | Every 12 hours | Fetches and stores PageSpeed Insights snapshots for all active clients. Skips if a recent snapshot exists (24-hour per-strategy check). Includes 10s quota throttling between requests. |
| **Analytics Sync** | Every 12 hours | Fetches and stores GA4 and GSC daily aggregate metrics for all active clients. 1s throttle between API calls. |
| **Monthly Email Job** | Every 1 hour | Checks if the current Melbourne hour matches the configured `report_send_hour`. If so, sends AI-generated report emails to clients whose `next_send_date` matches today. Logs all sends/failures to `email_logs`. Advances `next_send_date` by one month after sending. |
| **Weekly HubSpot Resync** | Every Sunday at 9 AM | Syncs all active clients with HubSpot Subscriptions — pushes report URL, pulls care plan, contact info, and computes next send date. |

All date/time comparisons use **Australia/Melbourne** timezone.

---

## Routes

### Frontend (React Router)

| Path | Page |
|---|---|
| `/admin` | Client manager — list, create, edit, delete clients; email log; activity log |
| `/admin/settings` | Settings — API credentials, email config, CSV import/export, webhook config |
| `/:slug` | Client-facing performance dashboard |

### Backend API (Express)

#### Admin endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/settings` | Read all settings |
| `POST` | `/api/admin/settings` | Write settings |
| `GET` | `/api/admin/google/ga-properties` | List accessible GA4 properties |
| `GET` | `/api/admin/google/gsc-sites` | List accessible GSC sites |
| `GET` | `/api/admin/clients` | List all clients |
| `POST` | `/api/admin/clients` | Create a client |
| `PUT` | `/api/admin/clients/:id` | Update a client |
| `DELETE` | `/api/admin/clients/:id` | Delete a client |
| `POST` | `/api/admin/clients/:id/hubspot-sync` | Sync one client from HubSpot |
| `POST` | `/api/admin/hubspot-sync-all` | Sync all clients from HubSpot |
| `POST` | `/api/admin/clients/:id/send-test-email` | Send an immediate report email to the client |
| `POST` | `/api/admin/test-smtp` | Verify Postmark SMTP configuration |
| `GET` | `/api/admin/activity-logs` | Fetch activity log entries |
| `GET` | `/api/admin/email-logs` | Fetch email log history |
| `GET` | `/api/admin/email-logs/:clientId` | Fetch email logs for a specific client |

#### Client dashboard endpoints

| Method | Path | Query params | Description |
|---|---|---|---|
| `GET` | `/api/client/:slug` | — | Client metadata |
| `GET` | `/api/client/:slug/ga` | `startDate`, `endDate`, `reportType` | GA4 metrics |
| `GET` | `/api/client/:slug/gsc` | `startDate`, `endDate`, `reportType` | GSC metrics |
| `GET` | `/api/client/:slug/psi` | `strategy` | Latest PSI snapshot |
| `GET` | `/api/client/:slug/psi/history` | `strategy`, `limit` | PSI snapshot history |
| `GET` | `/api/client/:slug/uptime` | — | Uptime Kuma monitor data |
| `GET` | `/api/client/:slug/mainwp` | — | MainWP site data |
| `GET` | `/api/client/:slug/hubspot` | — | HubSpot subscription data |
| `GET` | `/api/client/:slug/report-overview` | `startDate`, `endDate` | AI-generated report summary |

**GA `reportType` values:** `overview`, `overview_comparison`, `countries`, `traffic_sources`, `pages`, `landing_pages`, `events`

**GSC `reportType` values:** *(default)* daily aggregate, `queries`, `devices`

#### Public endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/config` | Returns GTM container ID for frontend injection |
| `POST` | `/api/webhook` | Inbound webhook receiver |

---

## Client Dashboard Pages

Each client has an `enabled_pages` array that controls which sections are visible. Pages are referenced by integer ID.

| ID | Page | Data Source |
|---|---|---|
| 0 | AI Insights Overview | Anthropic Claude |
| 1 | Report Overview | Anthropic Claude |
| 2 | Website Analytics | Google Analytics 4 |
| 3 | Traffic Sources | Google Analytics 4 |
| 4 | Pages & Landing Pages | Google Analytics 4 |
| 5 | Events | Google Analytics 4 |
| 6 | Search Performance | Google Search Console |
| 7 | PageSpeed Insights | Google PageSpeed Insights |
| 8 | Uptime Monitoring | Uptime Kuma |
| 9 | WordPress Health | MainWP |

---

## Email Reports

### Automated Monthly Emails

When a client has `email_notifications` enabled and a valid `contact_email` and `next_send_date`, the system sends a monthly HTML report email via Postmark SMTP. The email includes:

- Stoke Design branded header with hosted logo
- AI-generated performance summary personalised with the contact's first name
- CTA button linking to the client's live dashboard
- Contact details for the Stoke team
- Legal disclaimer footer

The send hour is configurable in Settings (default 9 AM AEST/AEDT). After sending, the `next_send_date` advances by one month.

### Send Report Now

Admins can send an ad-hoc report for the last 30 days to any client from the client edit modal. This bypasses the `next_send_date` schedule.

### HubSpot Date Sync

The `next_send_date` is computed from HubSpot subscription data using this fallback chain:
1. `start_date` (custom property, if present)
2. `next_review_date` (preferred — gives the intended day-of-month)
3. `hs_createdate` (record creation date — last resort)

The day-of-month is extracted and the next occurrence of that day is calculated relative to today (Melbourne timezone).

---

## PDF Export

The client dashboard includes a **Download Report** button that generates a programmatic PDF using jsPDF (no screenshots or browser rendering). The PDF includes:

- **Cover page** — client name, date range, and Stoke Design branding
- **One section per active page** — data drawn directly from live API responses
- Tables capped at 10 rows with a "Showing top 10 of N" indicator where truncated
- Page footer on every content page showing client name, date range, and page number

---

## CSV Import / Export

Accessible from **Settings → Client Management**:

- **Export Clients** — downloads all clients as a CSV file
- **Download Template** — downloads an empty CSV with all column headers (required fields marked)
- **Import CSV** — upload a CSV to create new clients or update existing ones (matched by slug, with conflict resolution)

All client fields are included in the CSV: `client_id_number`, `name` (required), `slug`, `website_url`, `enabled_pages`, `ga_property_id`, `gsc_site_url`, `psi_url`, `uptime_kuma_slug`, `mainwp_site_id`, `care_plan`, `contact_email`, `first_name`, `last_name`, `next_send_date`, `hubspot_record_id`, `email_notifications`, `is_active`.

---

## Webhooks

Outbound webhooks fire on the following events (configurable in Settings):

| Event | Trigger |
|---|---|
| `client.created` | A new client is added |
| `client.updated` | A client record is modified |
| `psi.completed` | A PageSpeed snapshot is saved |
| `uptime.alert` | An Uptime Kuma alert is received |
| `report.viewed` | A client views their report |
| `report.emailed` | A report email is sent (manual or automated) |

Payloads are signed using the configured webhook secret via HMAC. Inbound webhooks are received at `POST /api/webhook` and validated against the `webhook_inbound_token` setting.

---

## HubSpot Integration

The app integrates with HubSpot's built-in Subscriptions object (type ID `0-69`) using a Private App Bearer token.

- **Matching** — subscription records are matched to clients by `website_url`
- **Sync pulls** — care plan, contact email, first/last name, and subscription dates
- **Sync pushes** — the client's report dashboard URL is written to the `report_url` property
- **View in HubSpot** — after syncing, a deep link button appears in the admin edit modal
- **Weekly resync** — all clients are automatically resynced every Sunday at 9 AM

---

## Google Service Account Setup

1. Create a Service Account in [Google Cloud Console](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Enable the following APIs in your Google Cloud project:
   - Google Analytics Data API
   - Google Analytics Admin API
   - Google Search Console API
   - PageSpeed Insights API
3. Download the JSON key file and paste the contents into **Settings → Google Service Account JSON**
4. For each GA4 property: go to **GA4 → Admin → Property Access Management** and add the service account email as a **Viewer**
5. For each GSC site: go to **Search Console → Settings → Users and permissions** and add the service account email

---

## Deployment

The app is a standard Node.js + Express application serving a built React SPA.

```bash
npm run build
npm start
```

It can be deployed to any Node.js hosting environment — Render, Railway, Heroku, AWS, DigitalOcean, Docker, etc. All environment variables must be set in the hosting environment.

**Recommended production setup:**
- Reverse proxy (nginx or Caddy) in front of the Node.js process
- Process manager (PM2 or systemd) for auto-restart
- HTTPS termination at the reverse proxy
- `APP_BASE_URL` set to the production domain (e.g. `https://reports.stokedesign.co`)

---

## License

Private — Stoke Design internal tooling.
