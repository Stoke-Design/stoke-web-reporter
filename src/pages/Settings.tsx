import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Key, FileJson, AlertCircle, Database, Download, Upload, Plus, Users, Tag, Bot, Activity, Share2, Server, Mail } from 'lucide-react';
import { authFetch } from '../authFetch';

const PAGE_TITLE = 'Stoke Design Website Reporter';


export default function Settings() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [importReviewModalOpen, setImportReviewModalOpen] = useState(false);
  const [importConflicts, setImportConflicts] = useState<any[]>([]);
  const [importNewClients, setImportNewClients] = useState<any[]>([]);
  const [importAction, setImportAction] = useState<'skip' | 'overwrite'>('skip');
  const [importing, setImporting] = useState(false);

  const [formData, setFormData] = useState({
    google_service_account_json: '',
    google_api_key: '',
    global_notification: '',
    global_notification_icon: 'AlertCircle',
    global_notification_color: 'red',
    gtm_container_id: '',
    anthropic_api_key: '',
    uptime_kuma_url: '',
    uptime_kuma_username: '',
    uptime_kuma_password: '',
    webhook_url: '',
    webhook_secret: '',
    webhook_inbound_token: '',
    webhook_events_enabled: '["client.created","client.updated","psi.completed","uptime.alert","report.viewed","report.emailed"]',
    hubspot_access_token: '',
    hubspot_client_secret: '',
    mainwp_url: '',
    mainwp_api_key: '',
    postmark_server_token: '',
    smtp_from_email: '',
    smtp_from_name: '',
    smtp_reply_to: '',
    report_send_hour: '9',
  });

  useEffect(() => {
    document.title = `Settings | ${PAGE_TITLE}`;
  }, []);

  const [userFormData, setUserFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
  });
  const [savingUser, setSavingUser] = useState(false);
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');

  const [testEmailTo, setTestEmailTo] = useState('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleSendTestEmail = async () => {
    if (!testEmailTo) return;
    setSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      const res = await authFetch('/api/admin/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmailTo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setTestEmailResult({ ok: true, msg: `Test email sent to ${data.sentTo}` });
    } catch (err: any) {
      setTestEmailResult({ ok: false, msg: err.message });
    } finally {
      setSendingTestEmail(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      setFormData({
        google_service_account_json: data.google_service_account_json || '',
        google_api_key: data.google_api_key || '',
        global_notification: data.global_notification || '',
        global_notification_icon: data.global_notification_icon || 'AlertCircle',
        global_notification_color: data.global_notification_color || 'red',
        gtm_container_id: data.gtm_container_id || '',
        anthropic_api_key: data.anthropic_api_key || '',
        uptime_kuma_url: data.uptime_kuma_url || '',
        uptime_kuma_username: data.uptime_kuma_username || '',
        uptime_kuma_password: data.uptime_kuma_password || '',
        webhook_url: data.webhook_url || '',
        webhook_secret: data.webhook_secret || '',
        webhook_inbound_token: data.webhook_inbound_token || '',
        webhook_events_enabled: data.webhook_events_enabled || '["client.created","client.updated","psi.completed","uptime.alert","report.viewed","report.emailed"]',
        hubspot_access_token: data.hubspot_access_token || '',
        hubspot_client_secret: data.hubspot_client_secret || '',
        mainwp_url: data.mainwp_url || '',
        mainwp_api_key: data.mainwp_api_key || '',
        postmark_server_token: data.postmark_server_token || '',
        smtp_from_email: data.smtp_from_email || '',
        smtp_from_name: data.smtp_from_name || '',
        smtp_reply_to: data.smtp_reply_to || '',
        report_send_hour: data.report_send_hour || '9',
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      // Validate JSON if provided
      if (formData.google_service_account_json) {
        try {
          JSON.parse(formData.google_service_account_json);
        } catch (e) {
          throw new Error('Invalid JSON format for Service Account');
        }
      }

      const res = await authFetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to save settings');
      }
      
      setSuccess('Settings saved successfully');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // CSV column keys (internal) — used for export and import mapping
  const CSV_KEYS = [
    'client_id_number', 'name', 'slug', 'website_url', 'enabled_pages',
    'ga_property_id', 'gsc_site_url', 'psi_url', 'uptime_kuma_slug',
    'mainwp_site_id', 'care_plan', 'contact_email', 'first_name', 'last_name',
    'next_send_date', 'hubspot_record_id', 'email_notifications', 'is_active',
  ];

  // Display headers for template/export — mark required fields
  const CSV_HEADERS = [
    'client_id_number', 'name (required)', 'slug', 'website_url', 'enabled_pages',
    'ga_property_id', 'gsc_site_url', 'psi_url', 'uptime_kuma_slug',
    'mainwp_site_id', 'care_plan', 'contact_email', 'first_name', 'last_name',
    'next_send_date', 'hubspot_record_id', 'email_notifications', 'is_active',
  ];

  // Map display header → key for import parsing
  const headerToKey = (header: string): string => {
    const clean = header.replace(/\s*\(required\)\s*/gi, '').trim();
    return clean;
  };

  const escapeCSV = (val: any) => {
    const str = val == null ? '' : String(val);
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const downloadTemplateCSV = () => {
    const exampleRow = [
      'C001', 'Example Client', 'example-client', 'https://example.com',
      '[1,2,3,4,5,6,7,8,9]', 'GA-XXXXXXXXX', 'https://example.com/', 'https://example.com',
      'monitor-slug', 'mainwp-site-id', 'Pink Plan',
      'client@example.com', 'Jane', 'Smith',
      '', '', '1', '1',
    ].map(escapeCSV).join(',');
    const csvContent = "data:text/csv;charset=utf-8," + CSV_HEADERS.join(',') + '\n' + exampleRow;
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', 'client_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportClientsCSV = async () => {
    try {
      const res = await authFetch('/api/admin/clients');
      if (!res.ok) throw new Error('Failed to fetch clients');
      const clients: any[] = await res.json();
      const rows = [
        CSV_HEADERS.join(','),
        ...clients.map(c =>
          CSV_KEYS.map(k => escapeCSV(c[k])).join(',')
        ),
      ];
      const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `clients_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError('Export failed: ' + err.message);
    }
  };

  const executeImport = async (newClients: any[], clientsToUpdate: any[]) => {
    setImporting(true);
    try {
      for (const client of newClients) {
        await authFetch('/api/admin/clients', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(client),
        });
      }
      for (const client of clientsToUpdate) {
        const existingClient = importConflicts.find(c => c.imported.slug === client.slug)?.existing;
        if (existingClient) {
          await authFetch(`/api/admin/clients/${existingClient.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(client),
          });
        }
      }
      setSuccess(`Successfully imported ${newClients.length + clientsToUpdate.length} clients.`);
      setImportReviewModalOpen(false);
    } catch (err: any) {
      setError('Error importing CSV: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError('');
    setSuccess('');
    try {
      const text = await file.text();
      const parseCSVRow = (str: string) => {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < str.length; i++) {
          if (str[i] === '"') {
            inQuotes = !inQuotes;
          } else if (str[i] === ',' && !inQuotes) {
            result.push(cur);
            cur = '';
          } else {
            cur += str[i];
          }
        }
        result.push(cur);
        return result;
      };

      const rows = text.split('\n').filter(row => row.trim() !== '').map(parseCSVRow);
      const headers = rows[0].map(h => headerToKey(h));

      const clientsToImport = [];
      for (let i = 1; i < rows.length; i++) {
        if (rows[i].length < 2) continue; // skip blank/malformed rows
        const clientData: any = {
          client_id_number: '',
          name: '',
          slug: '',
          website_url: '',
          enabled_pages: '[1,2,3,4,5,6,7,8,9]',
          ga_property_id: '',
          gsc_site_url: '',
          psi_url: '',
          uptime_kuma_slug: '',
          mainwp_site_id: '',
          care_plan: '',
          contact_email: '',
          first_name: '',
          last_name: '',
          next_send_date: '',
          hubspot_record_id: '',
          email_notifications: '1',
          is_active: '1',
        };
        headers.forEach((header, index) => {
          if (Object.prototype.hasOwnProperty.call(clientData, header)) {
            clientData[header] = (rows[i][index] || '').trim();
          }
        });
        if (clientData.name) {
          if (!clientData.slug) {
            clientData.slug = Math.random().toString(36).slice(2, 10);
          }
          if (!clientData.enabled_pages) clientData.enabled_pages = '[1,2,3,4,5,6,7,8,9]';
          if (!clientData.is_active) clientData.is_active = '1';
          clientsToImport.push(clientData);
        }
      }

      const res = await authFetch('/api/admin/clients');
      if (!res.ok) throw new Error('Failed to fetch existing clients for conflict check');
      const existingClients = await res.json();

      const newClients = [];
      const conflicts = [];
      for (const client of clientsToImport) {
        const existing = existingClients.find((c: any) => c.slug === client.slug);
        if (existing) {
          conflicts.push({ existing, imported: client });
        } else {
          newClients.push(client);
        }
      }

      if (conflicts.length > 0) {
        setImportConflicts(conflicts);
        setImportNewClients(newClients);
        setImportReviewModalOpen(true);
      } else {
        await executeImport(newClients, []);
      }
    } catch (err: any) {
      setError('Error importing CSV: ' + err.message);
    } finally {
      setImporting(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-8">
          <Link to="/admin" className="mr-4 p-2 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Settings</h1>
            <p className="text-gray-500 mt-1">Manage global application configuration</p>
          </div>
        </div>

        {error && <div className="mb-6 p-4 bg-red-900/20 text-red-400 rounded-xl">{error}</div>}
        {success && <div className="mb-6 p-4 bg-gray-100 text-gray-900 rounded-xl">{success}</div>}

        <div className="space-y-8">
          <div className="bg-white rounded-2xl shadow-none border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-900" />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
                
                {/* Google Service Account Section */}
              <section>
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-blue-900/20 text-blue-400 rounded-xl">
                    <FileJson className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Google Service Account</h2>
                    <p className="text-sm text-gray-500">Required for Google Analytics and Search Console access.</p>
                  </div>
                </div>
                
                <div className="ml-16">
                  <label className="block text-sm font-medium text-gray-600 mb-2">Service Account JSON</label>
                  <textarea
                    value={formData.google_service_account_json}
                    onChange={(e) => setFormData({ ...formData, google_service_account_json: e.target.value })}
                    placeholder='{ "type": "service_account", ... }'
                    rows={10}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                  />
                  
                  {(() => {
                    try {
                      if (!formData.google_service_account_json) return null;
                      const json = JSON.parse(formData.google_service_account_json);
                      if (json.client_email) {
                        return (
                          <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                            <h4 className="text-sm font-semibold text-gray-900 mb-2">Service Account Email</h4>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 p-2 bg-white rounded border border-gray-200 text-xs font-mono text-gray-900 break-all">
                                {json.client_email}
                              </code>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(json.client_email);
                                  alert('Email copied to clipboard!');
                                }}
                                className="px-3 py-2 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-700 transition-colors"
                              >
                                Copy
                              </button>
                            </div>
                            <p className="mt-2 text-xs text-gray-700">
                              <strong>Action Required:</strong> To fix "sufficient permission" errors, add this email as a User (with 'Full' or 'Restricted' permissions) in your <a href="https://search.google.com/search-console/users" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-900">Google Search Console settings</a>.
                            </p>
                          </div>
                        );
                      }
                    } catch (e) {
                      return null;
                    }
                  })()}

                  <p className="mt-2 text-xs text-gray-500">
                    Paste the entire content of your service account JSON key file here.
                  </p>
                </div>
              </section>

              <div className="border-t border-gray-200"></div>

              {/* Google API Key Section */}
              <section>
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-gray-100 text-gray-900 rounded-xl">
                    <Key className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Google PageSpeed API Key</h2>
                    <p className="text-sm text-gray-500">Required for PageSpeed Insights API.</p>
                  </div>
                </div>
                
                <div className="ml-16">
                  <label className="block text-sm font-medium text-gray-600 mb-2">API Key</label>
                  <input
                    type="text"
                    value={formData.google_api_key}
                    onChange={(e) => setFormData({ ...formData, google_api_key: e.target.value })}
                    placeholder="AIzaSy..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                  />
                </div>
              </section>

              <div className="border-t border-gray-200"></div>

              {/* Google Tag Manager Section */}
              <section>
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-green-900/20 text-green-500 rounded-xl">
                    <Tag className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Google Tag Manager</h2>
                    <p className="text-sm text-gray-500">Track admin and client dashboard usage via GTM.</p>
                  </div>
                </div>
                <div className="ml-16">
                  <label className="block text-sm font-medium text-gray-600 mb-2">GTM Container ID</label>
                  <input
                    type="text"
                    value={formData.gtm_container_id}
                    onChange={(e) => setFormData({ ...formData, gtm_container_id: e.target.value })}
                    placeholder="GTM-XXXXXXX"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                  />
                  <p className="mt-2 text-xs text-gray-500">Found in your GTM workspace. Leave blank to disable tracking.</p>
                </div>
              </section>

              <div className="border-t border-gray-200"></div>

              {/* Anthropic API Key Section */}
              <section>
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-violet-900/20 text-violet-400 rounded-xl">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Anthropic API Key</h2>
                    <p className="text-sm text-gray-500">Used for Claude AI integrations.</p>
                  </div>
                </div>
                <div className="ml-16">
                  <label className="block text-sm font-medium text-gray-600 mb-2">API Key</label>
                  <input
                    type="password"
                    value={formData.anthropic_api_key}
                    onChange={(e) => setFormData({ ...formData, anthropic_api_key: e.target.value })}
                    placeholder="sk-ant-..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                  />
                  <p className="mt-2 text-xs text-gray-500">Stored securely server-side and never exposed to the browser.</p>
                </div>
              </section>

              <div className="border-t border-gray-200"></div>

              {/* Global Notification Section */}
              <section>
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-amber-900/20 text-amber-400 rounded-xl">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Global Notification</h2>
                    <p className="text-sm text-gray-500">Display a service status bar on all client dashboards.</p>
                  </div>
                </div>
                
                <div className="ml-16 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Notification Message</label>
                    <input
                      type="text"
                      value={formData.global_notification}
                      onChange={(e) => setFormData({ ...formData, global_notification: e.target.value })}
                      placeholder="e.g. Google Analytics is currently experiencing delays."
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Notification Icon</label>
                    <select
                      value={formData.global_notification_icon}
                      onChange={(e) => setFormData({ ...formData, global_notification_icon: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                    >
                      <option value="AlertCircle">Alert Circle</option>
                      <option value="Info">Info</option>
                      <option value="CheckCircle">Check Circle</option>
                      <option value="AlertTriangle">Alert Triangle</option>
                      <option value="Zap">Zap</option>
                      <option value="Megaphone">Megaphone</option>
                      <option value="Bell">Bell</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Banner Colour</label>
                    <div className="flex gap-3">
                      {[
                        { value: 'green',  bg: '#15803d', label: 'Green'  },
                        { value: 'yellow', bg: '#b45309', label: 'Yellow' },
                        { value: 'red',    bg: '#b91c1c', label: 'Red'    },
                      ].map(({ value, bg, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setFormData({ ...formData, global_notification_color: value })}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                            formData.global_notification_color === value
                              ? 'border-gray-900 shadow-md scale-105'
                              : 'border-gray-200 hover:border-gray-400'
                          }`}
                        >
                          <span className="w-4 h-4 rounded-full inline-block" style={{ backgroundColor: bg }} />
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      All colours meet WCAG AA contrast standards with white text.
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Leave message blank to remove the notification banner.
                  </p>
                </div>
              </section>

              <div className="border-t border-gray-200"></div>

              {/* Uptime Kuma Section */}
              <section>
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-emerald-900/20 text-emerald-500 rounded-xl">
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Uptime Kuma</h2>
                    <p className="text-sm text-gray-500">Authenticated connection to your self-hosted Uptime Kuma instance for private monitor data.</p>
                  </div>
                </div>
                <div className="ml-16 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Instance URL</label>
                    <input
                      type="url"
                      value={formData.uptime_kuma_url}
                      onChange={(e) => setFormData({ ...formData, uptime_kuma_url: e.target.value })}
                      placeholder="https://status.stokecloud.dev"
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">Username</label>
                      <input
                        type="text"
                        autoComplete="off"
                        value={formData.uptime_kuma_username}
                        onChange={(e) => setFormData({ ...formData, uptime_kuma_username: e.target.value })}
                        placeholder="admin"
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">Password</label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={formData.uptime_kuma_password}
                        onChange={(e) => setFormData({ ...formData, uptime_kuma_password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Connects via Socket.IO using these credentials. Monitors are matched per-client by a <strong>Monitor Name Filter</strong> configured in Admin — no public status page required.
                  </p>
                </div>
              </section>

              <div className="border-t border-gray-200"></div>

              {/* Webhooks Section */}
              <section>
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-indigo-900/20 text-indigo-400 rounded-xl">
                    <Share2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Webhooks</h2>
                    <p className="text-sm text-gray-500">Connect to n8n or other automation tools with bidirectional webhooks.</p>
                  </div>
                </div>
                <div className="ml-16 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Outbound Webhook URL</label>
                    <input
                      type="url"
                      value={formData.webhook_url}
                      onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                      placeholder="https://n8n.example.com/webhook/abc123"
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">Outbound Secret</label>
                      <input
                        type="password"
                        value={formData.webhook_secret}
                        onChange={(e) => setFormData({ ...formData, webhook_secret: e.target.value })}
                        placeholder="Sent as X-Webhook-Secret header"
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">Inbound Token</label>
                      <input
                        type="password"
                        value={formData.webhook_inbound_token}
                        onChange={(e) => setFormData({ ...formData, webhook_inbound_token: e.target.value })}
                        placeholder="Required as X-Webhook-Token header"
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Enabled Outbound Events</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['client.created', 'client.updated', 'psi.completed', 'uptime.alert', 'report.viewed', 'report.emailed'] as const).map(evt => {
                        let enabled: string[] = [];
                        try { enabled = JSON.parse(formData.webhook_events_enabled); } catch {}
                        const checked = enabled.includes(evt);
                        return (
                          <label key={evt} className="flex items-center gap-2 p-2 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                let next = [...enabled];
                                if (e.target.checked) next.push(evt);
                                else next = next.filter(x => x !== evt);
                                setFormData({ ...formData, webhook_events_enabled: JSON.stringify(next) });
                              }}
                              className="w-4 h-4 text-gray-900 rounded border-gray-300 focus:ring-gray-900"
                            />
                            <code className="text-xs text-gray-700">{evt}</code>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    <strong>Inbound:</strong> POST to <code className="bg-gray-100 px-1 rounded">/api/webhook</code> with <code className="bg-gray-100 px-1 rounded">X-Webhook-Token</code> header. Actions: <code className="bg-gray-100 px-1 rounded">refresh_psi</code>, <code className="bg-gray-100 px-1 rounded">update_client</code>, <code className="bg-gray-100 px-1 rounded">post_notification</code>.
                  </p>
                </div>
              </section>

              <div className="border-t border-gray-200"></div>

              {/* HubSpot CRM Section */}
              <section>
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-orange-900/20 text-orange-400 rounded-xl">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">HubSpot CRM</h2>
                    <p className="text-sm text-gray-500">Sync subscription records — push report URLs to HubSpot and pull care plan data back automatically.</p>
                  </div>
                </div>
                <div className="ml-16 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Private App Access Token</label>
                    <input
                      type="password"
                      value={formData.hubspot_access_token}
                      onChange={(e) => setFormData({ ...formData, hubspot_access_token: e.target.value })}
                      placeholder="pat-api1-..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Client Secret</label>
                    <input
                      type="password"
                      value={formData.hubspot_client_secret}
                      onChange={(e) => setFormData({ ...formData, hubspot_client_secret: e.target.value })}
                      placeholder="••••••••-••••-••••-••••-••••••••••••"
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Create a Private App in HubSpot Settings → Integrations. Copy the <strong>Access Token</strong> and <strong>Client Secret</strong> from the app credentials page. Subscription records are matched by the <code className="bg-gray-100 px-1 rounded">website_url</code> property. The report URL is pushed to <code className="bg-gray-100 px-1 rounded">report_url</code> and the care plan is synced back whenever a client dashboard is viewed or a manual sync is triggered.
                  </p>
                </div>
              </section>

              <div className="border-t border-gray-200"></div>

              {/* MainWP Section */}
              <section>
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-blue-900/20 text-blue-400 rounded-xl">
                    <Server className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">MainWP</h2>
                    <p className="text-sm text-gray-500">Pull WordPress site data (plugin/theme updates, WP version) from your MainWP dashboard.</p>
                  </div>
                </div>
                <div className="ml-16 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">MainWP Dashboard URL</label>
                    <input
                      type="url"
                      value={formData.mainwp_url}
                      onChange={(e) => setFormData({ ...formData, mainwp_url: e.target.value })}
                      placeholder="https://manage.example.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">API Key</label>
                    <input
                      type="password"
                      value={formData.mainwp_api_key}
                      onChange={(e) => setFormData({ ...formData, mainwp_api_key: e.target.value })}
                      placeholder="Your MainWP REST API key"
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Generate your API key under <strong>MainWP → Settings → REST API</strong>. Set the <strong>MainWP Site ID</strong> per client in Admin to activate the Website Statistics and Updates pages.
                  </p>
                </div>
              </section>

              <div className="border-t border-gray-200"></div>

              {/* Email Notifications Section */}
              <section>
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-sky-900/20 text-sky-400 rounded-xl">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Email Notifications (Postmark)</h2>
                    <p className="text-sm text-gray-500">Send monthly performance report emails to clients via Postmark SMTP.</p>
                  </div>
                </div>
                <div className="ml-16 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Postmark Server Token</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={formData.postmark_server_token}
                      onChange={(e) => setFormData({ ...formData, postmark_server_token: e.target.value })}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">From Email Address</label>
                      <input
                        type="text"
                        value={formData.smtp_from_email}
                        onChange={(e) => setFormData({ ...formData, smtp_from_email: e.target.value })}
                        placeholder="reports@yourdomain.com"
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">From Name</label>
                      <input
                        type="text"
                        value={formData.smtp_from_name}
                        onChange={(e) => setFormData({ ...formData, smtp_from_name: e.target.value })}
                        placeholder="Stoke Design"
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Reply-To Address <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      type="text"
                      value={formData.smtp_reply_to}
                      onChange={(e) => setFormData({ ...formData, smtp_reply_to: e.target.value })}
                      placeholder="hello@yourdomain.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                    />
                    <p className="mt-1 text-xs text-gray-500">When clients reply to report emails, replies will go to this address instead of the From address.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Daily Send Time</label>
                    <select
                      value={formData.report_send_hour ?? '9'}
                      onChange={(e) => setFormData({ ...formData, report_send_hour: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none bg-white"
                    >
                      {Array.from({ length: 24 }, (_, i) => {
                        const label = i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`;
                        return <option key={i} value={String(i)}>{label}</option>;
                      })}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">Automated monthly reports are dispatched at this hour each day (server local time). Default: 9:00 AM.</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    Find your Server Token in Postmark → Servers → your server → API Tokens. The email address must be a verified sender in Postmark. Monthly emails are sent automatically on each client's configured send date.
                  </p>
                  <div className="pt-2">
                    <label className="block text-sm font-medium text-gray-600 mb-2">Send Test Email</label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={testEmailTo}
                        onChange={(e) => { setTestEmailTo(e.target.value); setTestEmailResult(null); }}
                        placeholder="you@example.com"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleSendTestEmail}
                        disabled={sendingTestEmail || !testEmailTo}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                      >
                        {sendingTestEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                        Send Test
                      </button>
                    </div>
                    {testEmailResult && (
                      <p className={`mt-2 text-xs ${testEmailResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                        {testEmailResult.ok ? '✓ ' : '✗ '}{testEmailResult.msg}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <div className="border-t border-gray-200"></div>

              {/* Data Management Section */}
              <section>
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-purple-900/20 text-purple-400 rounded-xl">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Data Management</h2>
                    <p className="text-sm text-gray-500">Export all clients, import from CSV, or download the import template.</p>
                  </div>
                </div>

                <div className="ml-16 flex gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={exportClientsCSV}
                    className="flex items-center px-4 py-2 bg-white text-gray-600 border border-gray-200 rounded-xl font-medium hover:bg-gray-100 transition-colors text-sm"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Clients
                  </button>
                  <button
                    type="button"
                    onClick={downloadTemplateCSV}
                    className="flex items-center px-4 py-2 bg-white text-gray-600 border border-gray-200 rounded-xl font-medium hover:bg-gray-100 transition-colors text-sm"
                  >
                    <FileJson className="w-4 h-4 mr-2" />
                    Download Template
                  </button>
                  <label className="flex items-center px-4 py-2 bg-white text-gray-600 border border-gray-200 rounded-xl font-medium hover:bg-gray-100 transition-colors cursor-pointer text-sm">
                    {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    Import CSV
                    <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} disabled={importing} />
                  </label>
                </div>
              </section>

              <div className="pt-6 border-t border-gray-200 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center shadow-none"
                >
                  {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                  Save Settings
                </button>
              </div>
            </form>
          )}
        </div>
        </div>
      </div>

      {importReviewModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-none max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-semibold text-gray-900">Review CSV Import</h2>
              <button onClick={() => setImportReviewModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <p className="text-gray-500 mb-2">
                  We found <strong>{importNewClients.length}</strong> new clients to import and <strong>{importConflicts.length}</strong> existing clients that match the imported slugs.
                </p>
                <div className="bg-amber-900/20 border border-amber-900/50 rounded-xl p-4 mt-4">
                  <h3 className="text-amber-200 font-medium mb-2">How should we handle existing clients?</h3>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="importAction"
                        value="skip"
                        checked={importAction === 'skip'}
                        onChange={() => setImportAction('skip')}
                        className="text-gray-900 focus:ring-gray-900"
                      />
                      <span className="text-gray-600">Skip existing clients (only import new ones)</span>
                    </label>
                    <label className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="importAction"
                        value="overwrite"
                        checked={importAction === 'overwrite'}
                        onChange={() => setImportAction('overwrite')}
                        className="text-gray-900 focus:ring-gray-900"
                      />
                      <span className="text-gray-600">Overwrite existing clients with imported data</span>
                    </label>
                  </div>
                </div>
              </div>

              {importConflicts.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Conflicting Clients</h3>
                  <div className="space-y-3">
                    {importConflicts.map((conflict, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium text-gray-900">{conflict.imported.name}</span>
                          <span className="text-xs bg-gray-200 text-gray-500 px-2 py-1 rounded-full">{conflict.imported.slug}</span>
                        </div>
                        <div className="text-sm text-gray-500 grid grid-cols-2 gap-2">
                          <div>
                            <span className="block text-xs font-medium text-gray-400 mb-1">Current Data</span>
                            <div className="truncate" title={conflict.existing.website_url || 'N/A'}>URL: {conflict.existing.website_url || 'N/A'}</div>
                          </div>
                          <div>
                            <span className="block text-xs font-medium text-gray-400 mb-1">Imported Data</span>
                            <div className="truncate" title={conflict.imported.website_url || 'N/A'}>URL: {conflict.imported.website_url || 'N/A'}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button
                type="button"
                onClick={() => setImportReviewModalOpen(false)}
                className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                disabled={importing}
              >
                Cancel
              </button>
              <button
                onClick={() => executeImport(importNewClients, importAction === 'overwrite' ? importConflicts.map(c => c.imported) : [])}
                disabled={importing}
                className="px-4 py-2 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center"
              >
                {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirm Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
