import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Trash2, ExternalLink, LogOut, Loader2, Settings, Search, Users, CheckCircle2, XCircle } from 'lucide-react';
import { Logo } from '../components/Logo';

interface Client {
  id: number;
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
}

export default function Admin() {
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
    contact_first_name: '',
    contact_last_name: '',
    contact_email: '',
    enabled_pages: '[1,2,3,4,5,6,7,8]',
    ga_property_id: '',
    gsc_site_url: '',
    bq_project_id: '',
    bq_dataset_id: '',
    bq_table_id: '',
    psi_url: '',
    is_active: 1,
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/clients');
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
    if (client) {
      setEditingClient(client);
      setIsSlugManuallyEdited(true); // Don't auto-update slug for existing clients
      setFormData({
        client_id_number: client.client_id_number || '',
        name: client.name,
        slug: client.slug,
        website_url: client.website_url || '',
        contact_first_name: client.contact_first_name || '',
        contact_last_name: client.contact_last_name || '',
        contact_email: client.contact_email || '',
        enabled_pages: client.enabled_pages || '[1,2,3,4,5,6,7,8]',
        ga_property_id: client.ga_property_id || '',
        gsc_site_url: client.gsc_site_url || '',
        bq_project_id: client.bq_project_id || '',
        bq_dataset_id: client.bq_dataset_id || '',
        bq_table_id: client.bq_table_id || '',
        psi_url: client.psi_url || '',
        is_active: client.is_active,
      });
    } else {
      setEditingClient(null);
      setIsSlugManuallyEdited(false);
      setFormData({
        client_id_number: '',
        name: '',
        slug: '',
        website_url: '',
        contact_first_name: '',
        contact_last_name: '',
        contact_email: '',
        enabled_pages: '[1,2,3,4,5,6,7,8]',
        ga_property_id: '',
        gsc_site_url: '',
        bq_project_id: '',
        bq_dataset_id: '',
        bq_table_id: '',
        psi_url: '',
        is_active: 1,
      });
    }
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
      const res = await fetch('/api/admin/google/ga-properties');
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
      const res = await fetch('/api/admin/google/gsc-sites');
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
      
      if (!res.ok) throw new Error('Failed to save client');
      
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
      const res = await fetch(`/api/admin/clients/${id}`, {
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
        await fetch(`/api/admin/clients/${id}`, {
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
      const res = await fetch(`/api/admin/clients/${client.id}`, {
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
          await fetch(`/api/admin/clients/${id}`, {
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

        <div className="bg-white rounded-2xl shadow-none border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-end">
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
                <th className="p-4 font-medium">Client ID</th>
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
                    <td className="p-4 font-medium text-gray-400">{client.client_id_number ? `SD${client.client_id_number}` : '-'}</td>
                    <td className="p-4 font-medium text-gray-900">{client.name}</td>
                    <td className="p-4 text-gray-500">
                      <Link to={`/client/${client.slug}`} target="_blank" className="flex items-center hover:text-gray-900 transition-colors">
                        /{client.slug}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Link>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        {client.ga_property_id && <span className="px-2 py-1 bg-blue-900/20 text-blue-300 text-xs rounded-md font-medium">GA</span>}
                        {client.gsc_site_url && <span className="px-2 py-1 bg-purple-900/20 text-purple-700 text-xs rounded-md font-medium">GSC</span>}
                        {client.bq_project_id && <span className="px-2 py-1 bg-orange-50 text-orange-700 text-xs rounded-md font-medium">BQ</span>}
                        {client.psi_url && <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-md font-medium">PSI</span>}
                        {!client.ga_property_id && !client.gsc_site_url && !client.bq_project_id && !client.psi_url && (
                          <span className="text-gray-400 text-sm italic">None</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
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
        </div>
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
                  <label className="block text-sm font-medium text-gray-600 mb-1">Client ID Number</label>
                  <input
                    type="text"
                    value={formData.client_id_number}
                    onChange={(e) => {
                      const clientId = e.target.value;
                      setFormData(prev => {
                        const newSlug = !isSlugManuallyEdited && prev.name
                          ? `SD${clientId}-${prev.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, '-')}`
                          : prev.slug;
                        return {
                          ...prev,
                          client_id_number: clientId,
                          slug: newSlug
                        };
                      });
                    }}
                    placeholder="e.g. 123"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">1-3 digit number (e.g. 123)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Client Name *</label>
                    <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setFormData(prev => {
                        const prefix = prev.client_id_number ? `SD${prev.client_id_number}-` : '';
                        const newSlug = !isSlugManuallyEdited 
                          ? `${prefix}${name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, '-')}`
                          : prev.slug;
                        return {
                          ...prev,
                          name,
                          slug: newSlug
                        };
                      });
                    }}
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
                      setFormData(prev => ({
                        ...prev,
                        website_url: newUrl,
                        psi_url: (prev.psi_url === prev.website_url || !prev.psi_url) ? newUrl : prev.psi_url
                      }));
                    }}
                    placeholder="https://www.example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                  />
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
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">First Name</label>
                    <input
                      type="text"
                      value={formData.contact_first_name}
                      onChange={(e) => setFormData({ ...formData, contact_first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={formData.contact_last_name}
                      onChange={(e) => setFormData({ ...formData, contact_last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-600 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Enabled Pages</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 1, name: 'Analytics Overview' },
                    { id: 2, name: 'Traffic Sources' },
                    { id: 3, name: 'Pages & Landing Pages' },
                    { id: 4, name: 'Website Events' },
                    { id: 5, name: 'Search Performance' },
                    { id: 6, name: 'Page Speed' },
                    { id: 7, name: 'Website Statistics' },
                    { id: 8, name: 'Website Updates' },
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
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">BigQuery</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Project ID</label>
                    <input
                      type="text"
                      value={formData.bq_project_id}
                      onChange={(e) => setFormData({ ...formData, bq_project_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Dataset ID</label>
                    <input
                      type="text"
                      value={formData.bq_dataset_id}
                      onChange={(e) => setFormData({ ...formData, bq_dataset_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Table ID</label>
                    <input
                      type="text"
                      value={formData.bq_table_id}
                      onChange={(e) => setFormData({ ...formData, bq_table_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
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
