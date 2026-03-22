import React, { useState, useEffect } from 'react';

const generateRandomSlug = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};
import { Link } from 'react-router-dom';
import { Plus, Edit2, Trash2, ExternalLink, LogOut, Loader2, Settings, Search, Users, CheckCircle2, XCircle, RefreshCw, Mail, Send, Activity } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuth } from '../App';
import { authFetch } from '../authFetch';

interface Client {
  id: number;
  client_id_number: string | null;
  name: string;
  slug: string;
  website_url: string | null;
  enabled_pages: string | null;
  ga_property_id: string | null;
  gsc_site_url: string | null;
  psi_url: string | null;
  uptime_kuma_slug: string | null;
  mainwp_site_id: string | null;
  care_plan: string | null;
  contact_email: string | null;
  first_name: string | null;
  last_name: string | null;
  next_send_date: string | null;
  hubspot_record_id: string | null;
  email_notifications: number;
  is_active: number;
}

interface EmailLog {
  id: string;
  client_id: string;
  client_name: string;
  website_url: string | null;
  recipient_email: string;
  subject: string;
  status: 'sent' | 'failed';
  error: string | null;
  created_at: string;
}

export default function Admin() {
  const { signOut } = useAuth();

  useEffect(() => {
    document.title = 'Admin | Stoke Design Website Reporter';
  }, []);

  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedClients, setSelectedClients] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [formData, setFormData] = useState({
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
    email_notifications: 1,
    is_active: 1,
  });

  const [activeTab, setActiveTab] = useState<'clients' | 'email-log' | 'activity-log'>('clients');

  // Email log
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [emailLogsLoading, setEmailLogsLoading] = useState(false);

  // Activity log
  interface ActivityEntry {
    id: string;
    timestamp: string;
    type: 'psi' | 'ga' | 'gsc' | 'hubspot' | 'email' | 'mainwp' | 'system';
    status: 'success' | 'error' | 'info' | 'warn';
    message: string;
    client?: string;
  }
  const [activityLogs, setActivityLogs] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState<number | null>(null);

  // Send Report Now state (inside edit modal)
  const [sendingReport, setSendingReport] = useState(false);
  const [sendReportStatus, setSendReportStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const fetchEmailLogs = async () => {
    setEmailLogsLoading(true);
    try {
      const res = await authFetch('/api/admin/email-logs');
      if (!res.ok) throw new Error('Failed to fetch email logs');
      const data = await res.json();
      setEmailLogs(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEmailLogsLoading(false);
    }
  };

  const fetchActivityLogs = async () => {
    setActivityLoading(true);
    try {
      const res = await authFetch('/api/admin/activity-logs');
      if (!res.ok) throw new Error('Failed to fetch activity logs');
      setActivityLogs(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActivityLoading(false);
    }
  };

  const handleSendTestEmail = async (clientId: number) => {
    setSendingTestEmail(clientId);
    try {
      const res = await authFetch(`/api/admin/clients/${clientId}/send-test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: 'Last 30 Days' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send report');
      alert(`Report sent successfully to ${data.sentTo}`);
      if (activeTab === 'email-log') fetchEmailLogs();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSendingTestEmail(null);
    }
  };

  // Send Report Now — called from inside the edit modal with period = "Last 30 Days"
  const handleSendReportNow = async (clientId: string) => {
    setSendingReport(true);
    setSendReportStatus(null);
    try {
      const res = await authFetch(`/api/admin/clients/${clientId}/send-test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: 'Last 30 Days' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send report');
      setSendReportStatus({ ok: true, msg: `Report sent to ${data.sentTo}` });
    } catch (err: any) {
      setSendReportStatus({ ok: false, msg: err.message });
    } finally {
      setSendingReport(false);
    }
  };

  const [hubspotSyncing, setHubspotSyncing] = useState(false);
  const [hubspotSyncMsg, setHubspotSyncMsg] = useState('');
  const [hubspotSyncAllRunning, setHubspotSyncAllRunning] = useState(false);
  const [hubspotSyncAllMsg, setHubspotSyncAllMsg] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/clients');
      if (!res.ok) {
        throw new Error('Failed to fetch clients');
      }
      const data = await res.json();
      setClients(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (client?: Client) => {
    setSendReportStatus(null); // reset send status whenever modal opens
    if (client) {
      setEditingClient(client);
      setIsSlugManuallyEdited(true); // Don't auto-update slug for existing clients
      setFormData({
        client_id_number: client.client_id_number || '',
        name: client.name,
        slug: client.slug,
        website_url: client.website_url || '',

        enabled_pages: client.enabled_pages || '[1,2,3,4,5,6,7,8,9]',
        ga_property_id: client.ga_property_id || '',
        gsc_site_url: client.gsc_site_url || '',
        psi_url: client.psi_url || '',
        uptime_kuma_slug: client.uptime_kuma_slug || '',
        mainwp_site_id: client.mainwp_site_id || '',
        care_plan: client.care_plan || '',
        contact_email: client.contact_email || '',
        first_name: client.first_name || '',
        last_name: client.last_name || '',
        next_send_date: client.next_send_date || '',
        hubspot_record_id: client.hubspot_record_id || '',
        email_notifications: client.email_notifications ?? 1,
        is_active: client.is_active,
      });
    } else {
      setEditingClient(null);
      setIsSlugManuallyEdited(false);
      setFormData({
        client_id_number: '',
        name: '',
        slug: generateRandomSlug(),
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
        email_notifications: 1,
        is_active: 1,
      });
    }
    setHubspotSyncMsg('');
    setIsModalOpen(true);
  };

  const [showGASites, setShowGASites] = useState(false);
  const [gaSites, setGaSites] = useState<any[]>([]);
  const [loadingGASites, setLoadingGASites] = useState(false);

  const [showGSCSites, setShowGSCSites] = useState(false);
  const [gscSites, setGscSites] = useState<any[]>([]);
  const [loadingGSCSites, setLoadingGSCSites] = useState(false);

  const fetchGASites = async () => {
    setLoadingGASites(true);
    try {
      const res = await authFetch('/api/admin/google/ga-properties');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch GA properties');
      setGaSites(data);
      setShowGASites(true);
    } catch (err: any) {
      alert('Error fetching GA properties: ' + err.message);
    } finally {
      setLoadingGASites(false);
    }
  };

  const fetchGSCSites = async () => {
    setLoadingGSCSites(true);
    try {
      const res = await authFetch('/api/admin/google/gsc-sites');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch GSC sites');
      setGscSites(data);
      setShowGSCSites(true);
    } catch (err: any) {
      alert('Error fetching GSC sites: ' + err.message);
    } finally {
      setLoadingGSCSites(false);
    }
  };

  const handleSyncAllHubSpot = async () => {
    setHubspotSyncAllRunning(true);
    setHubspotSyncAllMsg('Syncing...');
    try {
      const res = await authFetch('/api/admin/hubspot-sync-all', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setHubspotSyncAllMsg(`✓ ${data.synced} synced, ${data.skipped} skipped, ${data.errors} errors`);
      await fetchClients(); // Refresh to show updated sync status
    } catch (err: any) {
      setHubspotSyncAllMsg('✗ ' + err.message);
    } finally {
      setHubspotSyncAllRunning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = editingClient ? `/api/admin/clients/${editingClient.id}` : '/api/admin/clients';
      const method = editingClient ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to save client');
      }
      
      await fetchClients();
      setIsModalOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this client?')) return;
    setLoading(true);
    try {
      const res = await authFetch(`/api/admin/clients/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete client');
      await fetchClients();
      setSelectedClients(prev => prev.filter(clientId => clientId !== id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedClients.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedClients.length} client(s)?`)) return;
    setLoading(true);
    try {
      for (const id of selectedClients) {
        await authFetch(`/api/admin/clients/${id}`, {
          method: 'DELETE',
        });
      }
      await fetchClients();
      setSelectedClients([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (client: Client) => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/admin/clients/${client.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...client, is_active: client.is_active === 1 ? 0 : 1 }),
      });
      if (!res.ok) throw new Error('Failed to update client status');
      await fetchClients();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkActiveStatus = async (isActive: number) => {
    if (selectedClients.length === 0) return;
    setLoading(true);
    try {
      for (const id of selectedClients) {
        const client = clients.find(c => c.id === id);
        if (client) {
          await authFetch(`/api/admin/clients/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ...client, is_active: isActive }),
          });
        }
      }
      await fetchClients();
      setSelectedClients([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (client.website_url && client.website_url.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (statusFilter === 'active') return matchesSearch && client.is_active === 1;
    if (statusFilter === 'inactive') return matchesSearch && client.is_active === 0;
    return matchesSearch;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const paginatedClients = filteredClients.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSelectAllCurrentPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const currentPageIds = paginatedClients.map(c => c.id);
      const newSelected = new Set([...selectedClients, ...currentPageIds]);
      setSelectedClients(Array.from(newSelected));
    } else {
      const currentPageIds = paginatedClients.map(c => c.id);
      setSelectedClients(selectedClients.filter(id => !currentPageIds.includes(id)));
    }
  };

  const isCurrentPageAllSelected = paginatedClients.length > 0 && paginatedClients.every(c => selectedClients.includes(c.id));

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
          <div className="pt-1">
            <Logo className="h-10 text-gray-900" />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-full focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-sm"
              />
            </div>
            <div className="flex gap-2 items-center">
              <Link
                to="/admin/settings"
                className="flex items-center justify-center w-10 h-10 bg-white text-gray-600 border border-gray-200 rounded-full hover:bg-gray-100 transition-colors"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </Link>
              <button
                onClick={() => openModal()}
                className="flex items-center justify-center w-10 h-10 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors"
                title="Add Client"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button
                onClick={async () => { await signOut(); window.location.href = '/login'; }}
                className="flex items-center justify-center w-10 h-10 bg-white text-gray-400 border border-gray-200 rounded-full hover:bg-gray-100 hover:text-gray-600 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-none border border-gray-200">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-medium text-gray-500">Total Clients</h3>
              <Users className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-3xl font-semibold text-gray-900">{clients.length}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-none border border-gray-200">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-medium text-gray-500">Active</h3>
              <CheckCircle2 className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-3xl font-semibold text-gray-900">{clients.filter(c => c.is_active === 1).length}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-none border border-gray-200">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-medium text-gray-500">Inactive</h3>
              <XCircle className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-3xl font-semibold text-gray-900">{clients.filter(c => c.is_active === 0).length}</p>
          </div>
        </div>

        {selectedClients.length > 0 && (
          <div className="mb-6 p-4 bg-gray-100 border border-gray-300 rounded-xl flex flex-wrap items-center justify-between gap-4">
            <span className="text-gray-900 font-medium">{selectedClients.length} client(s) selected</span>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkActiveStatus(1)}
                className="flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors text-sm"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Set Active
              </button>
              <button
                onClick={() => handleBulkActiveStatus(0)}
                className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors text-sm"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Set Inactive
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors text-sm"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected
              </button>
            </div>
          </div>
        )}

        {error && <div className="mb-6 p-4 bg-red-900/20 text-red-400 rounded-xl">{error}</div>}

        {/* Tab bar */}
        <div className="flex gap-1 mb-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('clients')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors -mb-px border-b-2 ${
              activeTab === 'clients' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4 inline mr-1.5" />
            Clients
          </button>
          <button
            onClick={() => { setActiveTab('email-log'); fetchEmailLogs(); }}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors -mb-px border-b-2 ${
              activeTab === 'email-log' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Mail className="w-4 h-4 inline mr-1.5" />
            Email Log
          </button>
          <button
            onClick={() => { setActiveTab('activity-log'); fetchActivityLogs(); }}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors -mb-px border-b-2 ${
              activeTab === 'activity-log' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Activity className="w-4 h-4 inline mr-1.5" />
            Activity Log
          </button>
        </div>

        {activeTab === 'email-log' && (
          <div className="bg-white rounded-2xl shadow-none border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Email Send History</h3>
                {emailLogs.length > 0 && <p className="text-xs text-gray-400 mt-0.5">Last {emailLogs.length} emails</p>}
              </div>
              <button
                onClick={fetchEmailLogs}
                className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            {emailLogsLoading ? (
              <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
            ) : emailLogs.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">No emails sent yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                      <th className="p-4 font-medium w-44">Time</th>
                      <th className="p-4 font-medium">Client</th>
                      <th className="p-4 font-medium">Recipient</th>
                      <th className="p-4 font-medium">Subject</th>
                      <th className="p-4 font-medium w-20">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emailLogs.map(log => (
                      <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="p-4 text-gray-400 text-xs whitespace-nowrap font-mono">
                          {new Date(log.created_at).toLocaleString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                        </td>
                        <td className="p-4 text-gray-600 text-xs">{log.client_name}</td>
                        <td className="p-4 text-gray-600 text-xs">{log.recipient_email}</td>
                        <td className="p-4 text-gray-700 text-xs max-w-xs truncate" title={log.subject}>{log.subject}</td>
                        <td className="p-4">
                          {log.status === 'sent' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                              Sent
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 cursor-help"
                              title={log.error || ''}
                            >
                              Failed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity-log' && (
          <div className="bg-white rounded-2xl shadow-none border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Activity Log</h3>
                <p className="text-xs text-gray-400 mt-0.5">Last {activityLogs.length} events — resets on server restart</p>
              </div>
              <button
                onClick={fetchActivityLogs}
                className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            {activityLoading ? (
              <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
            ) : activityLogs.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">No activity yet — logs appear once background jobs run.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                      <th className="p-4 font-medium w-44">Time</th>
                      <th className="p-4 font-medium w-24">Type</th>
                      <th className="p-4 font-medium w-20">Status</th>
                      <th className="p-4 font-medium">Client</th>
                      <th className="p-4 font-medium">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityLogs.map(entry => {
                      const typeColors: Record<string, string> = {
                        psi:     'bg-purple-50 text-purple-700',
                        ga:      'bg-blue-50 text-blue-700',
                        gsc:     'bg-indigo-50 text-indigo-700',
                        hubspot: 'bg-orange-50 text-orange-700',
                        email:   'bg-pink-50 text-pink-700',
                        mainwp:  'bg-teal-50 text-teal-700',
                        system:  'bg-gray-100 text-gray-600',
                      };
                      const statusConfig: Record<string, { cls: string; label: string }> = {
                        success: { cls: 'bg-emerald-50 text-emerald-700', label: 'OK' },
                        error:   { cls: 'bg-red-50 text-red-600',         label: 'Error' },
                        warn:    { cls: 'bg-amber-50 text-amber-700',     label: 'Warn' },
                        info:    { cls: 'bg-sky-50 text-sky-700',         label: 'Info' },
                      };
                      const sc = statusConfig[entry.status] || statusConfig.info;
                      const typeLabel = entry.type.toUpperCase();
                      return (
                        <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="p-4 text-gray-400 text-xs whitespace-nowrap font-mono">
                            {new Date(entry.timestamp).toLocaleString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${typeColors[entry.type] || 'bg-gray-100 text-gray-600'}`}>
                              {typeLabel}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sc.cls}`}>
                              {sc.label}
                            </span>
                          </td>
                          <td className="p-4 text-gray-600 text-xs">{entry.client || <span className="text-gray-300">—</span>}</td>
                          <td className="p-4 text-gray-700 text-xs">{entry.message}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'clients' && <div className="bg-white rounded-2xl shadow-none border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSyncAllHubSpot}
                disabled={hubspotSyncAllRunning}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                {hubspotSyncAllRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Sync All HubSpot
              </button>
              {hubspotSyncAllMsg && (
                <span className={`text-xs ${hubspotSyncAllMsg.startsWith('✓') ? 'text-emerald-600' : hubspotSyncAllMsg.startsWith('✗') ? 'text-red-600' : 'text-gray-500'}`}>
                  {hubspotSyncAllMsg}
                </span>
              )}
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                <th className="p-4 w-12">
                  <input
                    type="checkbox"
                    checked={isCurrentPageAllSelected}
                    onChange={handleSelectAllCurrentPage}
                    className="w-4 h-4 text-gray-900 rounded border-gray-300 focus:ring-gray-900"
                  />
                </th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Client Name</th>
                <th className="p-4 font-medium">Slug / Link</th>
                <th className="p-4 font-medium">Configured Data</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    {searchQuery ? 'No clients match your search.' : 'No clients found. Add one to get started.'}
                  </td>
                </tr>
              ) : (
                paginatedClients.map((client) => (
                  <tr key={client.id} className={`border-b border-gray-200 hover:bg-gray-100 transition-colors ${client.is_active === 0 ? 'opacity-60' : ''}`}>
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedClients.includes(client.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedClients([...selectedClients, client.id]);
                          } else {
                            setSelectedClients(selectedClients.filter(id => id !== client.id));
                          }
                        }}
                        className="w-4 h-4 text-gray-900 rounded border-gray-300 focus:ring-gray-900"
                      />
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => handleToggleActive(client)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 ${
                          client.is_active === 1 ? 'bg-gray-900' : 'bg-gray-300'
                        }`}
                        title={client.is_active === 1 ? 'Set Inactive' : 'Set Active'}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                            client.is_active === 1 ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="p-4 font-medium text-gray-900">{client.name}</td>
                    <td className="p-4 text-gray-500">
                      <Link to={`/${client.slug}`} target="_blank" className="flex items-center hover:text-gray-900 transition-colors">
                        /{client.slug}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Link>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        {client.ga_property_id && <span className="px-2 py-1 bg-blue-900/20 text-xs rounded-md font-medium" style={{color:'#1a8af1'}}>GA</span>}
                        {client.gsc_site_url && <span className="px-2 py-1 bg-purple-900/20 text-purple-700 text-xs rounded-md font-medium">GSC</span>}
                        {client.psi_url && <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-md font-medium">PSI</span>}
                        {client.uptime_kuma_slug && <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-md font-medium">Uptime</span>}
                        {client.website_url && client.care_plan && (() => {
                          const cp = client.care_plan.toLowerCase();
                          const chipClass = cp.startsWith('pink') ? 'bg-pink-400' : cp.startsWith('black') ? 'bg-gray-900' : 'bg-white border border-gray-300';
                          return (
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-md font-medium flex items-center gap-1.5" title={`Synced — Care Plan: ${client.care_plan}`}>
                              <CheckCircle2 className="w-3 h-3" />
                              HubSpot
                              <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${chipClass}`} />
                            </span>
                          );
                        })()}
                        {client.website_url && !client.care_plan && (
                          <span className="px-2 py-1 bg-orange-50 text-orange-600 border border-orange-200 text-xs rounded-md font-medium flex items-center gap-1" title="Not synced — no care plan pulled">
                            <XCircle className="w-3 h-3" />HubSpot
                          </span>
                        )}
                        {client.mainwp_site_id && <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md font-medium">MainWP</span>}
                        {!client.ga_property_id && !client.gsc_site_url && !client.psi_url && !client.uptime_kuma_slug && !client.website_url && !client.mainwp_site_id && (
                          <span className="text-gray-400 text-sm italic">None</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => openModal(client)}
                        className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(client.id)}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors ml-2"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          
          {/* Pagination Controls */}
          <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Show</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-gray-300 rounded px-2 py-1 focus:ring-gray-900 focus:border-gray-900 outline-none bg-white"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>per page</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500 mr-2">
                Showing {filteredClients.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredClients.length)} of {filteredClients.length}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-none max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingClient ? 'Edit Client' : 'Add New Client'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Client Name *</label>
                    <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">URL Slug *</label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => {
                      setFormData({ ...formData, slug: e.target.value });
                      setIsSlugManuallyEdited(true);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Website URL</label>
                  <input
                    type="url"
                    value={formData.website_url}
                    onChange={(e) => {
                      const newUrl = e.target.value;
                      const prevDomain = prev => prev.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
                      const newDomain = newUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
                      setFormData(prev => ({
                        ...prev,
                        website_url: newUrl,
                        psi_url: (prev.psi_url === prev.website_url || !prev.psi_url) ? newUrl : prev.psi_url,
                        uptime_kuma_slug: (prev.uptime_kuma_slug === prevDomain(prev) || !prev.uptime_kuma_slug) ? newDomain : prev.uptime_kuma_slug,
                      }));
                    }}
                    placeholder="https://www.example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Care Plan</label>
                  <div className="flex items-center gap-2">
                    {formData.care_plan && (
                      <span className={`inline-block w-4 h-4 rounded-full shrink-0 ${
                        formData.care_plan.toLowerCase().startsWith('pink')  ? 'bg-pink-400' :
                        formData.care_plan.toLowerCase().startsWith('black') ? 'bg-gray-900' :
                        formData.care_plan.toLowerCase().startsWith('white') ? 'bg-white border-2 border-gray-300' : ''
                      }`} />
                    )}
                    <select
                      value={formData.care_plan}
                      onChange={e => setFormData({ ...formData, care_plan: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    >
                      <option value="">Not set</option>
                      <option value="Pink Plan">Pink Plan</option>
                      <option value="White Plan">White Plan</option>
                      <option value="Black Plan">Black Plan</option>
                    </select>
                  </div>
                </div>
                <div className="md:col-span-2 flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Active Client</h3>
                    <p className="text-xs text-gray-500">Inactive clients will not be visible on the dashboard.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_active: formData.is_active === 1 ? 0 : 1 })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 ${
                      formData.is_active === 1 ? 'bg-gray-900' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.is_active === 1 ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>


              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Enabled Pages</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 1, name: 'Report Overview' },
                    { id: 2, name: 'Website Analytics' },
                    { id: 3, name: 'Traffic Sources' },
                    { id: 4, name: 'Pages & Landing Pages' },
                    { id: 5, name: 'Website Events' },
                    { id: 6, name: 'Search Performance' },
                    { id: 7, name: 'Page Speed' },
                    { id: 8, name: 'Uptime Monitor' },
                    { id: 9, name: 'WP Updates & Stats' },
                  ].map(page => {
                    let enabledPages: number[] = [];
                    try {
                      enabledPages = JSON.parse(formData.enabled_pages || '[]');
                    } catch (e) {
                      console.error('Failed to parse enabled_pages', e);
                    }
                    const isEnabled = enabledPages.includes(page.id);
                    return (
                      <label key={page.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => {
                            let newPages = [...enabledPages];
                            if (e.target.checked) {
                              newPages.push(page.id);
                            } else {
                              newPages = newPages.filter(id => id !== page.id);
                            }
                            setFormData({ ...formData, enabled_pages: JSON.stringify(newPages) });
                          }}
                          className="w-4 h-4 text-gray-900 rounded border-gray-300 focus:ring-gray-900"
                        />
                        <span className="text-sm font-medium text-gray-600">
                          {page.name} <span className="text-gray-400 text-xs ml-1">(ID: {page.id})</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Google Analytics</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">GA4 Property ID</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.ga_property_id}
                      onChange={(e) => setFormData({ ...formData, ga_property_id: e.target.value })}
                      placeholder="e.g. 123456789"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={fetchGASites}
                      disabled={loadingGASites}
                      className="px-3 py-2 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 hover:text-gray-900 transition-colors text-sm font-medium whitespace-nowrap"
                    >
                      {loadingGASites ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Browse'}
                    </button>
                  </div>
                  {showGASites && (
                    <div className="mt-2 p-2 border border-gray-200 rounded-xl max-h-40 overflow-y-auto bg-gray-50">
                      {gaSites.length === 0 ? (
                        <p className="text-xs text-gray-500 p-2">No properties found. Check Service Account permissions.</p>
                      ) : (
                        gaSites.map((site: any) => (
                          <button
                            key={site.id}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, ga_property_id: site.id });
                              setShowGASites(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 hover:shadow-none rounded-lg text-sm transition-all flex justify-between items-center group"
                          >
                            <span className="font-medium text-gray-600">{site.name}</span>
                            <span className="text-xs text-gray-400 group-hover:text-gray-500">{site.id}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Google Search Console</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Site URL</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.gsc_site_url}
                      onChange={(e) => setFormData({ ...formData, gsc_site_url: e.target.value })}
                      placeholder="e.g. https://www.example.com/ or sc-domain:example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={fetchGSCSites}
                      disabled={loadingGSCSites}
                      className="px-3 py-2 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 hover:text-gray-900 transition-colors text-sm font-medium whitespace-nowrap"
                    >
                      {loadingGSCSites ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Browse'}
                    </button>
                  </div>
                  {showGSCSites && (
                    <div className="mt-2 p-2 border border-gray-200 rounded-xl max-h-40 overflow-y-auto bg-gray-50">
                      {gscSites.length === 0 ? (
                        <p className="text-xs text-gray-500 p-2">No sites found. Check Service Account permissions.</p>
                      ) : (
                        gscSites.map((site: any) => (
                          <button
                            key={site.siteUrl}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, gsc_site_url: site.siteUrl });
                              setShowGSCSites(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 hover:shadow-none rounded-lg text-sm transition-all flex flex-col group"
                          >
                            <span className="font-medium text-gray-600">{site.siteUrl}</span>
                            <span className="text-xs text-gray-400 group-hover:text-gray-500">Permission: {site.permissionLevel}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">PageSpeed Insights</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">URL to Test</label>
                  <input
                    type="text"
                    value={formData.psi_url}
                    onChange={(e) => setFormData({ ...formData, psi_url: e.target.value })}
                    placeholder="e.g. https://www.example.com/"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Uptime Monitoring</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Monitor Name Filter</label>
                  <input
                    type="text"
                    value={formData.uptime_kuma_slug}
                    onChange={(e) => setFormData({ ...formData, uptime_kuma_slug: e.target.value })}
                    placeholder="e.g. stokedesign.co"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">Auto-filled from Website URL (domain only, no protocol). Matched case-insensitively against Uptime Kuma monitor names — e.g. <code className="bg-gray-100 px-1 rounded">stokedesign.co</code> matches <code className="bg-gray-100 px-1 rounded">https://stokedesign.co</code>.</p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">HubSpot CRM</h3>
                <div>
                  <p className="text-xs text-gray-500 mb-3">HubSpot subscription records are matched automatically by Website URL. The report URL is pushed to the <code className="bg-gray-100 px-1 rounded">report_url</code> property, and the care plan is synced back whenever the client dashboard is viewed or a manual sync is run.</p>
                  {editingClient && formData.website_url && (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={hubspotSyncing}
                        onClick={async () => {
                          setHubspotSyncing(true);
                          setHubspotSyncMsg('');
                          try {
                            const res = await authFetch(`/api/admin/clients/${editingClient.id}/hubspot-sync`, { method: 'POST' });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || 'Sync failed');
                            setHubspotSyncMsg('✓ Synced successfully');
                            // Refresh formData with updated hubspot_record_id
                            if (data.subscription?.recordId) {
                              setFormData(prev => ({ ...prev, hubspot_record_id: data.subscription.recordId }));
                            }
                          } catch (err: any) {
                            setHubspotSyncMsg('✗ ' + err.message);
                          } finally {
                            setHubspotSyncing(false);
                          }
                        }}
                        className="px-3 py-2 bg-orange-600 text-white text-xs font-medium rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        {hubspotSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        Sync Now
                      </button>
                      {(formData.hubspot_record_id || editingClient?.hubspot_record_id) && (
                        <a
                          href={`https://app-ap1.hubspot.com/contacts/7951938/record/0-69/${formData.hubspot_record_id || editingClient?.hubspot_record_id}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 bg-gray-800 text-white text-xs font-medium rounded-xl hover:bg-gray-900 transition-colors flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View in HubSpot
                        </a>
                      )}
                      {hubspotSyncMsg && <p className={`text-xs ${hubspotSyncMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'}`}>{hubspotSyncMsg}</p>}
                    </div>
                  )}
                  {editingClient && !formData.website_url && (
                    <p className="text-xs text-amber-600">Set a Website URL above to enable HubSpot sync.</p>
                  )}
                  {!editingClient && (
                    <p className="text-xs text-gray-400">Save the client first to enable HubSpot sync.</p>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">MainWP</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">MainWP Site ID</label>
                  <input
                    type="text"
                    value={formData.mainwp_site_id}
                    onChange={(e) => setFormData({ ...formData, mainwp_site_id: e.target.value })}
                    placeholder="e.g. 42"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">Numeric site ID from your MainWP dashboard. Powers the Website Updates &amp; Stats page.</p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Monthly Reports</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Contact Email
                      <span className="ml-2 px-1.5 py-0.5 bg-orange-50 text-orange-600 text-xs rounded font-normal">Synced from HubSpot</span>
                    </label>
                    <input
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                      placeholder="client@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        First Name
                        <span className="ml-2 px-1.5 py-0.5 bg-orange-50 text-orange-600 text-xs rounded font-normal">Synced from HubSpot</span>
                      </label>
                      <input
                        type="text"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        placeholder="Jane"
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Last Name
                        <span className="ml-2 px-1.5 py-0.5 bg-orange-50 text-orange-600 text-xs rounded font-normal">Synced from HubSpot</span>
                      </label>
                      <input
                        type="text"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        placeholder="Smith"
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Next Send Date
                      <span className="ml-2 px-1.5 py-0.5 bg-orange-50 text-orange-600 text-xs rounded font-normal">Synced from HubSpot</span>
                    </label>
                    <input
                      type="date"
                      value={formData.next_send_date}
                      onChange={(e) => setFormData({ ...formData, next_send_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">Auto-computed from the HubSpot subscription start date. Can be overridden manually.</p>
                  </div>
                  {/* Send Report Now */}
                  {editingClient && formData.contact_email && (
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">Send Report Now</h4>
                          <p className="text-xs text-gray-500 mt-0.5">Send a last-30-days report to <span className="font-medium">{formData.contact_email}</span></p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSendReportNow(editingClient.id.toString())}
                          disabled={sendingReport}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-xs font-semibold rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-60 whitespace-nowrap"
                        >
                          {sendingReport
                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Sending…</>
                            : <><Send className="w-3.5 h-3.5" />Send Now</>
                          }
                        </button>
                      </div>
                      {sendReportStatus && (
                        <p className={`mt-2 text-xs font-medium ${sendReportStatus.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                          {sendReportStatus.ok ? '✓ ' : '✗ '}{sendReportStatus.msg}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Email Notifications</h4>
                      <p className="text-xs text-gray-500">Send monthly report emails to this client.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, email_notifications: formData.email_notifications === 1 ? 0 : 1 })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 ${
                        formData.email_notifications === 1 ? 'bg-gray-900' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.email_notifications === 1 ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center"
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
