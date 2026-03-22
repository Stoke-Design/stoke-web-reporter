import express from 'express';
import path from 'path';
import { getClients, getClientById, getClientBySlug, createClient, updateClient, deleteClient, setClientCarePlan, setClientEmailFields, getSetting, setSetting, getLatestPSISnapshot, savePSISnapshot, saveGAMetrics, saveGSCMetrics, getGAMetrics, getGSCMetrics, getPSISnapshots, getClientReportCache, setClientReportCache, clearClientReportCache, saveEmailLog, getEmailLogs, getEmailLogsByClient, saveActivityLog, getActivityLogs } from './src/db.js';
import { fetchGAData, fetchGSCData, fetchPSIData, slimPSIData, listGASites, listGSCSites } from './src/api/google.js';
import { getUptimeKumaData, clearUptimeKumaCache } from './src/api/uptimeKuma.js';
import { getMainWPSiteData } from './src/api/mainwp.js';
import { getHubSpotSubscriptionByUrl, pushReporterUrlToHubSpot, getHubSpotContactForSubscription, computeNextSendDate, advanceNextSendDate } from './src/api/hubspot.js';
import { fireWebhook } from './src/api/webhooks.js';
import { buildMonthlyReportEmail, sendEmail } from './src/api/email.js';
import { format, subDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// ── Activity Log ───────────────────────────────────────────────────────────────
// Persists to Appwrite (collection: activity_logs) fire-and-forget.
// Also mirrors to a small in-memory ring-buffer so the UI responds instantly
// even before the Appwrite write completes.
const MAX_LOG_ENTRIES = 200;
interface ActivityEntry {
  id: string;
  timestamp: string;
  type: 'psi' | 'ga' | 'gsc' | 'hubspot' | 'email' | 'mainwp' | 'system';
  status: 'success' | 'error' | 'info' | 'warn';
  message: string;
  client?: string;
}
const activityLogCache: ActivityEntry[] = [];

function addLog(
  type: ActivityEntry['type'],
  status: ActivityEntry['status'],
  message: string,
  client?: string
) {
  // Mirror to in-memory cache for instant UI reads
  const entry: ActivityEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    type,
    status,
    message,
    ...(client ? { client } : {}),
  };
  activityLogCache.unshift(entry);
  if (activityLogCache.length > MAX_LOG_ENTRIES) activityLogCache.splice(MAX_LOG_ENTRIES);

  // Persist to Appwrite — fire-and-forget, never blocks the calling job
  saveActivityLog({
    type,
    status,
    message,
    client_name: client ?? null,
  }).catch(e => console.warn('[ActivityLog] Appwrite write failed:', e.message));
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const APP_BASE_URL = process.env.APP_BASE_URL || 'https://reports.stokedesign.co';

  // --- Background Job for PSI ---
  let isPSIRunning = false;
  const runPSISnapshotJob = async () => {
    if (isPSIRunning) return;
    isPSIRunning = true;

    try {
      console.log('Starting PSI Snapshot Job...');

      // Check if we ran recently (within 12 hours) to avoid quota issues on server restarts
      const lastRun = await getSetting('last_psi_run');
      if (lastRun) {
        const lastRunDate = new Date(lastRun);
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
        if (lastRunDate > twelveHoursAgo) {
          console.log('PSI Snapshot Job skipped - ran within the last 12 hours.');
          addLog('psi', 'info', 'PSI job skipped — ran within the last 12 hours');
          return;
        }
      }

      addLog('psi', 'info', 'PSI snapshot job started');
      const clients = await getClients();
      let psiOk = 0, psiSkip = 0, psiErr = 0;

      for (const client of clients) {
        if (!client.psi_url || client.is_active === 0) continue;

        const strategies = ['mobile', 'desktop'] as const;

        for (const strategy of strategies) {
          try {
            // Check for existing snapshot from the last 24 hours
            const latest = await getLatestPSISnapshot(client.id, strategy);
            if (latest) {
              const snapshotDate = new Date(latest.created_at);
              const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
              if (snapshotDate > twentyFourHoursAgo) {
                console.log(`Skipping PSI for ${client.name} (${strategy}) - recent snapshot exists.`);
                psiSkip++;
                continue;
              }
            }

            console.log(`Fetching PSI for ${client.name} (${strategy})...`);
            const data = await fetchPSIData(client.psi_url, strategy);
            await savePSISnapshot(client.id, strategy, slimPSIData(data));
            console.log(`Saved PSI snapshot for ${client.name} (${strategy})`);
            addLog('psi', 'success', `PSI snapshot saved (${strategy})`, client.name);
            psiOk++;

            // Throttle: wait 10 seconds between PSI requests to avoid hitting rate limits
            await new Promise(resolve => setTimeout(resolve, 10000));
          } catch (error: any) {
            console.error(`Failed to fetch/save PSI for ${client.name} (${strategy}):`, error.message);
            addLog('psi', 'error', `PSI failed (${strategy}): ${error.message}`, client.name);
            psiErr++;
            // If we hit quota, stop the job for now to avoid further errors
            if (error.message.toLowerCase().includes('quota exceeded')) {
              console.warn('PSI Quota exceeded, stopping job.');
              addLog('psi', 'warn', 'PSI job stopped — API quota exceeded');
              return;
            }
          }
        }
      }

      await setSetting('last_psi_run', new Date().toISOString());
      console.log('PSI Snapshot Job Completed.');
      addLog('psi', 'success', `PSI job completed — ${psiOk} saved, ${psiSkip} skipped, ${psiErr} errors`);
    } catch (error: any) {
      console.error('Error in PSI Snapshot Job:', error);
      addLog('psi', 'error', `PSI job failed: ${error.message}`);
    } finally {
      isPSIRunning = false;
    }
  };

  // --- Background Job for GA/GSC Sync ---
  const runAnalyticsSyncJob = async () => {
    console.log('Starting Analytics Sync Job...');
    addLog('system', 'info', 'Analytics sync job started');
    try {
      const clients = await getClients();

      const startDate = format(subDays(new Date(), 7), 'yyyy-MM-dd');
      const endDate = 'today';

      let gaOk = 0, gaErr = 0, gscOk = 0, gscErr = 0;

      for (const client of clients) {
        if (client.is_active === 0) continue;

        // Sync GA
        if (client.ga_property_id) {
          try {
            console.log(`Syncing GA for ${client.name}...`);
            const gaData = await fetchGAData(client.ga_property_id, startDate, endDate);
            if (gaData.rows) {
              for (const row of gaData.rows) {
                const date = row.dimensionValues[0].value; // YYYYMMDD
                const formattedDate = `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
                await saveGAMetrics(client.id, formattedDate, {
                  activeUsers: parseInt(row.metricValues[0].value, 10),
                  sessions: parseInt(row.metricValues[1].value, 10),
                  screenPageViews: parseInt(row.metricValues[2].value, 10),
                });
              }
            }
            console.log(`Synced GA for ${client.name}`);
            addLog('ga', 'success', `GA synced (last 7 days)`, client.name);
            gaOk++;
          } catch (error: any) {
            console.error(`Failed to sync GA for ${client.name}:`, error.message);
            addLog('ga', 'error', `GA sync failed: ${error.message}`, client.name);
            gaErr++;
          }
        }

        // Sync GSC
        if (client.gsc_site_url) {
          try {
            console.log(`Syncing GSC for ${client.name}...`);
            const gscData = await fetchGSCData(client.gsc_site_url, startDate, format(new Date(), 'yyyy-MM-dd'));
            if (gscData.rows) {
              for (const row of gscData.rows) {
                const date = row.keys[0];
                await saveGSCMetrics(client.id, date, {
                  clicks: row.clicks,
                  impressions: row.impressions,
                  ctr: row.ctr,
                  position: row.position,
                });
              }
            }
            console.log(`Synced GSC for ${client.name}`);
            addLog('gsc', 'success', `GSC synced (last 7 days)`, client.name);
            gscOk++;

            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error: any) {
            console.error(`Failed to sync GSC for ${client.name}:`, error.message);
            addLog('gsc', 'error', `GSC sync failed: ${error.message}`, client.name);
            gscErr++;
          }
        }
      }
      console.log('Analytics Sync Job Completed.');
      addLog('system', 'success', `Analytics sync complete — GA: ${gaOk} ok/${gaErr} err · GSC: ${gscOk} ok/${gscErr} err`);
    } catch (error: any) {
      console.error('Error in Analytics Sync Job:', error);
      addLog('system', 'error', `Analytics sync job failed: ${error.message}`);
    }
  };

  // Run immediately on startup (optional, but good for dev/demo)
  // In production, you might want to check if a recent snapshot exists first to avoid quota issues on restart.
  // For now, let's run it if no snapshots exist or just rely on the interval.
  // Let's set an interval for 12 hours.
  const TWELVE_HOURS = 12 * 60 * 60 * 1000;
  setInterval(runPSISnapshotJob, TWELVE_HOURS);
  setInterval(runAnalyticsSyncJob, TWELVE_HOURS); // Sync analytics every 12h too
  
  // Also run it 10 seconds after startup to ensure data is populated if empty
  setTimeout(() => {
    runPSISnapshotJob();
    runAnalyticsSyncJob();
  }, 10000);

  // --- Background Job: Monthly Email Notifications ---
  // Runs every hour; checks configured send-hour before processing.
  let isEmailJobRunning = false;
  const runMonthlyEmailJob = async () => {
    if (isEmailJobRunning) { console.log('[EmailJob] Already running, skipping'); return; }
    isEmailJobRunning = true;
    try {
      const melbNow = toZonedTime(new Date(), 'Australia/Melbourne');
      const currentHour = melbNow.getHours();
      const sendHour = parseInt((await getSetting('report_send_hour')) || '9', 10);
      console.log(`[EmailJob] Checking — Melbourne hour: ${currentHour}, configured send hour: ${sendHour}`);
      if (currentHour !== sendHour) {
        console.log(`[EmailJob] Hour mismatch (${currentHour} ≠ ${sendHour}), skipping`);
        return;
      }

      const today = `${melbNow.getFullYear()}-${String(melbNow.getMonth() + 1).padStart(2, '0')}-${String(melbNow.getDate()).padStart(2, '0')}`;
      console.log(`[EmailJob] Hour matched! Today is ${today}, checking clients...`);
      const clients = await getClients();
      const serverToken = await getSetting('postmark_server_token');
      const fromEmail   = await getSetting('smtp_from_email');
      const fromName    = (await getSetting('smtp_from_name')) || 'Stoke Design';
      const replyTo     = (await getSetting('smtp_reply_to')) || undefined;

      if (!serverToken || !fromEmail) {
        console.log('[EmailJob] Skipped — Postmark SMTP not configured');
        addLog('email', 'warn', 'Monthly email job skipped — Postmark SMTP not configured in Settings');
        return;
      }

      let emailsSent = 0, emailsFailed = 0;

      for (const client of clients) {
        if (!client.is_active) { console.log(`[EmailJob] ${client.name}: skipped (inactive)`); continue; }
        if (!client.contact_email) { console.log(`[EmailJob] ${client.name}: skipped (no contact_email)`); continue; }
        if (client.email_notifications === 0) { console.log(`[EmailJob] ${client.name}: skipped (notifications disabled)`); continue; }
        if (client.next_send_date !== today) { console.log(`[EmailJob] ${client.name}: skipped (next_send_date=${client.next_send_date} ≠ ${today})`); continue; }

        console.log(`[EmailJob] ${client.name}: ELIGIBLE — sending to ${client.contact_email}...`);

        const month = format(new Date(), 'MMMM yyyy');
        let reportSummary = '';
        try {
          const report = await generateReportOverview(client);
          reportSummary = report?.summary || '';
        } catch { /* proceed without summary */ }

        const dashboardUrl = `${APP_BASE_URL}/${client.slug}`;
        const { subject, html } = buildMonthlyReportEmail({
          firstName:    client.first_name || client.name,
          clientName:   client.name,
          dashboardUrl,
          month,
          reportSummary,
        });

        try {
          await sendEmail({ to: client.contact_email, subject, html, serverToken, fromEmail, fromName, replyTo });
          await saveEmailLog({
            client_id: client.id, client_name: client.name,
            website_url: client.website_url, recipient_email: client.contact_email,
            subject, status: 'sent', error: null,
          });
          // Advance next_send_date by one month
          await setClientEmailFields(client.id, { next_send_date: advanceNextSendDate(today) });
          console.log(`[EmailJob] ✓ Sent monthly report to ${client.contact_email} for ${client.name}`);
          addLog('email', 'success', `Monthly report sent to ${client.contact_email}`, client.name);
          // Fire report.emailed webhook
          Promise.all([getSetting('webhook_url'), getSetting('webhook_secret'), getSetting('webhook_events_enabled')])
            .then(([url, secret, events]) => {
              if (url) fireWebhook(url, secret || '', events || '[]', 'report.emailed', {
                slug: client.slug, name: client.name, sentTo: client.contact_email, trigger: 'automated',
              });
            }).catch(() => {});
          emailsSent++;
        } catch (err: any) {
          await saveEmailLog({
            client_id: client.id, client_name: client.name,
            website_url: client.website_url, recipient_email: client.contact_email,
            subject, status: 'failed', error: err.message,
          });
          console.error(`[EmailJob] ✗ Failed to send to ${client.contact_email}:`, err.message);
          addLog('email', 'error', `Monthly report failed: ${err.message}`, client.name);
          emailsFailed++;
        }
      }

      if (emailsSent + emailsFailed > 0) {
        console.log(`[EmailJob] Complete — ${emailsSent} sent, ${emailsFailed} failed`);
        addLog('email', emailsFailed > 0 ? 'warn' : 'success', `Monthly email job complete — ${emailsSent} sent, ${emailsFailed} failed`);
      } else {
        console.log('[EmailJob] No eligible clients found for today');
      }
    } catch (err: any) {
      console.error('[EmailJob] Job error:', err.message);
      addLog('email', 'error', `Monthly email job error: ${err.message}`);
    } finally {
      isEmailJobRunning = false;
    }
  };

  const FIFTEEN_MIN = 15 * 60 * 1000;
  setInterval(runMonthlyEmailJob, FIFTEEN_MIN);
  setTimeout(runMonthlyEmailJob, 15000);
  console.log('[EmailJob] Registered — will check in 15s then every 15min');

  // ── Weekly HubSpot resync — every Sunday at 9:00 am ──────────────────────────
  const runWeeklyHubSpotSync = async () => {
    console.log('[WeeklySync] Starting weekly HubSpot resync...');
    addLog('hubspot', 'info', 'Weekly HubSpot resync started');
    try {
      const [accessToken, legacyKey] = await Promise.all([
        getSetting('hubspot_access_token'),
        getSetting('hubspot_api_key'),
      ]);
      const token = accessToken || legacyKey || '';
      if (!token) {
        console.log('[WeeklySync] No HubSpot token configured — skipping');
        addLog('hubspot', 'warn', 'Weekly HubSpot resync skipped — no token configured');
        return;
      }

      const clients = await getClients();
      let synced = 0, skipped = 0, errors = 0;

      for (const client of clients) {
        if (!client.website_url) { skipped++; continue; }
        try {
          const sub = await getHubSpotSubscriptionByUrl(token, client.website_url);
          if (!sub) { skipped++; continue; }

          // Push reporter URL → HubSpot (fire-and-forget)
          pushReporterUrlToHubSpot(token, sub.recordId, `${APP_BASE_URL}/${client.slug}`)
            .catch(e => console.warn(`[WeeklySync] Push URL failed for ${client.name}:`, e.message));

          // Pull care_plan
          if (sub.carePlan !== undefined) {
            await setClientCarePlan(client.id, sub.carePlan);
          }

          // Pull email fields + contact name
          const emailFields: Parameters<typeof setClientEmailFields>[1] = {};
          emailFields.hubspot_record_id = sub.recordId;
          const dateSource = sub.startDate || sub.nextReviewDate || sub.createDate; // nextReviewDate used as day-of-month source if start_date absent
          if (dateSource) emailFields.next_send_date = computeNextSendDate(dateSource);
          const contact = await getHubSpotContactForSubscription(token, sub.recordId);
          if (contact.email)         emailFields.contact_email = contact.email;
          else if (sub.contactEmail) emailFields.contact_email = sub.contactEmail;
          if (contact.firstName) emailFields.first_name = contact.firstName;
          if (contact.lastName)  emailFields.last_name  = contact.lastName;
          if (Object.keys(emailFields).length > 0) {
            await setClientEmailFields(client.id, emailFields);
          }

          console.log(`[WeeklySync] Synced ${client.name}: nextSend=${emailFields.next_send_date}, email=${emailFields.contact_email}`);
          addLog('hubspot', 'success', `Synced — care plan: ${sub.carePlan || '—'}, next send: ${emailFields.next_send_date || '—'}`, client.name);
          synced++;
        } catch (err: any) {
          console.warn(`[WeeklySync] Error syncing ${client.name}:`, err.message);
          addLog('hubspot', 'error', `HubSpot sync failed: ${err.message}`, client.name);
          errors++;
        }
      }

      console.log(`[WeeklySync] Done — ${synced} synced, ${skipped} skipped, ${errors} errors`);
      addLog('hubspot', synced > 0 || errors === 0 ? 'success' : 'warn', `Weekly HubSpot resync complete — ${synced} synced, ${skipped} skipped, ${errors} errors`);
    } catch (err: any) {
      console.error('[WeeklySync] Fatal error:', err.message);
      addLog('hubspot', 'error', `Weekly HubSpot resync failed: ${err.message}`);
    }
  };

  // Schedule first run at the next Sunday 9:00 am, then repeat every 7 days
  const scheduleWeeklySync = () => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(9, 0, 0, 0);
    const day = now.getDay(); // 0 = Sunday
    const daysUntilSunday = day === 0
      ? (now.getHours() < 9 ? 0 : 7)   // today is Sunday: run today if before 9am, else next Sunday
      : (7 - day);                        // days until next Sunday
    next.setDate(now.getDate() + daysUntilSunday);
    const msUntilFirst = next.getTime() - now.getTime();
    setTimeout(() => {
      runWeeklyHubSpotSync();
      setInterval(runWeeklyHubSpotSync, 7 * 24 * 60 * 60 * 1000);
    }, msUntilFirst);
    console.log(`[WeeklySync] First run scheduled for ${next.toLocaleString()} (in ${Math.round(msUntilFirst / 3600000)}h)`);
  };
  scheduleWeeklySync();

  app.use(express.json());

  // Auth middleware — validates Appwrite JWT via server-side SDK
  const requireAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const authHeader = req.headers.authorization || '';
      const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

      if (!jwt) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Create a JWT-scoped Appwrite client to verify the token is valid
      const { Client: AWClient, Account: AWAccount } = await import('node-appwrite');
      const jwtClient = new AWClient()
        .setEndpoint(process.env.APPWRITE_ENDPOINT || '')
        .setProject(process.env.APPWRITE_PROJECT_ID || '')
        .setJWT(jwt);
      const account = new AWAccount(jwtClient);
      await account.get(); // throws if JWT is invalid or expired
      next();
    } catch (err: any) {
      console.warn('[requireAdmin] JWT validation failed:', err.message);
      return res.status(401).json({ error: 'Not authenticated' });
    }
  };

  // --- API Routes ---

  // Admin: Get settings
  app.get('/api/admin/settings', requireAdmin, async (req, res) => {
    try {
      const googleServiceAccountJson = await getSetting('google_service_account_json') || '';
      const googleApiKey = await getSetting('google_api_key') || '';
      const globalNotification = await getSetting('global_notification') || '';
      const globalNotificationIcon = await getSetting('global_notification_icon') || 'AlertCircle';
      const globalNotificationColor = await getSetting('global_notification_color') || 'red';
      const gtmContainerId = await getSetting('gtm_container_id') || '';
      const anthropicApiKey = await getSetting('anthropic_api_key') || '';
      const uptimeKumaUrl      = await getSetting('uptime_kuma_url')      || '';
      const uptimeKumaUsername = await getSetting('uptime_kuma_username') || '';
      const uptimeKumaPassword = await getSetting('uptime_kuma_password') || '';
      const webhookUrl           = await getSetting('webhook_url')            || '';
      const webhookSecret        = await getSetting('webhook_secret')         || '';
      const webhookInboundToken  = await getSetting('webhook_inbound_token')  || '';
      const webhookEventsEnabled = await getSetting('webhook_events_enabled') || '["client.created","client.updated","psi.completed","uptime.alert","report.viewed"]';
      const hubspotAccessToken   = await getSetting('hubspot_access_token')   || '';
      const hubspotClientSecret  = await getSetting('hubspot_client_secret')  || '';
      const mainwpUrl    = await getSetting('mainwp_url')     || '';
      const mainwpApiKey = await getSetting('mainwp_api_key') || '';
      const postmarkServerToken = await getSetting('postmark_server_token') || '';
      const smtpFromEmail       = await getSetting('smtp_from_email')       || '';
      const smtpFromName        = await getSetting('smtp_from_name')        || '';
      const smtpReplyTo         = await getSetting('smtp_reply_to')         || '';
      const reportSendHour      = await getSetting('report_send_hour')      || '9';

      res.json({
        google_service_account_json: googleServiceAccountJson,
        google_api_key: googleApiKey,
        global_notification: globalNotification,
        global_notification_icon: globalNotificationIcon,
        global_notification_color: globalNotificationColor,
        gtm_container_id: gtmContainerId,
        anthropic_api_key: anthropicApiKey,
        uptime_kuma_url: uptimeKumaUrl,
        uptime_kuma_username: uptimeKumaUsername,
        uptime_kuma_password: uptimeKumaPassword,
        webhook_url: webhookUrl,
        webhook_secret: webhookSecret,
        webhook_inbound_token: webhookInboundToken,
        webhook_events_enabled: webhookEventsEnabled,
        hubspot_access_token: hubspotAccessToken,
        hubspot_client_secret: hubspotClientSecret,
        mainwp_url: mainwpUrl,
        mainwp_api_key: mainwpApiKey,
        postmark_server_token: postmarkServerToken,
        smtp_from_email: smtpFromEmail,
        smtp_from_name: smtpFromName,
        smtp_reply_to: smtpReplyTo,
        report_send_hour: reportSendHour,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Update settings
  app.post('/api/admin/settings', requireAdmin, async (req, res) => {
    try {
      const { google_service_account_json, google_api_key, global_notification, global_notification_icon } = req.body;
      
      if (google_service_account_json !== undefined) {
        await setSetting('google_service_account_json', google_service_account_json);
      }
      
      if (google_api_key !== undefined) {
        await setSetting('google_api_key', google_api_key);
      }

      if (global_notification !== undefined) {
        await setSetting('global_notification', global_notification);
      }

      if (global_notification_icon !== undefined) {
        await setSetting('global_notification_icon', global_notification_icon);
      }

      const { global_notification_color, gtm_container_id, anthropic_api_key } = req.body;

      if (global_notification_color !== undefined) {
        await setSetting('global_notification_color', global_notification_color);
      }

      if (gtm_container_id !== undefined) {
        await setSetting('gtm_container_id', gtm_container_id);
      }

      if (anthropic_api_key !== undefined) {
        await setSetting('anthropic_api_key', anthropic_api_key);
      }

      const { uptime_kuma_url, uptime_kuma_username, uptime_kuma_password } = req.body;
      if (uptime_kuma_url !== undefined) {
        await setSetting('uptime_kuma_url', uptime_kuma_url);
        clearUptimeKumaCache();
      }
      if (uptime_kuma_username !== undefined) {
        await setSetting('uptime_kuma_username', uptime_kuma_username);
        clearUptimeKumaCache();
      }
      if (uptime_kuma_password !== undefined) {
        await setSetting('uptime_kuma_password', uptime_kuma_password);
        clearUptimeKumaCache();
      }

      const { webhook_url, webhook_secret, webhook_inbound_token, webhook_events_enabled } = req.body;
      if (webhook_url !== undefined) await setSetting('webhook_url', webhook_url);
      if (webhook_secret !== undefined) await setSetting('webhook_secret', webhook_secret);
      if (webhook_inbound_token !== undefined) await setSetting('webhook_inbound_token', webhook_inbound_token);
      if (webhook_events_enabled !== undefined) await setSetting('webhook_events_enabled', webhook_events_enabled);

      const { hubspot_access_token, hubspot_client_secret } = req.body;
      if (hubspot_access_token !== undefined) await setSetting('hubspot_access_token', hubspot_access_token);
      if (hubspot_client_secret !== undefined) await setSetting('hubspot_client_secret', hubspot_client_secret);

      const { mainwp_url, mainwp_api_key } = req.body;
      if (mainwp_url !== undefined) await setSetting('mainwp_url', mainwp_url);
      if (mainwp_api_key !== undefined) await setSetting('mainwp_api_key', mainwp_api_key);

      const { postmark_server_token, smtp_from_email, smtp_from_name, smtp_reply_to } = req.body;
      if (postmark_server_token !== undefined) await setSetting('postmark_server_token', postmark_server_token);
      if (smtp_from_email       !== undefined) await setSetting('smtp_from_email',       smtp_from_email);
      if (smtp_from_name        !== undefined) await setSetting('smtp_from_name',        smtp_from_name);
      if (smtp_reply_to         !== undefined) await setSetting('smtp_reply_to',         smtp_reply_to);

      const { report_send_hour } = req.body;
      if (report_send_hour !== undefined) await setSetting('report_send_hour', String(report_send_hour));

      res.json({ success: true });
    } catch (err: any) {
      console.error('[Settings POST] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: List GA Properties
  app.get('/api/admin/google/ga-properties', requireAdmin, async (req, res) => {
    try {
      const properties = await listGASites();
      res.json(properties);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: List GSC Sites
  app.get('/api/admin/google/gsc-sites', requireAdmin, async (req, res) => {
    try {
      const sites = await listGSCSites();
      res.json(sites);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Get all clients
  app.get('/api/admin/clients', requireAdmin, async (req, res) => {
    try {
      const clients = await getClients();
      res.json(clients);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Create client
  app.post('/api/admin/clients', requireAdmin, async (req, res) => {
    try {
      const clientData = {
        client_id_number: req.body.client_id_number || '',
        name: req.body.name || '',
        slug: req.body.slug || '',
        website_url: req.body.website_url || '',

        enabled_pages: req.body.enabled_pages || '[1,2,3,4,5,6,7]',
        ga_property_id: req.body.ga_property_id || null,
        gsc_site_url: req.body.gsc_site_url || null,
        bq_project_id: null,
        bq_dataset_id: null,
        bq_table_id: null,
        psi_url: req.body.psi_url || null,
        uptime_kuma_slug: req.body.uptime_kuma_slug || null,
        mainwp_site_id: req.body.mainwp_site_id || null,
        care_plan: null,
        contact_email: req.body.contact_email || null,
        first_name: req.body.first_name || null,
        last_name: req.body.last_name || null,
        next_send_date: null,
        hubspot_record_id: null,
        email_notifications: req.body.email_notifications !== undefined ? req.body.email_notifications : 1,
        is_active: req.body.is_active !== undefined ? req.body.is_active : 1,
      };
      const client = await createClient(clientData);

      // Save care_plan separately (it's not part of clientFields to avoid issues if Appwrite attribute is missing)
      const carePlanValue = req.body.care_plan || null;
      if (carePlanValue) {
        setClientCarePlan(client.id, carePlanValue).catch(e => console.warn('[care_plan] save failed:', e.message));
      }

      // Save email notification fields separately (same pattern as care_plan)
      const emailFields: Record<string, any> = {};
      if (req.body.contact_email !== undefined) emailFields.contact_email = req.body.contact_email || null;
      if (req.body.first_name    !== undefined) emailFields.first_name    = req.body.first_name    || null;
      if (req.body.last_name     !== undefined) emailFields.last_name     = req.body.last_name     || null;
      if (req.body.email_notifications !== undefined) emailFields.email_notifications = req.body.email_notifications !== 0 && req.body.email_notifications !== false;
      if (Object.keys(emailFields).length > 0) {
        setClientEmailFields(client.id, emailFields).catch(e => console.warn('[email_fields] save failed:', e.message));
      }

      // Fire webhook (fire-and-forget)
      Promise.all([getSetting('webhook_url'), getSetting('webhook_secret'), getSetting('webhook_events_enabled')]).then(([url, secret, events]) => {
        if (url) fireWebhook(url, secret || '', events || '[]', 'client.created', { slug: client.slug, name: client.name });
      }).catch(() => {});

      // HubSpot bidirectional sync (fire-and-forget): push report_url, pull care_plan
      if (client.website_url) {
        Promise.all([getSetting('hubspot_access_token'), getSetting('hubspot_api_key')]).then(async ([token, legacyKey]) => {
          const accessToken = token || legacyKey || '';
          if (!accessToken) return;
          const sub = await getHubSpotSubscriptionByUrl(accessToken, client.website_url!).catch(() => null);
          if (!sub?.recordId) return;
          pushReporterUrlToHubSpot(accessToken, sub.recordId, `${APP_BASE_URL}/${client.slug}`).catch(e => console.warn('[HubSpot] Push failed:', e.message));
          if (sub.carePlan !== undefined) {
            setClientCarePlan(client.id, sub.carePlan).catch(e => console.warn('[HubSpot] care_plan sync failed:', e.message));
          }
        }).catch(() => {});
      }

      res.json(client);
    } catch (err: any) {
      console.error('[Create client] Error:', err.message);
      res.status(400).json({ error: err.message });
    }
  });

  // Admin: Update client
  app.put('/api/admin/clients/:id', requireAdmin, async (req, res) => {
    try {
      const clientData = {
        client_id_number: req.body.client_id_number || '',
        name: req.body.name || '',
        slug: req.body.slug || '',
        website_url: req.body.website_url || '',

        enabled_pages: req.body.enabled_pages || '[1,2,3,4,5,6,7]',
        ga_property_id: req.body.ga_property_id || null,
        gsc_site_url: req.body.gsc_site_url || null,
        bq_project_id: null,
        bq_dataset_id: null,
        bq_table_id: null,
        psi_url: req.body.psi_url || null,
        uptime_kuma_slug: req.body.uptime_kuma_slug || null,
        mainwp_site_id: req.body.mainwp_site_id || null,
        care_plan: null,
        contact_email: req.body.contact_email || null,
        first_name: req.body.first_name || null,
        last_name: req.body.last_name || null,
        next_send_date: req.body.next_send_date || null,
        hubspot_record_id: req.body.hubspot_record_id || null,
        email_notifications: req.body.email_notifications !== undefined ? req.body.email_notifications : 1,
        is_active: req.body.is_active !== undefined ? req.body.is_active : 1,
      };
      const client = await updateClient(req.params.id, clientData);

      // Save care_plan separately
      const carePlanValue = req.body.care_plan || null;
      setClientCarePlan(req.params.id, carePlanValue).catch(e => console.warn('[care_plan] save failed:', e.message));

      // Save email notification fields separately (same pattern as care_plan)
      const emailFields: Record<string, any> = {};
      if (req.body.contact_email   !== undefined) emailFields.contact_email   = req.body.contact_email   || null;
      if (req.body.first_name      !== undefined) emailFields.first_name      = req.body.first_name      || null;
      if (req.body.last_name       !== undefined) emailFields.last_name       = req.body.last_name       || null;
      if (req.body.next_send_date  !== undefined) emailFields.next_send_date  = req.body.next_send_date  || null;
      if (req.body.email_notifications !== undefined) emailFields.email_notifications = req.body.email_notifications !== 0 && req.body.email_notifications !== false;
      if (Object.keys(emailFields).length > 0) {
        await setClientEmailFields(req.params.id, emailFields);
      }

      // Re-fetch the fully-patched document so the response includes email fields
      const updatedClient = await getClientById(req.params.id);

      // Invalidate report cache → forces fresh AI summary on next dashboard visit
      clearClientReportCache(req.params.id).catch(() => {});
      // Pre-generate fresh report in background using updated client data
      if (updatedClient) generateReportOverview(updatedClient).catch(() => {});

      // Fire webhook (fire-and-forget)
      Promise.all([getSetting('webhook_url'), getSetting('webhook_secret'), getSetting('webhook_events_enabled')]).then(([url, secret, events]) => {
        if (url) fireWebhook(url, secret || '', events || '[]', 'client.updated', { slug: client.slug, name: client.name });
      }).catch(() => {});

      // HubSpot bidirectional sync (fire-and-forget): push report_url, pull care_plan
      if (client.website_url) {
        Promise.all([getSetting('hubspot_access_token'), getSetting('hubspot_api_key')]).then(async ([token, legacyKey]) => {
          const accessToken = token || legacyKey || '';
          if (!accessToken) return;
          const sub = await getHubSpotSubscriptionByUrl(accessToken, client.website_url!).catch(() => null);
          if (!sub?.recordId) return;
          pushReporterUrlToHubSpot(accessToken, sub.recordId, `${APP_BASE_URL}/${client.slug}`).catch(e => console.warn('[HubSpot] Push failed:', e.message));
          if (sub.carePlan !== undefined) {
            setClientCarePlan(client.id, sub.carePlan).catch(e => console.warn('[HubSpot] care_plan sync failed:', e.message));
          }
        }).catch(() => {});
      }

      res.json(updatedClient || client);
    } catch (err: any) {
      console.error('[Update client] Error:', err.message);
      res.status(400).json({ error: err.message });
    }
  });

  // Admin: Delete client
  app.delete('/api/admin/clients/:id', requireAdmin, async (req, res) => {
    try {
      await deleteClient(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Public: Get client info by slug
  app.get('/api/client/:slug', async (req, res) => {
    try {
      const client = await getClientBySlug(req.params.slug);
      if (!client || client.is_active === 0) {
        return res.status(404).json({ error: 'Client not found or inactive' });
      }
      const globalNotification = await getSetting('global_notification');
      const globalNotificationIcon = await getSetting('global_notification_icon');
      const globalNotificationColor = await getSetting('global_notification_color') || 'red';
      // Fire report.viewed webhook (fire-and-forget)
      Promise.all([getSetting('webhook_url'), getSetting('webhook_secret'), getSetting('webhook_events_enabled')]).then(([url, secret, events]) => {
        if (url) fireWebhook(url, secret || '', events || '[]', 'report.viewed', { slug: client.slug, name: client.name });
      }).catch(() => {});

      res.json({
        client_id_number: client.client_id_number,
        name: client.name,
        slug: client.slug,
        website_url: client.website_url,
        enabled_pages: client.enabled_pages,
        hasGA: !!client.ga_property_id,
        hasGSC: !!client.gsc_site_url,
        hasPSI: !!client.psi_url,
        hasUptime: !!client.uptime_kuma_slug,
        hasMainWP: !!client.mainwp_site_id,
        hasHubSpot: !!client.website_url,
        care_plan: client.care_plan || null,
        global_notification: globalNotification || null,
        global_notification_icon: globalNotificationIcon || null,
        global_notification_color: globalNotificationColor,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Public: Fetch GA Data
  app.get('/api/client/:slug/ga', async (req, res) => {
    try {
      const client = await getClientBySlug(req.params.slug);
      if (!client || client.is_active === 0 || !client.ga_property_id) return res.status(404).json({ error: 'Not configured or inactive' });
      
      const { startDate = '30daysAgo', endDate = 'today', reportType = 'overview' } = req.query;
      
      let dbStartDate = '';
      let dbEndDate = '';
      
      if (startDate === '30daysAgo') dbStartDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      else if (startDate === '90daysAgo') dbStartDate = format(subDays(new Date(), 90), 'yyyy-MM-dd');
      else if (startDate === '365daysAgo') dbStartDate = format(subDays(new Date(), 365), 'yyyy-MM-dd');
      else dbStartDate = String(startDate);
      
      if (endDate === 'today') dbEndDate = format(new Date(), 'yyyy-MM-dd');
      else dbEndDate = String(endDate);

      // Helper: calculate previous period of equal length
      const calcPrevPeriod = (s: string, e: string) => {
        const start = new Date(s + 'T00:00:00Z');
        const end   = new Date(e + 'T00:00:00Z');
        const days  = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
        return {
          prevStart: format(subDays(start, days), 'yyyy-MM-dd'),
          prevEnd:   format(subDays(start, 1),    'yyyy-MM-dd'),
          days,
        };
      };

      // ── Comparison report: current + previous daily active users + total metrics ──
      if (reportType === 'overview_comparison') {
        const { prevStart, prevEnd, days } = calcPrevPeriod(dbStartDate, dbEndDate);
        const totalsMetrics = ['activeUsers', 'newUsers', 'sessions', 'screenPageViews', 'engagementRate', 'userEngagementDuration'];
        const [curDaily, prevDaily, curTotals, prevTotals] = await Promise.all([
          fetchGAData(client.ga_property_id, dbStartDate, dbEndDate, ['date'], ['activeUsers']),
          fetchGAData(client.ga_property_id, prevStart,   prevEnd,   ['date'], ['activeUsers']),
          fetchGAData(client.ga_property_id, dbStartDate, dbEndDate, [],       totalsMetrics),
          fetchGAData(client.ga_property_id, prevStart,   prevEnd,   [],       totalsMetrics),
        ]);
        return res.json({ curDaily, prevDaily, curTotals, prevTotals, prevStart, prevEnd, days });
      }

      // ── Countries report: current + previous active users by country ──
      if (reportType === 'countries') {
        const { prevStart, prevEnd } = calcPrevPeriod(dbStartDate, dbEndDate);
        const [current, previous] = await Promise.all([
          fetchGAData(client.ga_property_id, dbStartDate, dbEndDate, ['country', 'countryId'], ['activeUsers']),
          fetchGAData(client.ga_property_id, prevStart,   prevEnd,   ['country', 'countryId'], ['activeUsers']),
        ]);
        return res.json({ current, previous, prevStart, prevEnd });
      }

      // For overview, we prefer DB if available
      if (reportType === 'overview') {
        const storedMetrics = await getGAMetrics(client.id, dbStartDate, dbEndDate);
        if (storedMetrics.length > 0) {
          const rows = storedMetrics.map(m => ({
            dimensionValues: [{ value: m.date.replace(/-/g, '') }],
            metricValues: [
              { value: String(m.active_users) },
              { value: String(m.sessions) },
              { value: String(m.screen_page_views) }
            ]
          }));
          return res.json({ rows });
        }
      }

      // If not overview or no DB data, fetch live with specific dimensions/metrics
      let dimensions: string[] = ['date'];
      let metrics: string[] = ['activeUsers', 'sessions', 'screenPageViews'];

      if (reportType === 'overview_extended') {
        dimensions = [];
        metrics = ['activeUsers', 'newUsers', 'sessions', 'screenPageViews', 'averageSessionDuration', 'engagementRate', 'userEngagementDuration'];
      } else if (reportType === 'traffic_sources') {
        dimensions = ['sessionSource', 'sessionMedium'];
        metrics = ['activeUsers', 'sessions', 'engagementRate', 'conversions'];
      } else if (reportType === 'pages') {
        dimensions = ['pagePath'];
        metrics = ['screenPageViews', 'activeUsers', 'userEngagementDuration', 'bounceRate'];
      } else if (reportType === 'landing_pages') {
        dimensions = ['landingPage'];
        metrics = ['sessions', 'activeUsers', 'newUsers', 'engagementRate', 'conversions'];
      } else if (reportType === 'events') {
        dimensions = ['eventName'];
        metrics = ['eventCount', 'activeUsers'];
      }

      const data = await fetchGAData(client.ga_property_id, String(startDate), String(endDate), dimensions, metrics);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Public: Fetch GSC Data
  app.get('/api/client/:slug/gsc', async (req, res) => {
    try {
      const client = await getClientBySlug(req.params.slug);
      if (!client || client.is_active === 0 || !client.gsc_site_url) return res.status(404).json({ error: 'Not configured or inactive' });

      const { startDate = '30daysAgo', endDate = 'today', reportType = 'date' } = req.query;

      let dbStartDate = '';
      let dbEndDate = '';

      if (startDate === '30daysAgo') dbStartDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      else if (startDate === '90daysAgo') dbStartDate = format(subDays(new Date(), 90), 'yyyy-MM-dd');
      else if (startDate === '365daysAgo') dbStartDate = format(subDays(new Date(), 365), 'yyyy-MM-dd');
      else dbStartDate = String(startDate);

      if (endDate === 'today') dbEndDate = format(new Date(), 'yyyy-MM-dd');
      else dbEndDate = String(endDate);

      // Queries breakdown — live from GSC API (top 25 queries)
      if (reportType === 'queries') {
        const data = await fetchGSCData(client.gsc_site_url, dbStartDate, dbEndDate, ['query'], 25);
        return res.json(data);
      }

      // Device breakdown — live from GSC API
      if (reportType === 'devices') {
        const data = await fetchGSCData(client.gsc_site_url, dbStartDate, dbEndDate, ['device']);
        return res.json(data);
      }

      // Default: date-based — use Appwrite cache only if it covers ≥70% of the requested range
      // (GSC has a 2–3 day data delay, so a "full" range will naturally have a few missing tail days)
      const storedMetrics = await getGSCMetrics(client.id, dbStartDate, dbEndDate);

      const rangeDays = Math.round(
        (new Date(dbEndDate).getTime() - new Date(dbStartDate).getTime()) / 86400000
      ) + 1;
      const coverageThreshold = Math.floor(rangeDays * 0.7);

      if (storedMetrics.length >= coverageThreshold) {
         const rows = storedMetrics.map(m => ({
           keys: [m.date],
           clicks: m.clicks,
           impressions: m.impressions,
           ctr: m.ctr,
           position: m.position
         }));
         return res.json({ rows });
      }

      // Not enough cached data — fetch the full range live from GSC
      const data = await fetchGSCData(client.gsc_site_url, dbStartDate, dbEndDate);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Public: Fetch PSI Data
  app.get('/api/client/:slug/psi', async (req, res) => {
    try {
      const client = await getClientBySlug(req.params.slug);
      if (!client || client.is_active === 0 || !client.psi_url) return res.status(404).json({ error: 'Not configured or inactive' });
      
      const { strategy = 'mobile' } = req.query;
      const strat = strategy as 'mobile' | 'desktop';

      // Try to get snapshot first
      const snapshot = await getLatestPSISnapshot(client.id, strat);
      
      if (snapshot) {
        const data = JSON.parse(snapshot.data);
        // Add timestamp to the response
        data.snapshot_created_at = snapshot.created_at;
        return res.json(data);
      }

      // Fallback to live fetch if no snapshot exists
      console.log(`No PSI snapshot for ${client.name} (${strat}), fetching live...`);
      const data = await fetchPSIData(client.psi_url, strat);
      
      // Save slimmed version — full PSI JSON far exceeds Appwrite's field size limit
      await savePSISnapshot(client.id, strat, slimPSIData(data));
      
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Public: Fetch PSI History
  app.get('/api/client/:slug/psi/history', async (req, res) => {
    try {
      const client = await getClientBySlug(req.params.slug);
      if (!client || client.is_active === 0 || !client.psi_url) return res.status(404).json({ error: 'Not configured or inactive' });
      
      const { strategy = 'mobile' } = req.query;
      const snapshots = await getPSISnapshots(client.id, strategy as string);
      
      const history = snapshots.map(s => {
        const data = JSON.parse(s.data);
        return {
          created_at: s.created_at,
          performance: Math.round((data.lighthouseResult?.categories?.performance?.score || 0) * 100),
          accessibility: Math.round((data.lighthouseResult?.categories?.accessibility?.score || 0) * 100),
          bestPractices: Math.round((data.lighthouseResult?.categories?.['best-practices']?.score || 0) * 100),
          seo: Math.round((data.lighthouseResult?.categories?.seo?.score || 0) * 100),
        };
      }).reverse(); // Oldest first for chart
      
      res.json(history);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Public: Uptime Kuma data for a client (authenticated Socket.IO)
  app.get('/api/client/:slug/uptime', async (req, res) => {
    try {
      const client = await getClientBySlug(req.params.slug);
      if (!client || client.is_active === 0 || !client.uptime_kuma_slug) {
        return res.status(404).json({ error: 'Uptime monitoring not configured for this client' });
      }

      const [ukBaseUrl, ukUsername, ukPassword] = await Promise.all([
        getSetting('uptime_kuma_url'),
        getSetting('uptime_kuma_username'),
        getSetting('uptime_kuma_password'),
      ]);

      if (!ukBaseUrl || !ukUsername || !ukPassword) {
        return res.status(500).json({ error: 'Uptime Kuma credentials not fully configured in Settings' });
      }

      const { monitors: allMonitors, heartbeatList } = await getUptimeKumaData(ukBaseUrl, ukUsername, ukPassword);

      // Filter monitors by name — case-insensitive substring match on the
      // per-client "monitor name filter" stored in uptime_kuma_slug
      const nameFilter = client.uptime_kuma_slug.toLowerCase();
      const matched = Object.values(allMonitors).filter(
        (m: any) => m.name.toLowerCase().includes(nameFilter)
      );

      // Helper: compute uptime % from a heartbeat array
      const calcUptime = (arr: any[]): number | null =>
        arr.length > 0
          ? +((arr.filter((h: any) => h.status === 1).length / arr.length) * 100).toFixed(2)
          : null;

      const result = matched.map((m: any) => {
        const id = String(m.id);
        const beats: any[] = heartbeatList[id] || [];

        // beats are in chronological order (oldest first) from Uptime Kuma
        const currentStatus = beats.length > 0 ? beats[beats.length - 1].status : null;

        const pings = beats
          .filter((h: any) => h.ping != null && h.ping > 0)
          .map((h: any) => h.ping as number);
        const avgPing = pings.length > 0
          ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length)
          : null;

        // Uptime percentages — use last N heartbeats as proxy for time windows
        // (interval is typically 60s, so 1440 ≈ 24h, 43200 ≈ 30d)
        const last24  = beats.slice(-1440);
        const last30d = beats.slice(-43200);

        // Return up to 100 recent heartbeats for the sparkline / chart
        const recentBeats = beats.slice(-100);

        return {
          id,
          name:          m.name,
          type:          m.type,
          currentStatus,          // 0=DOWN 1=UP 2=PENDING 3=MAINTENANCE
          uptime24h:     calcUptime(last24),
          uptime30d:     calcUptime(last30d),
          avgPing,
          heartbeats: recentBeats.map((h: any) => ({
            status: h.status,
            ping:   h.ping ?? null,
            time:   h.time,
          })),
        };
      });

      res.json({ title: client.name, monitors: result });
    } catch (err: any) {
      console.error('Uptime Kuma fetch error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Public: MainWP site data for a client
  app.get('/api/client/:slug/mainwp', async (req, res) => {
    try {
      const client = await getClientBySlug(req.params.slug);
      if (!client || client.is_active === 0 || !client.mainwp_site_id) {
        return res.status(404).json({ error: 'MainWP not configured for this client' });
      }
      const [mainwpUrl, mainwpApiKey] = await Promise.all([
        getSetting('mainwp_url'),
        getSetting('mainwp_api_key'),
      ]);
      if (!mainwpUrl || !mainwpApiKey) {
        return res.status(500).json({ error: 'MainWP credentials not configured in Settings' });
      }
      const data = await getMainWPSiteData(mainwpUrl, mainwpApiKey, client.mainwp_site_id);

      // ── Snapshot diff: compute completed updates ───────────────────────────
      const snapshotKey = `mainwp_snap_${client.id}`;
      const prevSnapStr = await getSetting(snapshotKey).catch(() => undefined);
      const prevSnap = prevSnapStr ? JSON.parse(prevSnapStr) : null;

      const completedUpdates: any[] = [];
      if (prevSnap) {
        // Core
        if (prevSnap.wp && data.versionMap.wp && prevSnap.wp !== data.versionMap.wp) {
          completedUpdates.push({ type: 'core', name: 'WordPress Core', slug: 'wordpress', from: prevSnap.wp, to: data.versionMap.wp });
        }
        // Plugins
        for (const [slug, info] of Object.entries(data.versionMap.plugins) as [string, any][]) {
          const prev = prevSnap.plugins?.[slug];
          if (prev && prev.version && info.version && prev.version !== info.version) {
            completedUpdates.push({ type: 'plugin', name: info.name, slug, from: prev.version, to: info.version });
          }
        }
        // Themes
        for (const [slug, info] of Object.entries(data.versionMap.themes) as [string, any][]) {
          const prev = prevSnap.themes?.[slug];
          if (prev && prev.version && info.version && prev.version !== info.version) {
            completedUpdates.push({ type: 'theme', name: info.name, slug, from: prev.version, to: info.version });
          }
        }
      }

      // Save latest snapshot (fire-and-forget)
      setSetting(snapshotKey, JSON.stringify(data.versionMap)).catch(() => {});

      // Strip versionMap from client response; add completedUpdates
      const { versionMap: _vm, ...clientData } = data;
      res.json({ ...clientData, completedUpdates });
    } catch (err: any) {
      console.error('MainWP fetch error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Public: HubSpot subscription data for a client (matched by website URL)
  app.get('/api/client/:slug/hubspot', async (req, res) => {
    try {
      const client = await getClientBySlug(req.params.slug);
      if (!client || client.is_active === 0 || !client.website_url) {
        return res.status(404).json({ error: 'No website URL configured for this client' });
      }
      const [accessToken, legacyKey] = await Promise.all([
        getSetting('hubspot_access_token'),
        getSetting('hubspot_api_key'),
      ]);
      const token = accessToken || legacyKey || '';
      if (!token) {
        return res.status(500).json({ error: 'HubSpot Access Token not configured in Settings' });
      }
      const data = await getHubSpotSubscriptionByUrl(token, client.website_url);
      if (!data) return res.status(404).json({ error: 'No HubSpot subscription found matching this website URL' });

      // Sync care_plan back to Appwrite (fire-and-forget)
      if (data.carePlan !== undefined) {
        setClientCarePlan(client.id, data.carePlan).catch(e =>
          console.warn('[HubSpot] care_plan sync failed:', e.message)
        );
      }

      res.json(data);
    } catch (err: any) {
      console.error('HubSpot fetch error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Manual HubSpot sync — find subscription by website URL, push reporter URL, pull care_plan
  app.post('/api/admin/clients/:id/hubspot-sync', requireAdmin, async (req, res) => {
    try {
      const client = await getClientById(req.params.id);
      if (!client) return res.status(404).json({ error: 'Client not found' });
      if (!client.website_url) return res.status(400).json({ error: 'No website URL configured for this client' });

      const [accessToken, legacyKey] = await Promise.all([
        getSetting('hubspot_access_token'),
        getSetting('hubspot_api_key'),
      ]);
      const token = accessToken || legacyKey || '';
      if (!token) return res.status(500).json({ error: 'HubSpot Access Token not configured in Settings' });

      const sub = await getHubSpotSubscriptionByUrl(token, client.website_url);
      if (!sub) return res.status(404).json({ error: 'No HubSpot subscription found matching this website URL' });

      // Push report URL → HubSpot
      await pushReporterUrlToHubSpot(token, sub.recordId, `${APP_BASE_URL}/${client.slug}`);

      // Pull care_plan → Appwrite
      if (sub.carePlan !== null && sub.carePlan !== undefined) {
        await setClientCarePlan(client.id, sub.carePlan);
      }

      // Pull email fields + contact name → Appwrite
      const emailFields: Parameters<typeof setClientEmailFields>[1] = {};
      emailFields.hubspot_record_id = sub.recordId;
      // start_date is the custom HubSpot property; fall back to createdate (always present)
      const dateSource = sub.startDate || sub.nextReviewDate || sub.createDate; // nextReviewDate used as day-of-month source if start_date absent
      if (dateSource) emailFields.next_send_date = computeNextSendDate(dateSource);
      const contact = await getHubSpotContactForSubscription(token, sub.recordId);
      // Prefer email from the associated Contact; fall back to subscription's contact_email field
      if (contact.email)          emailFields.contact_email = contact.email;
      else if (sub.contactEmail)  emailFields.contact_email = sub.contactEmail;
      if (contact.firstName) emailFields.first_name = contact.firstName;
      if (contact.lastName)  emailFields.last_name  = contact.lastName;
      if (Object.keys(emailFields).length > 0) {
        await setClientEmailFields(client.id, emailFields);
      }

      console.log(`[HubSpot] Sync complete for ${client.name}: dateSource=${dateSource} (start_date=${sub.startDate}, createdate=${sub.createDate}), nextSend=${emailFields.next_send_date}, contact=${contact.firstName} ${contact.lastName} <${contact.email}>`);
      addLog('hubspot', 'success', `Manual sync — care plan: ${sub.carePlan || '—'}, next send: ${emailFields.next_send_date || '—'}, email: ${emailFields.contact_email || '—'}`, client.name);
      res.json({ success: true, subscription: sub, carePlanSaved: sub.carePlan, emailFieldsSaved: emailFields });
    } catch (err: any) {
      console.error('HubSpot sync error:', err.message);
      addLog('hubspot', 'error', `Manual sync failed: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Sync ALL clients with HubSpot — push report_url, pull care_plan
  app.post('/api/admin/hubspot-sync-all', requireAdmin, async (req, res) => {
    try {
      const [accessToken, legacyKey] = await Promise.all([
        getSetting('hubspot_access_token'),
        getSetting('hubspot_api_key'),
      ]);
      const token = accessToken || legacyKey || '';
      if (!token) return res.status(500).json({ error: 'HubSpot Access Token not configured in Settings' });

      const clients = await getClients();
      const results: { id: string; name: string; status: 'synced' | 'skipped' | 'error'; error?: string }[] = [];

      for (const client of clients) {
        if (!client.website_url) {
          results.push({ id: client.id, name: client.name, status: 'skipped', error: 'No website URL' });
          continue;
        }
        try {
          const sub = await getHubSpotSubscriptionByUrl(token, client.website_url);
          if (!sub) {
            results.push({ id: client.id, name: client.name, status: 'skipped', error: 'No matching subscription' });
            continue;
          }
          // Push report URL → HubSpot
          await pushReporterUrlToHubSpot(token, sub.recordId, `${APP_BASE_URL}/${client.slug}`);
          // Pull care_plan → Appwrite
          if (sub.carePlan !== undefined) {
            await setClientCarePlan(client.id, sub.carePlan);
          }
          // Pull email fields + contact name → Appwrite
          const emailFields: Parameters<typeof setClientEmailFields>[1] = {};
          emailFields.hubspot_record_id = sub.recordId;
          // start_date is the custom HubSpot property; fall back to createdate (always present)
          const dateSource = sub.startDate || sub.nextReviewDate || sub.createDate; // nextReviewDate used as day-of-month source if start_date absent
          if (dateSource) emailFields.next_send_date = computeNextSendDate(dateSource);
          const contact = await getHubSpotContactForSubscription(token, sub.recordId);
          // Prefer email from the associated Contact; fall back to subscription's contact_email field
          if (contact.email)         emailFields.contact_email = contact.email;
          else if (sub.contactEmail) emailFields.contact_email = sub.contactEmail;
          if (contact.firstName) emailFields.first_name = contact.firstName;
          if (contact.lastName)  emailFields.last_name  = contact.lastName;
          if (Object.keys(emailFields).length > 0) {
            await setClientEmailFields(client.id, emailFields);
          }
          results.push({ id: client.id, name: client.name, status: 'synced' });
        } catch (err: any) {
          results.push({ id: client.id, name: client.name, status: 'error', error: err.message });
        }
      }

      const synced = results.filter(r => r.status === 'synced').length;
      const skipped = results.filter(r => r.status === 'skipped').length;
      const errors = results.filter(r => r.status === 'error').length;

      res.json({ synced, skipped, errors, total: results.length, results });
    } catch (err: any) {
      console.error('HubSpot sync-all error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Email log endpoints
  // Activity log — reads from Appwrite; falls back to in-memory cache on error
  app.get('/api/admin/activity-logs', requireAdmin, async (_req, res) => {
    try {
      const logs = await getActivityLogs(200);
      res.json(logs.map(l => ({
        id:        l.id,
        timestamp: l.created_at,
        type:      l.type,
        status:    l.status,
        message:   l.message,
        client:    l.client_name ?? undefined,
      })));
    } catch (err: any) {
      // Appwrite unavailable — return in-memory cache so the UI still works
      console.warn('[ActivityLog] Appwrite read failed, serving cache:', err.message);
      res.json(activityLogCache);
    }
  });

  app.get('/api/admin/email-logs', requireAdmin, async (req, res) => {
    try {
      const logs = await getEmailLogs(200);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/email-logs/:clientId', requireAdmin, async (req, res) => {
    try {
      const logs = await getEmailLogsByClient(req.params.clientId, 50);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Send a report email to a client immediately (ignores next_send_date).
  // Body: { period?: string }  — defaults to "Last 30 Days" for the Send Now button.
  app.post('/api/admin/clients/:id/send-test-email', requireAdmin, async (req, res) => {
    let client: Awaited<ReturnType<typeof getClientById>> | undefined;
    try {
      client = await getClientById(req.params.id);
      if (!client) return res.status(404).json({ error: 'Client not found' });
      if (!client.contact_email) return res.status(400).json({ error: 'No contact email configured for this client' });

      const serverToken = await getSetting('postmark_server_token');
      const fromEmail   = await getSetting('smtp_from_email');
      const fromName    = (await getSetting('smtp_from_name')) || 'Stoke Design';
      const replyTo     = (await getSetting('smtp_reply_to')) || undefined;

      if (!serverToken || !fromEmail) {
        return res.status(500).json({ error: 'Postmark SMTP not configured in Settings' });
      }

      // period comes from the request body — "Send Now" passes "Last 30 Days",
      // the old test-email call passes nothing (falls back to current month name).
      const period = req.body?.period || format(new Date(), 'MMMM yyyy');

      let reportSummary = '';
      try {
        const report = await generateReportOverview(client);
        reportSummary = report?.summary || '';
      } catch { /* proceed without summary */ }

      const { subject, html } = buildMonthlyReportEmail({
        firstName:    client.first_name || client.name,
        clientName:   client.name,
        dashboardUrl: `${APP_BASE_URL}/${client.slug}`,
        month:        format(new Date(), 'MMMM yyyy'),
        period,
        reportSummary,
      });

      await sendEmail({ to: client.contact_email, subject, html, serverToken, fromEmail, fromName, replyTo });
      await saveEmailLog({
        client_id: client.id, client_name: client.name,
        website_url: client.website_url, recipient_email: client.contact_email,
        subject, status: 'sent', error: null,
      });
      addLog('email', 'success', `Report sent manually (${period}) to ${client.contact_email}`, client.name);
      // Fire report.emailed webhook
      Promise.all([getSetting('webhook_url'), getSetting('webhook_secret'), getSetting('webhook_events_enabled')])
        .then(([url, secret, events]) => {
          if (url) fireWebhook(url, secret || '', events || '[]', 'report.emailed', {
            slug: client!.slug, name: client!.name, sentTo: client!.contact_email, trigger: 'manual',
          });
        }).catch(() => {});

      res.json({ success: true, sentTo: client.contact_email });
    } catch (err: any) {
      // Log failure to email_logs and activity_logs
      if (client?.contact_email) {
        const period = req.body?.period || format(new Date(), 'MMMM yyyy');
        saveEmailLog({
          client_id: client.id, client_name: client.name,
          website_url: client.website_url, recipient_email: client.contact_email,
          subject: `Your ${period} Website Report — ${client.name}`,
          status: 'failed', error: err.message,
        }).catch(() => {});
        addLog('email', 'error', `Report send failed: ${err.message}`, client.name);
      }
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Send a test email to verify SMTP/Postmark configuration
  app.post('/api/admin/test-smtp', requireAdmin, async (req, res) => {
    try {
      const { to } = req.body;
      if (!to) return res.status(400).json({ error: 'Recipient address required' });

      const serverToken = await getSetting('postmark_server_token');
      const fromEmail   = await getSetting('smtp_from_email');
      const fromName    = (await getSetting('smtp_from_name')) || 'Stoke Design';
      const replyTo     = (await getSetting('smtp_reply_to')) || undefined;

      if (!serverToken) return res.status(400).json({ error: 'Postmark Server Token is not configured' });
      if (!fromEmail)   return res.status(400).json({ error: 'From Email Address is not configured' });

      const subject = 'Stoke Reporter — SMTP Test';
      const html = `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px;">
          <h2 style="margin:0 0 16px;color:#0a0a0a;">SMTP Test Successful</h2>
          <p style="color:#444;line-height:1.6;">
            This is a test email from <strong>Stoke Web Reporter</strong>.<br>
            Your Postmark SMTP configuration is working correctly.
          </p>
          <p style="color:#888;font-size:12px;margin-top:32px;">Sent from: ${fromName} &lt;${fromEmail}&gt;${replyTo ? `<br/>Reply-To: ${replyTo}` : ''}</p>
        </div>`;

      await sendEmail({ to, subject, html, serverToken, fromEmail, fromName, replyTo });
      res.json({ success: true, sentTo: to });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Inbound webhook endpoint — accepts actions from n8n or other automation tools
  app.post('/api/webhook', async (req, res) => {
    try {
      const inboundToken = await getSetting('webhook_inbound_token');
      const providedToken = req.headers['x-webhook-token'];
      if (!inboundToken || providedToken !== inboundToken) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { action, slug, fields, message } = req.body;

      if (action === 'refresh_psi') {
        const client = await getClientBySlug(slug);
        if (!client || !client.psi_url) return res.status(404).json({ error: 'Client not found or PSI not configured' });
        const data = await fetchPSIData(client.psi_url, 'mobile');
        await savePSISnapshot(client.id, 'mobile', slimPSIData(data));
        const dataDesktop = await fetchPSIData(client.psi_url, 'desktop');
        await savePSISnapshot(client.id, 'desktop', slimPSIData(dataDesktop));
        return res.json({ success: true, action });
      }

      if (action === 'update_client') {
        const client = await getClientBySlug(slug);
        if (!client) return res.status(404).json({ error: 'Client not found' });
        const updated = await updateClient(client.id, { ...client, ...(fields || {}) });
        return res.json({ success: true, action, client: updated });
      }

      if (action === 'post_notification') {
        if (message !== undefined) await setSetting('global_notification', String(message));
        return res.json({ success: true, action });
      }

      return res.status(400).json({ error: `Unknown action: ${action}` });
    } catch (err: any) {
      console.error('[Inbound webhook] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Reusable report generation (used by HTTP endpoint + email job) ────────────
  type ReportOverviewResult = { summary: string; keyMetrics: any; generatedAt: string; reportStart: string; reportEnd: string };
  async function generateReportOverview(client: any): Promise<ReportOverviewResult | null> {
    // Return cached version if less than 24 hours old
    const cached = await getClientReportCache(client.id).catch(() => null);
    if (cached?.generatedAt) {
      const ageMs = Date.now() - new Date(cached.generatedAt).getTime();
      if (ageMs < 24 * 60 * 60 * 1000) {
        console.log(`[Report] Serving cached report for ${client.slug} (age: ${Math.round(ageMs / 60000)}m)`);
        return cached;
      }
    }

    const anthropicApiKey = await getSetting('anthropic_api_key');
    if (!anthropicApiKey) return null;

    const rangeStart     = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const rangeEnd       = format(new Date(), 'yyyy-MM-dd');
    const prevRangeStart = format(subDays(new Date(), 60), 'yyyy-MM-dd');
    const prevRangeEnd   = format(subDays(new Date(), 31), 'yyyy-MM-dd');
    const totalsMetrics  = ['activeUsers', 'newUsers', 'sessions', 'screenPageViews', 'averageSessionDuration', 'engagementRate'];

    const [gaResult, gaPrevResult, gscResult, gscPrevResult, psiResult, mainwpResult] = await Promise.allSettled([
      client.ga_property_id ? fetchGAData(client.ga_property_id, '30daysAgo', 'today', [], totalsMetrics) : Promise.resolve(null),
      client.ga_property_id ? fetchGAData(client.ga_property_id, prevRangeStart, prevRangeEnd, [], totalsMetrics) : Promise.resolve(null),
      client.gsc_site_url   ? getGSCMetrics(client.id, rangeStart, rangeEnd)          : Promise.resolve(null),
      client.gsc_site_url   ? getGSCMetrics(client.id, prevRangeStart, prevRangeEnd)  : Promise.resolve(null),
      client.psi_url        ? getLatestPSISnapshot(client.id, 'mobile')               : Promise.resolve(null),
      client.mainwp_site_id
        ? (async () => {
            const [mwUrl, mwKey] = await Promise.all([getSetting('mainwp_url'), getSetting('mainwp_api_key')]);
            if (!mwUrl || !mwKey) return null;
            return getMainWPSiteData(mwUrl, mwKey, client.mainwp_site_id!);
          })()
        : Promise.resolve(null),
    ]);

    const ga          = gaResult.status      === 'fulfilled' ? gaResult.value      : null;
    const gaPrev      = gaPrevResult.status  === 'fulfilled' ? gaPrevResult.value  : null;
    const gscRows     = gscResult.status     === 'fulfilled' ? gscResult.value     : null;
    const gscPrevRows = gscPrevResult.status === 'fulfilled' ? gscPrevResult.value : null;
    const psiSnap     = psiResult.status     === 'fulfilled' ? psiResult.value     : null;
    const mainwp      = mainwpResult.status  === 'fulfilled' ? mainwpResult.value  : null;

    const pctChange = (cur: number, prev: number): string => {
      if (!prev || prev === 0) return '';
      const pct = ((cur - prev) / prev) * 100;
      return ` (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs previous period)`;
    };

    const gaMetrics = (ga as any)?.rows?.[0]?.metricValues || [];
    const gaPrevM   = (gaPrev as any)?.rows?.[0]?.metricValues || [];
    const gaKey = gaMetrics.length > 0 ? {
      activeUsers: gaMetrics[0]?.value || '0', newUsers: gaMetrics[1]?.value || '0',
      sessions: gaMetrics[2]?.value || '0', pageViews: gaMetrics[3]?.value || '0',
      avgSessionDur: Math.round(parseFloat(gaMetrics[4]?.value || '0')),
      engagementRate: ((parseFloat(gaMetrics[5]?.value || '0')) * 100).toFixed(1),
    } : null;

    const rows = (gscRows as any[]) || [], prevRows = (gscPrevRows as any[]) || [];
    const gscKey = rows.length > 0 ? {
      totalClicks:      rows.reduce((s: number, r: any) => s + (r.clicks || 0), 0),
      totalImpressions: rows.reduce((s: number, r: any) => s + (r.impressions || 0), 0),
      avgPosition:      (rows.reduce((s: number, r: any) => s + (r.position || 0), 0) / rows.length).toFixed(1),
      avgCtr:           ((rows.reduce((s: number, r: any) => s + (r.ctr || 0), 0) / rows.length) * 100).toFixed(2),
    } : null;
    const gscPrevKey = prevRows.length > 0 ? {
      totalClicks:      prevRows.reduce((s: number, r: any) => s + (r.clicks || 0), 0),
      totalImpressions: prevRows.reduce((s: number, r: any) => s + (r.impressions || 0), 0),
    } : null;

    const psiData = psiSnap ? (() => { try { return JSON.parse((psiSnap as any).data); } catch { return null; } })() : null;
    const cats = psiData?.lighthouseResult?.categories || {};
    const psiKey = psiData ? {
      performance: Math.round((cats.performance?.score || 0) * 100),
      seo: Math.round((cats.seo?.score || 0) * 100),
      accessibility: Math.round((cats.accessibility?.score || 0) * 100),
      bestPractices: Math.round((cats['best-practices']?.score || 0) * 100),
    } : null;

    const mainwpKey = mainwp ? {
      wpVersion: (mainwp as any).wpVersion || '',
      pendingUpdates: (mainwp as any).totalUpgrades || 0,
      phpVersion: (mainwp as any).phpVersion || null,
    } : null;

    const keyMetrics = { ga: gaKey, gsc: gscKey, psi: psiKey, mainwp: mainwpKey };

    const sections: string[] = [];
    if (gaKey) {
      const curActive = parseInt(gaKey.activeUsers), prevActive = parseInt(gaPrevM[0]?.value || '0');
      const curSessions = parseInt(gaKey.sessions), prevSessions = parseInt(gaPrevM[2]?.value || '0');
      const curNewUsers = parseInt(gaKey.newUsers), prevNewUsers = parseInt(gaPrevM[1]?.value || '0');
      sections.push(`Website Traffic (last 30 days vs previous 30 days):\n- Active Users: ${curActive.toLocaleString()}${pctChange(curActive, prevActive)}\n- New Users: ${curNewUsers.toLocaleString()}${pctChange(curNewUsers, prevNewUsers)}\n- Sessions: ${curSessions.toLocaleString()}${pctChange(curSessions, prevSessions)}\n- Page Views: ${parseInt(gaKey.pageViews).toLocaleString()}\n- Engagement Rate: ${gaKey.engagementRate}%`);
    }
    if (gscKey) {
      sections.push(`Search Performance (last 30 days vs previous 30 days):\n- Search Clicks: ${gscKey.totalClicks.toLocaleString()}${pctChange(gscKey.totalClicks, gscPrevKey?.totalClicks || 0)}\n- Impressions: ${gscKey.totalImpressions.toLocaleString()}${pctChange(gscKey.totalImpressions, gscPrevKey?.totalImpressions || 0)}\n- Average Position: ${gscKey.avgPosition}\n- Average CTR: ${gscKey.avgCtr}%`);
    }
    if (psiKey) {
      sections.push(`Page Speed — Mobile (latest snapshot):\n- Performance: ${psiKey.performance}/100\n- SEO: ${psiKey.seo}/100\n- Accessibility: ${psiKey.accessibility}/100\n- Best Practices: ${psiKey.bestPractices}/100`);
    }
    if (mainwpKey) {
      sections.push(`WordPress Health:\n- WordPress Version: ${mainwpKey.wpVersion}\n- Pending Updates: ${mainwpKey.pendingUpdates}${mainwpKey.phpVersion ? `\n- PHP Version: ${mainwpKey.phpVersion}` : ''}`);
    }

    // Use Melbourne timezone for report period labels
    const melbToday = toZonedTime(new Date(), 'Australia/Melbourne');
    const reportStart = format(subDays(melbToday, 30), 'd MMMM yyyy');
    const reportEnd   = format(melbToday, 'd MMMM yyyy');

    const prompt = [
      `You are a friendly digital agency consultant at Stoke Design writing a monthly website performance summary for a client.`,
      `Your tone is warm, positive, and easy to understand — the reader is a business owner, not a technical person.`,
      `Use Australian English spelling throughout (e.g. "summarise", "recognise", "optimise", "analyse", "colour", "behaviour").`,
      ``,
      `Client: ${client.name}`,
      `Website: ${client.website_url || 'N/A'}`,
      `Report period: ${reportStart} – ${reportEnd}\n`,
      sections.join('\n\n'),
      `\nWrite a positive, encouraging summary (3–4 short paragraphs, max 300 words) that:`,
      `1. Opens with a friendly greeting using the contact's first name ("${client.first_name || client.name}") on its own line, followed by a blank line before the first paragraph which mentions the reporting period.`,
      `2. Translates each statistic into plain language a business owner can understand. Where comparison figures are provided (e.g. +12.5% vs previous period), naturally weave these into the narrative to show growth or momentum — keep the tone celebratory.`,
      `3. Do NOT mention any negatives, areas of concern, or suggestions for improvement.`,
      `4. Do NOT include any headers, bullet points, or formatting — write entirely in flowing paragraphs.`,
      `5. Do NOT add a sign-off or closing line — that will be added separately.`,
    ].join('\n');

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicApiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-opus-4-5', max_tokens: 750, messages: [{ role: 'user', content: prompt }] }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text().catch(() => '');
      throw new Error(`Anthropic API error ${anthropicRes.status}: ${errText}`);
    }

    const anthropicData = await anthropicRes.json();
    const summary = anthropicData.content?.[0]?.text || '';
    const result = { summary, keyMetrics, generatedAt: new Date().toISOString(), reportStart, reportEnd };

    setClientReportCache(client.id, result).catch(e =>
      console.warn(`[Report] Failed to cache report for ${client.slug}:`, e.message)
    );

    return result;
  }

  // Public: Report Overview — aggregate all data, generate AI summary, cache for 24 hours in Appwrite
  app.get('/api/client/:slug/report-overview', async (req, res) => {
    try {
      const client = await getClientBySlug(req.params.slug);
      if (!client || client.is_active === 0) return res.status(404).json({ error: 'Client not found or inactive' });

      const anthropicApiKey = await getSetting('anthropic_api_key');
      if (!anthropicApiKey) return res.status(500).json({ error: 'Anthropic API key not configured in Settings' });

      const result = await generateReportOverview(client);
      if (!result) return res.status(500).json({ error: 'Failed to generate report' });

      // Check if result came from cache (compare generatedAt age)
      const ageMs = Date.now() - new Date(result.generatedAt).getTime();
      const fromCache = ageMs > 5000; // older than 5s = served from cache
      res.json({ ...result, fromCache });
    } catch (err: any) {
      console.error('Report overview error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Public: App config (safe, non-sensitive values for the frontend)
  app.get('/api/config', async (req, res) => {
    try {
      const gtmContainerId = await getSetting('gtm_container_id') || '';
      res.json({
        gtm_container_id: gtmContainerId,
        appwrite_endpoint: process.env.APPWRITE_ENDPOINT || '',
        appwrite_project_id: process.env.APPWRITE_PROJECT_ID || '',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    // Serve built React frontend and SPA fallback
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    // Development: Vite dev server with HMR (dynamic import — vite is a devDependency)
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
