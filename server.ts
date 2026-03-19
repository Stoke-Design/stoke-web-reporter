import express from 'express';
import { createServer as createViteServer } from 'vite';
import { getClients, getClientBySlug, createClient, updateClient, deleteClient, getSetting, setSetting, getLatestPSISnapshot, savePSISnapshot, saveGAMetrics, saveGSCMetrics, getGAMetrics, getGSCMetrics, getPSISnapshots } from './src/db.js';
import { fetchGAData, fetchGSCData, fetchBQData, fetchPSIData, slimPSIData, listGASites, listGSCSites } from './src/api/google.js';
import { getUptimeKumaData, clearUptimeKumaCache } from './src/api/uptimeKuma.js';
import { format, subDays } from 'date-fns';

async function startServer() {
  const app = express();
  const PORT = 3000;

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
          return;
        }
      }

      const clients = await getClients();
      
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
                continue;
              }
            }

            console.log(`Fetching PSI for ${client.name} (${strategy})...`);
            const data = await fetchPSIData(client.psi_url, strategy);
            await savePSISnapshot(client.id, strategy, slimPSIData(data));
            console.log(`Saved PSI snapshot for ${client.name} (${strategy})`);
            
            // Throttle: wait 10 seconds between PSI requests to avoid hitting rate limits
            await new Promise(resolve => setTimeout(resolve, 10000));
          } catch (error: any) {
            console.error(`Failed to fetch/save PSI for ${client.name} (${strategy}):`, error.message);
            // If we hit quota, stop the job for now to avoid further errors
            if (error.message.toLowerCase().includes('quota exceeded')) {
              console.warn('PSI Quota exceeded, stopping job.');
              return;
            }
          }
        }
      }
      
      await setSetting('last_psi_run', new Date().toISOString());
      console.log('PSI Snapshot Job Completed.');
    } catch (error) {
      console.error('Error in PSI Snapshot Job:', error);
    } finally {
      isPSIRunning = false;
    }
  };

  // --- Background Job for GA/GSC Sync ---
  const runAnalyticsSyncJob = async () => {
    console.log('Starting Analytics Sync Job...');
    try {
      const clients = await getClients();
      
      // Fetch last 3 days to cover any gaps (e.g. yesterday's data might not be ready immediately at midnight)
      // Actually, let's fetch last 7 days to be safe and update any changes.
      const startDate = format(subDays(new Date(), 7), 'yyyy-MM-dd');
      const endDate = 'today'; // API understands 'today'

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
                // Convert YYYYMMDD to YYYY-MM-DD
                const formattedDate = `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
                
                await saveGAMetrics(client.id, formattedDate, {
                  activeUsers: parseInt(row.metricValues[0].value, 10),
                  sessions: parseInt(row.metricValues[1].value, 10),
                  screenPageViews: parseInt(row.metricValues[2].value, 10),
                });
              }
            }
            console.log(`Synced GA for ${client.name}`);
          } catch (error: any) {
            console.error(`Failed to sync GA for ${client.name}:`, error.message);
          }
        }

        // Sync GSC
        if (client.gsc_site_url) {
          try {
            console.log(`Syncing GSC for ${client.name}...`);
            // GSC API expects YYYY-MM-DD
            const gscData = await fetchGSCData(client.gsc_site_url, startDate, format(new Date(), 'yyyy-MM-dd'));
            if (gscData.rows) {
              for (const row of gscData.rows) {
                const date = row.keys[0]; // YYYY-MM-DD
                await saveGSCMetrics(client.id, date, {
                  clicks: row.clicks,
                  impressions: row.impressions,
                  ctr: row.ctr,
                  position: row.position,
                });
              }
            }
            console.log(`Synced GSC for ${client.name}`);
            
            // Small delay between clients to avoid hitting rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error: any) {
            console.error(`Failed to sync GSC for ${client.name}:`, error.message);
          }
        }
      }
      console.log('Analytics Sync Job Completed.');
    } catch (error) {
      console.error('Error in Analytics Sync Job:', error);
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


  app.use(express.json());

  // Simple auth middleware for admin routes (Removed)
  const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    next();
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
        client_id_number: req.body.client_id_number || null,
        name: req.body.name || '',
        slug: req.body.slug || '',
        website_url: req.body.website_url || null,
        contact_first_name: req.body.contact_first_name || null,
        contact_last_name: req.body.contact_last_name || null,
        contact_email: req.body.contact_email || null,
        enabled_pages: req.body.enabled_pages || '[1,2,3,4,5,6,7,8]',
        ga_property_id: req.body.ga_property_id || null,
        gsc_site_url: req.body.gsc_site_url || null,
        bq_project_id: req.body.bq_project_id || null,
        bq_dataset_id: req.body.bq_dataset_id || null,
        bq_table_id: req.body.bq_table_id || null,
        psi_url: req.body.psi_url || null,
        uptime_kuma_slug: req.body.uptime_kuma_slug || null,
        is_active: req.body.is_active !== undefined ? req.body.is_active : 1,
      };
      const client = await createClient(clientData);
      res.json(client);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Admin: Update client
  app.put('/api/admin/clients/:id', requireAdmin, async (req, res) => {
    try {
      const clientData = {
        client_id_number: req.body.client_id_number || null,
        name: req.body.name || '',
        slug: req.body.slug || '',
        website_url: req.body.website_url || null,
        contact_first_name: req.body.contact_first_name || null,
        contact_last_name: req.body.contact_last_name || null,
        contact_email: req.body.contact_email || null,
        enabled_pages: req.body.enabled_pages || '[1,2,3,4,5,6,7,8]',
        ga_property_id: req.body.ga_property_id || null,
        gsc_site_url: req.body.gsc_site_url || null,
        bq_project_id: req.body.bq_project_id || null,
        bq_dataset_id: req.body.bq_dataset_id || null,
        bq_table_id: req.body.bq_table_id || null,
        psi_url: req.body.psi_url || null,
        uptime_kuma_slug: req.body.uptime_kuma_slug || null,
        is_active: req.body.is_active !== undefined ? req.body.is_active : 1,
      };
      const client = await updateClient(req.params.id, clientData);
      res.json(client);
    } catch (err: any) {
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
      res.json({
        client_id_number: client.client_id_number,
        name: client.name,
        slug: client.slug,
        website_url: client.website_url,
        contact_first_name: client.contact_first_name,
        enabled_pages: client.enabled_pages,
        hasGA: !!client.ga_property_id,
        hasGSC: !!client.gsc_site_url,
        hasBQ: !!client.bq_project_id && !!client.bq_dataset_id && !!client.bq_table_id,
        hasPSI: !!client.psi_url,
        hasUptime: !!client.uptime_kuma_slug,
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
        dimensions = []; // Empty dimensions to get totals for the date range
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
      
      const { startDate = '30daysAgo', endDate = 'today' } = req.query;
      
      let dbStartDate = '';
      let dbEndDate = '';
      
      if (startDate === '30daysAgo') dbStartDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      else if (startDate === '90daysAgo') dbStartDate = format(subDays(new Date(), 90), 'yyyy-MM-dd');
      else if (startDate === '365daysAgo') dbStartDate = format(subDays(new Date(), 365), 'yyyy-MM-dd');
      else dbStartDate = String(startDate);
      
      if (endDate === 'today') dbEndDate = format(new Date(), 'yyyy-MM-dd');
      else dbEndDate = String(endDate);

      const storedMetrics = await getGSCMetrics(client.id, dbStartDate, dbEndDate);
      
      if (storedMetrics.length > 0) {
         // Transform to match Google API response format expected by frontend
         const rows = storedMetrics.map(m => ({
           keys: [m.date],
           clicks: m.clicks,
           impressions: m.impressions,
           ctr: m.ctr,
           position: m.position
         }));
         return res.json({ rows });
      }

      // GSC requires YYYY-MM-DD format
      // Also, GSC data is usually delayed by 2-3 days. If we ask for 'today', it might fail or return empty.
      // Let's use the calculated dbStartDate and dbEndDate which are YYYY-MM-DD.
      // However, if dbEndDate is today, we might want to adjust it to 2 days ago for GSC?
      // For now, let's just pass the correct format and let the API decide.
      
      const data = await fetchGSCData(client.gsc_site_url, dbStartDate, dbEndDate);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Public: Fetch BQ Data
  app.get('/api/client/:slug/bq', async (req, res) => {
    try {
      const client = await getClientBySlug(req.params.slug);
      if (!client || client.is_active === 0 || !client.bq_project_id || !client.bq_dataset_id || !client.bq_table_id) {
        return res.status(404).json({ error: 'Not configured or inactive' });
      }
      
      const data = await fetchBQData(client.bq_project_id, client.bq_dataset_id, client.bq_table_id);
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

  // Public: App config (safe, non-sensitive values for the frontend)
  app.get('/api/config', async (req, res) => {
    try {
      const gtmContainerId = await getSetting('gtm_container_id') || '';
      res.json({ gtm_container_id: gtmContainerId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
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
