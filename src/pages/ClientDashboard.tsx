import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, AreaChart, Area
} from 'recharts';
import { format, subDays, parseISO, eachDayOfInterval } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import {
  Loader2, AlertCircle, TrendingUp, Users, Eye, MousePointerClick, Search, FileDown, ExternalLink,
  LayoutDashboard, Share2, FileText, Zap, Gauge, Database, RefreshCw,
  Calendar, Globe, ArrowUpRight, ArrowDownRight, Activity, Clock, Layers,
  Info, CheckCircle, AlertTriangle, Megaphone, Bell, Sparkles, Phone, Mail,
  Wifi, WifiOff, Timer, ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import { Logo } from '../components/Logo';
import { GoogleGenAI } from "@google/genai";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';

const WORLD_TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const TIMEZONE = 'Australia/Melbourne';

interface ClientInfo {
  client_id_number: string | null;
  name: string;
  slug: string;
  website_url: string | null;
  hasGA: boolean;
  hasGSC: boolean;
  hasPSI: boolean;
  hasUptime: boolean;
  hasMainWP: boolean;
  hasHubSpot: boolean;
  care_plan: string | null;
  global_notification: string | null;
  global_notification_icon: string | null;
  global_notification_color: string | null;
  enabled_pages?: string;
}

// ── Stable helper components (defined outside to prevent remount on parent re-render) ──

const MetricTooltip = ({ text, below }: { text: string; below?: boolean }) => (
  <div className="relative inline-flex group/tip">
    <Info className="w-3.5 h-3.5 text-gray-300 hover:text-gray-500 cursor-help transition-colors" />
    {below ? (
      <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 p-3 bg-gray-900 text-white text-[11px] leading-relaxed rounded-xl shadow-xl opacity-0 group-hover/tip:opacity-100 transition-opacity z-50 whitespace-normal text-center">
        {text}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900" />
      </div>
    ) : (
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-gray-900 text-white text-[11px] leading-relaxed rounded-xl shadow-xl opacity-0 group-hover/tip:opacity-100 transition-opacity z-50 whitespace-normal text-center">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </div>
    )}
  </div>
);

const EventsGlossaryTooltip = () => (
  <div className="relative inline-flex group/egloss">
    <Info className="w-4 h-4 text-gray-300 hover:text-gray-500 cursor-help transition-colors" />
    <div className="pointer-events-none absolute top-full left-0 mt-2 w-80 p-4 bg-gray-900 text-white text-[11px] leading-relaxed rounded-xl shadow-xl opacity-0 group-hover/egloss:opacity-100 transition-opacity z-50">
      <p className="font-semibold text-white mb-2 text-xs">About Website Events</p>
      <div className="space-y-1.5 text-gray-300">
        <div>Events are actions tracked each time a user interacts with your site — such as clicking a button, submitting a form, watching a video, or downloading a file.</div>
        <div className="pt-1 border-t border-gray-700 mt-2 space-y-1.5">
          <div><span className="text-white font-medium">page_view</span> — recorded every time a page loads.</div>
          <div><span className="text-white font-medium">session_start</span> — recorded when a new visit begins.</div>
          <div><span className="text-white font-medium">first_visit</span> — recorded the first time a user visits your site.</div>
          <div><span className="text-white font-medium">scroll</span> — recorded when a user scrolls 90% down a page.</div>
          <div><span className="text-white font-medium">click / file_download</span> — recorded when outbound links or files are clicked.</div>
          <div><span className="text-white font-medium">Custom events</span> — any other action specifically configured for your site (e.g. form_submit, purchase).</div>
        </div>
        <div className="pt-1 border-t border-gray-700 mt-2"><span className="text-white font-medium">Events per user</span> — how frequently each user triggered this event on average. Higher values suggest repeated engagement.</div>
      </div>
      <div className="absolute bottom-full left-4 border-4 border-transparent border-b-gray-900" />
    </div>
  </div>
);

const PagesGlossaryTooltip = () => (
  <div className="relative inline-flex group/pgloss">
    <Info className="w-4 h-4 text-gray-300 hover:text-gray-500 cursor-help transition-colors" />
    <div className="pointer-events-none absolute top-full left-0 mt-2 w-80 p-4 bg-gray-900 text-white text-[11px] leading-relaxed rounded-xl shadow-xl opacity-0 group-hover/pgloss:opacity-100 transition-opacity z-50">
      <p className="font-semibold text-white mb-2 text-xs">About this report</p>
      <div className="space-y-1.5 text-gray-300">
        <div><span className="text-white font-medium">Top Content</span> — shows every page on your site ranked by views, helping you identify your most popular content.</div>
        <div><span className="text-white font-medium">Landing Pages</span> — shows which pages visitors arrive on first. These are the entry points to your site.</div>
        <div className="pt-1 border-t border-gray-700 mt-2">
          <span className="text-white font-medium">Views per active user</span> — how many pages each unique visitor viewed on average. Higher values indicate deeper engagement.
        </div>
        <div><span className="text-white font-medium">Engagement time per user</span> — average time each user spent actively interacting with the page (scrolling, clicking etc.).</div>
      </div>
      <div className="absolute bottom-full left-4 border-4 border-transparent border-b-gray-900" />
    </div>
  </div>
);

const TrafficGlossaryTooltip = () => (
  <div className="relative inline-flex group/gloss">
    <Info className="w-4 h-4 text-gray-300 hover:text-gray-500 cursor-help transition-colors" />
    <div className="pointer-events-none absolute top-full left-0 mt-2 w-80 p-4 bg-gray-900 text-white text-[11px] leading-relaxed rounded-xl shadow-xl opacity-0 group-hover/gloss:opacity-100 transition-opacity z-50">
      <p className="font-semibold text-white mb-2 text-xs">Traffic source types</p>
      <div className="space-y-1.5 text-gray-300">
        <div><span className="text-white font-medium">organic / google</span> — visitors who found you via an unpaid Google search result.</div>
        <div><span className="text-white font-medium">referral</span> — visitors who clicked a link on another website (e.g. a blog or directory).</div>
        <div><span className="text-white font-medium">direct / (none)</span> — visitors who typed your URL directly or whose source couldn't be tracked (e.g. bookmarks, some emails).</div>
        <div><span className="text-white font-medium">cpc / google</span> — paid Google Ads (Cost Per Click) traffic.</div>
        <div><span className="text-white font-medium">social</span> — visitors from social media platforms like Facebook, Instagram, or LinkedIn.</div>
        <div><span className="text-white font-medium">email</span> — visitors who clicked a link in an email campaign.</div>
      </div>
      <div className="absolute bottom-full left-4 border-4 border-transparent border-b-gray-900" />
    </div>
  </div>
);

const MetricCard = ({ title, value, icon: Icon, change, delay = 0, tooltip }: any) => {
  const hasChange = change !== null && change !== undefined;
  const isPositive = hasChange && change >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white p-6 rounded-2xl border border-gray-200 shadow-none hover:shadow-none transition-all group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2.5 bg-gray-50 rounded-xl group-hover:bg-gray-100 transition-colors">
            <Icon className="w-5 h-5 text-gray-500 group-hover:text-gray-900 transition-colors" />
          </div>
          {tooltip && <MetricTooltip text={tooltip} />}
        </div>
        {hasChange && (
          <div className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{title}</h3>
      <p className="text-2xl font-bold text-gray-900 font-mono tracking-tight">{value}</p>
    </motion.div>
  );
};

export default function ClientDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number; label: string } | null>(null);

  const [activePage, setActivePage] = useState(0);
  const [gaData, setGaData] = useState<any>(null);
  const [gaExtendedData, setGaExtendedData] = useState<any>(null);
  const [gaComparisonData, setGaComparisonData] = useState<any>(null);
  const [gaCountryData, setGaCountryData] = useState<any>(null);
  const [gaTrafficData, setGaTrafficData] = useState<any>(null);
  const [gaPagesData, setGaPagesData] = useState<any>(null);
  const [gaEventsData, setGaEventsData] = useState<any>(null);
  const [gaLoading, setGaLoading] = useState(false);
  const [gaError, setGaError] = useState('');
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(1);
  const [mapCenter, setMapCenter] = useState<[number, number]>([0, 0]);

  const [gscData, setGscData] = useState<any>(null);
  const [gscQueriesData, setGscQueriesData] = useState<any>(null);
  const [gscDevicesData, setGscDevicesData] = useState<any>(null);
  const [gscLoading, setGscLoading] = useState(false);
  const [gscError, setGscError] = useState('');

  const [psiData, setPsiData] = useState<any>(null);
  const [psiHistory, setPsiHistory] = useState<any[]>([]);
  const [psiLoading, setPsiLoading] = useState(false);
  const [psiError, setPsiError] = useState('');
  const [psiStrategy, setPsiStrategy] = useState<'mobile' | 'desktop'>('desktop');

  const [uptimeData, setUptimeData] = useState<any>(null);
  const [uptimeLoading, setUptimeLoading] = useState(false);
  const [uptimeError, setUptimeError] = useState('');

  const [mainwpData, setMainwpData] = useState<any>(null);
  const [mainwpLoading, setMainwpLoading] = useState(false);
  const [mainwpError, setMainwpError] = useState('');

  const [hubspotData, setHubspotData] = useState<any>(null);
  const [hubspotLoading, setHubspotLoading] = useState(false);
  const [hubspotError, setHubspotError] = useState('');

  const [reportOverviewData, setReportOverviewData] = useState<any>(null);
  const [reportOverviewLoading, setReportOverviewLoading] = useState(false);
  const [reportOverviewError, setReportOverviewError] = useState('');

  const [dateRange, setDateRange] = useState('30daysAgo');
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(formatInTimeZone(subDays(new Date(), 30), TIMEZONE, 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd'));

  useEffect(() => {
    fetchClientInfo();
  }, [slug]);

  useEffect(() => {
    if (client) {
      if (dateRange === 'custom' && (!customStartDate || !customEndDate)) return;

      if (activePage === 1) {
        fetchReportOverview();
      }

      if (client.hasGA) {
        if (activePage === 0 || activePage === 2) {
          fetchGA('overview');
          fetchGA('overview_comparison');
          fetchGA('countries');
        } else if (activePage === 3) {
          fetchGA('traffic_sources');
        } else if (activePage === 4) {
          fetchGA('pages');
          fetchGA('landing_pages');
        } else if (activePage === 5) {
          fetchGA('events');
        }
      }

      if (client.hasGSC && (activePage === 0 || activePage === 6)) fetchGSC();
      if (client.hasPSI && (activePage === 0 || activePage === 7)) {
        fetchPSI();
        fetchPSIHistory();
      }
      if (client.hasUptime && activePage === 8) {
        fetchUptime();
      }
      if (client.hasMainWP && activePage === 9) {
        fetchMainWP();
      }
      if (client.hasHubSpot && activePage === 0) {
        fetchHubSpot();
      }
    }
  }, [client, dateRange, customStartDate, customEndDate, activePage]);

  useEffect(() => {
    if (client && client.hasPSI) {
      fetchPSI();
      fetchPSIHistory();
    }
  }, [psiStrategy]);

  const fetchClientInfo = async () => {
    try {
      const res = await fetch(`/api/client/${slug}`);
      if (!res.ok) throw new Error('Client not found');
      const data = await res.json();
      setClient(data);
      document.title = `${data.name} | Stoke Design Website Reporter`;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchGA = async (reportType: string = 'overview') => {
    setGaLoading(true);
    setGaError('');
    try {
      let startDate = '30daysAgo';
      let endDate = 'today';

      if (dateRange === '90daysAgo') startDate = '90daysAgo';
      if (dateRange === '365daysAgo') startDate = '365daysAgo';
      if (dateRange === 'custom') {
        startDate = customStartDate;
        endDate = customEndDate;
      }

      const res = await fetch(`/api/client/${slug}/ga?startDate=${startDate}&endDate=${endDate}&reportType=${reportType}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch GA data');

      if (reportType === 'overview') setGaData(data);
      else if (reportType === 'overview_extended') setGaExtendedData(data);
      else if (reportType === 'overview_comparison') setGaComparisonData(data);
      else if (reportType === 'countries') setGaCountryData(data);
      else if (reportType === 'traffic_sources') setGaTrafficData(data);
      else if (reportType === 'pages' || reportType === 'landing_pages') {
        setGaPagesData((prev: any) => ({ ...prev, [reportType]: data }));
      }
      else if (reportType === 'events') setGaEventsData(data);
    } catch (err: any) {
      setGaError(err.message);
    } finally {
      setGaLoading(false);
    }
  };

  const fetchGSC = async () => {
    setGscLoading(true);
    setGscError('');
    try {
      let endDate = formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');
      let startDate = formatInTimeZone(subDays(new Date(), 30), TIMEZONE, 'yyyy-MM-dd');

      if (dateRange === '90daysAgo') startDate = formatInTimeZone(subDays(new Date(), 90), TIMEZONE, 'yyyy-MM-dd');
      if (dateRange === '365daysAgo') startDate = formatInTimeZone(subDays(new Date(), 365), TIMEZONE, 'yyyy-MM-dd');
      if (dateRange === 'custom') {
        startDate = customStartDate;
        endDate = customEndDate;
      }

      const params = `startDate=${startDate}&endDate=${endDate}`;
      const [resDate, resQueries, resDevices] = await Promise.all([
        fetch(`/api/client/${slug}/gsc?${params}`),
        fetch(`/api/client/${slug}/gsc?${params}&reportType=queries`),
        fetch(`/api/client/${slug}/gsc?${params}&reportType=devices`),
      ]);
      const [dataDate, dataQueries, dataDevices] = await Promise.all([
        resDate.json(), resQueries.json(), resDevices.json(),
      ]);
      if (!resDate.ok) throw new Error(dataDate.error || 'Failed to fetch GSC data');
      setGscData(dataDate);
      setGscQueriesData(resQueries.ok ? dataQueries : null);
      setGscDevicesData(resDevices.ok ? dataDevices : null);
    } catch (err: any) {
      setGscError(err.message);
    } finally {
      setGscLoading(false);
    }
  };

  const fetchUptime = async () => {
    setUptimeLoading(true);
    setUptimeError('');
    try {
      const res = await fetch(`/api/client/${slug}/uptime`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch uptime data');
      setUptimeData(data);
    } catch (err: any) {
      setUptimeError(err.message);
    } finally {
      setUptimeLoading(false);
    }
  };

  const fetchMainWP = async () => {
    setMainwpLoading(true);
    setMainwpError('');
    try {
      const res = await fetch(`/api/client/${slug}/mainwp`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch MainWP data');
      setMainwpData(data);
    } catch (err: any) {
      setMainwpError(err.message);
    } finally {
      setMainwpLoading(false);
    }
  };

  const fetchHubSpot = async () => {
    setHubspotLoading(true);
    setHubspotError('');
    try {
      const res = await fetch(`/api/client/${slug}/hubspot`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch HubSpot data');
      setHubspotData(data);
    } catch (err: any) {
      setHubspotError(err.message);
    } finally {
      setHubspotLoading(false);
    }
  };

  const fetchReportOverview = async () => {
    if (reportOverviewData) return; // already loaded — no need to re-fetch (Anthropic costs money)
    setReportOverviewLoading(true);
    setReportOverviewError('');
    try {
      const res = await fetch(`/api/client/${slug}/report-overview`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate report overview');
      setReportOverviewData(data);
    } catch (err: any) {
      setReportOverviewError(err.message);
    } finally {
      setReportOverviewLoading(false);
    }
  };

  const fetchPSIHistory = async () => {
    try {
      const res = await fetch(`/api/client/${slug}/psi/history?strategy=${psiStrategy}`);
      if (res.ok) {
        const data = await res.json();
        setPsiHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch PSI history', err);
    }
  };

  const fetchPSI = async () => {
    setPsiLoading(true);
    setPsiError('');
    try {
      const res = await fetch(`/api/client/${slug}/psi?strategy=${psiStrategy}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch PSI data');
      setPsiData(data);
    } catch (err: any) {
      setPsiError(err.message);
    } finally {
      setPsiLoading(false);
    }
  };

  const generateAiSummary = async () => {
    if (!client || aiLoading) return;
    setAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: (process.env as any).GEMINI_API_KEY });
      const model = "gemini-3-flash-preview";

      const gaMetrics = gaExtendedData?.rows?.[0]?.metricValues || [];
      const gscMetrics = gscData?.rows || [];
      const psiMetrics = psiData?.lighthouseResult?.categories || {};

      const prompt = `
        As an expert business consultant, provide a concise, easy-to-understand summary of the following website performance data for a business owner.
        Keep the summary under 300 words. Focus on what these numbers mean for their business growth and customer engagement.
        
        IMPORTANT: Start the response with a friendly greeting addressing the client by name.
        For example: "Hey ${client.name || 'there'}, this month..."
        
        Client Name: ${client.name}
        
        GA4 Data (Last 30 days):
        - Active Users: ${gaMetrics[0]?.value || 'N/A'}
        - New Users: ${gaMetrics[1]?.value || 'N/A'}
        - Engagement Rate: ${(parseFloat(gaMetrics[5]?.value || '0') * 100).toFixed(1)}%
        - Views: ${gaMetrics[3]?.value || 'N/A'}
        
        Search Console Data:
        - Total Clicks: ${gscMetrics.reduce((sum: number, r: any) => sum + r.clicks, 0)}
        - Total Impressions: ${gscMetrics.reduce((sum: number, r: any) => sum + r.impressions, 0)}
        
        PageSpeed Insights:
        - Performance Score: ${Math.round((psiMetrics.performance?.score || 0) * 100)}/100
        - SEO Score: ${Math.round((psiMetrics.seo?.score || 0) * 100)}/100
        
        Use friendly, professional terminology. Avoid overly technical jargon.
      `;

      const result = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      setAiSummary(result.text || 'Unable to generate summary at this time.');
    } catch (err) {
      console.error('AI Summary Error:', err);
      setAiSummary('An error occurred while generating the AI summary. Please try again later.');
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (activePage === 0 && client) {
      if (!aiSummary) generateAiSummary();
    }
  }, [activePage, client, gaExtendedData, gscData, psiData]);

  const renderAiOverview = () => {
    return (
      <div className="space-y-8">
        <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-none relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gray-100 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gray-100 rounded-2xl">
                <Sparkles className="w-6 h-6 text-gray-900" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">AI Insights Overview</h3>
            </div>

            {aiLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-gray-900" />
                <p className="animate-pulse">Analyzing your business data...</p>
              </div>
            ) : (
              <div className="prose prose-gray max-w-none">
                <div className="text-gray-500 leading-relaxed whitespace-pre-wrap text-lg">
                  {aiSummary || 'No summary available. Please ensure your data sources are connected.'}
                </div>
              </div>
            )}
          </div>
        </div>

        {client?.hasHubSpot && (
          hubspotLoading ? (
            <div className="bg-white p-6 rounded-3xl border border-gray-200 flex items-center gap-3 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading account info...</span>
            </div>
          ) : hubspotData ? (
            <div className="bg-white p-6 rounded-3xl border border-gray-200">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Account Info</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {(hubspotData.firstName || hubspotData.lastName) && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Contact</p>
                    <p className="text-sm font-semibold text-gray-900">{[hubspotData.firstName, hubspotData.lastName].filter(Boolean).join(' ')}</p>
                  </div>
                )}
                {hubspotData.email && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Email</p>
                    <p className="text-sm font-semibold text-gray-900 truncate">{hubspotData.email}</p>
                  </div>
                )}
                {hubspotData.nextReviewDate && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Next Review</p>
                    <p className="text-sm font-semibold text-gray-900">{new Date(hubspotData.nextReviewDate).toLocaleDateString()}</p>
                  </div>
                )}
                {hubspotData.plan && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Plan</p>
                    <p className="text-sm font-semibold text-gray-900">{hubspotData.plan}</p>
                  </div>
                )}
              </div>
            </div>
          ) : null
        )}

        <div className="bg-gray-900 text-white p-8 rounded-3xl shadow-none relative overflow-hidden">
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/10 rounded-full -mb-24 -mr-24 blur-2xl"></div>
          <div className="relative z-10">
            <h4 className="text-xl font-bold mb-4">Need help understanding your data?</h4>
            <p className="text-gray-400 mb-8 max-w-2xl">
              Our team is here to help you translate these insights into actionable growth strategies for your business.
            </p>
            <div className="flex flex-wrap gap-6">
              <a href="tel:0353127136" className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Phone className="w-5 h-5" />
                </div>
                <span className="font-bold">03 5312 7136</span>
              </a>
              <a href="mailto:support@stokedesign.co" className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Mail className="w-5 h-5" />
                </div>
                <span className="font-bold">support@stokedesign.co</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const downloadPDF = async () => {
    setPdfGenerating(true);
    try {
      // ── Date range ─────────────────────────────────────────────────────────
      const pdfStart = dateRange === 'custom' ? customStartDate
        : dateRange === '90daysAgo'  ? formatInTimeZone(subDays(new Date(), 90),  TIMEZONE, 'yyyy-MM-dd')
        : dateRange === '365daysAgo' ? formatInTimeZone(subDays(new Date(), 365), TIMEZONE, 'yyyy-MM-dd')
        : formatInTimeZone(subDays(new Date(), 30), TIMEZONE, 'yyyy-MM-dd');
      const pdfEnd    = dateRange === 'custom' ? customEndDate : formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');
      const dateLabel = `${format(parseISO(pdfStart), 'd MMM yyyy')} – ${format(parseISO(pdfEnd), 'd MMM yyyy')}`;
      const activeIds = pages.map(p => p.id);
      const needsGA   = !!client?.hasGA;
      const needsGSC  = !!client?.hasGSC  && activeIds.includes(6);
      const needsPSI  = !!client?.hasPSI  && activeIds.includes(7);

      // ── Fetch all data in parallel ──────────────────────────────────────────
      setPdfProgress({ current: 0, total: 3, label: 'Fetching data…' });
      const q = (url: string) => fetch(url).then(r => r.ok ? r.json() : null).catch(() => null);
      const gaBase = `/api/client/${slug}/ga?startDate=${pdfStart}&endDate=${pdfEnd}`;
      const gscBase = `/api/client/${slug}/gsc?startDate=${pdfStart}&endDate=${pdfEnd}`;
      const [gaComp, gaCtry, gaTraf, gaPagesRaw, gaLandingRaw, gaEv, gscDly, gscQ, gscDev, psiRes] = await Promise.all([
        needsGA ? q(`${gaBase}&reportType=overview_comparison`) : null,
        needsGA && activeIds.includes(2) ? q(`${gaBase}&reportType=countries`) : null,
        needsGA && activeIds.includes(3) ? q(`${gaBase}&reportType=traffic_sources`) : null,
        needsGA && activeIds.includes(4) ? q(`${gaBase}&reportType=pages`) : null,
        needsGA && activeIds.includes(4) ? q(`${gaBase}&reportType=landing_pages`) : null,
        needsGA && activeIds.includes(5) ? q(`${gaBase}&reportType=events`) : null,
        needsGSC ? q(gscBase) : null,
        needsGSC ? q(`${gscBase}&reportType=queries`) : null,
        needsGSC ? q(`${gscBase}&reportType=devices`) : null,
        needsPSI ? q(`/api/client/${slug}/psi?strategy=desktop`) : null,
      ]);
      // Combine pages + landing_pages into the shape the PDF builder expects
      const gaPages2 = gaPagesRaw || gaLandingRaw
        ? { pages: gaPagesRaw, landing_pages: gaLandingRaw }
        : null;

      // ── Render logo SVG → white PNG for cover ──────────────────────────────
      // Hardcoded SVG string (from Logo.tsx) with explicit fill="#ffffff" so
      // currentColor is never evaluated in a standalone blob context (which resolves to black).
      const logoSvgString = `<svg id="Layer_2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 437.2602 71.8225" width="874" height="144"><g fill="#ffffff"><path d="M83.3579,59.6966c-3.2861,0-6.2686-.6484-8.9482-1.9453-2.6816-1.2969-4.8428-3.1445-6.4854-5.5439-1.6426-2.3994-2.5723-5.2197-2.7881-8.4619h7.457c.1299,1.7295.6816,3.2969,1.6543,4.7012.9727,1.4053,2.2578,2.5186,3.8574,3.3389,1.5996.8223,3.3496,1.2324,5.2529,1.2324,2.8096,0,5.0674-.6162,6.7764-1.8477,1.707-1.2324,2.5615-2.8428,2.5615-4.8311,0-1.8164-.584-3.2529-1.751-4.3125-1.168-1.0586-2.6377-1.8477-4.4102-2.3672l-8.04-2.334c-2.0752-.6045-3.9883-1.4043-5.7393-2.3994-1.751-.9941-3.1563-2.334-4.2148-4.0205-1.0596-1.6855-1.5889-3.8467-1.5889-6.4844,0-2.4639.6816-4.6357,2.043-6.5166,1.3613-1.8809,3.252-3.3496,5.6738-4.4092,2.4209-1.0586,5.1875-1.5889,8.2998-1.5889,3.1992,0,6.0195.5508,8.4629,1.6533,2.4414,1.1025,4.3984,2.6592,5.8682,4.6689,1.4688,2.0098,2.3125,4.3994,2.5293,7.165h-7.457c-.3037-1.9453-1.2764-3.5762-2.9189-4.8955-1.6426-1.3184-3.8037-1.9775-6.4844-1.9775-2.5937,0-4.626.5186-6.0947,1.5557-1.4707,1.0381-2.2051,2.4648-2.2051,4.2803,0,1.5996.5293,2.8525,1.5889,3.7607,1.0586.9082,2.4531,1.5996,4.1826,2.0752l8.1699,2.334c2.1611.6064,4.1387,1.417,5.9336,2.4316,1.793,1.0166,3.2197,2.4111,4.2793,4.1826,1.0596,1.7734,1.5889,4.1074,1.5889,7.0029,0,2.7236-.7031,5.1016-2.1074,7.1338-1.4053,2.0322-3.3828,3.6094-5.9326,4.7334-2.5518,1.124-5.5557,1.6855-9.0137,1.6855Z"/><path d="M119.6532,59.6966c-3.2861,0-5.9658-.875-8.041-2.626-2.0752-1.751-3.1123-4.4414-3.1123-8.0732v-17.5078h-5.9658v-5.9658h5.9658v-10.0508h7.0674v10.0508h8.1709v5.9658h-8.1709v16.9238c0,1.6865.4434,2.9619,1.3301,3.8262.8848.8652,2.042,1.2969,3.4687,1.2969.6484,0,1.2646-.0537,1.8477-.1621.584-.1074,1.0918-.2266,1.5244-.3564v6.1602c-.4766.1299-1.0703.248-1.7832.3564-.7139.1074-1.4814.1621-2.3018.1621Z"/><path d="M143.2009,59.6966c-3.2861,0-6.2041-.7451-8.7539-2.2373-2.5518-1.4912-4.5508-3.5547-5.999-6.1924-1.4482-2.6357-2.1719-5.6191-2.1719-8.9482s.7236-6.2998,2.1719-8.916c1.4482-2.6152,3.4473-4.6689,5.999-6.1602,2.5498-1.4922,5.4678-2.2373,8.7539-2.2373,3.2422,0,6.1377.7451,8.6885,2.2373,2.5508,1.4912,4.5605,3.5332,6.0312,6.1279,1.4688,2.5938,2.2041,5.5762,2.2041,8.9482s-.7354,6.3662-2.2041,8.9805c-1.4707,2.6162-3.4805,4.6689-6.0312,6.1602-2.5508,1.4922-5.4463,2.2373-8.6885,2.2373ZM143.2009,53.5364c1.9014,0,3.5762-.4746,5.0254-1.4268,1.4473-.9502,2.582-2.2793,3.4043-3.9873.8203-1.708,1.2314-3.6416,1.2314-5.8037,0-2.2051-.4111-4.1387-1.2314-5.8037-.8223-1.6641-1.957-2.9717-3.4043-3.9229-1.4492-.9502-3.124-1.4268-5.0254-1.4268-2.9404,0-5.2959,1.0488-7.0684,3.1445-1.7734,2.0977-2.6592,4.7666-2.6592,8.0088,0,3.2852.8857,5.9766,2.6592,8.0732,1.7725,2.0967,4.1279,3.1445,7.0684,3.1445Z"/><path d="M164.372,59.178V11.9065h7.0674v26.4561l13.4883-12.8389h9.8564l-13.9424,13.0986,14.9795,20.5557h-8.8194l-11.0879-15.8223-4.4746,4.1504v11.6719h-7.0674Z"/><path d="M201.8525,44.0042c.3018,3.0703,1.3301,5.4473,3.0801,7.1328,1.751,1.6865,3.9883,2.5293,6.7119,2.5293,2.0752,0,3.8682-.4639,5.3818-1.3945,1.5127-.9287,2.4639-2.2578,2.8535-3.9873h6.9385c-.5625,3.6748-2.2598,6.4951-5.0908,8.4619-2.832,1.9678-6.2578,2.9502-10.2773,2.9502-3.5459,0-6.5498-.8105-9.0137-2.4316-2.4639-1.6211-4.3447-3.7607-5.6416-6.4189-1.2969-2.6592-1.9453-5.501-1.9453-8.5273s.6162-5.8574,1.8477-8.4951c1.2324-2.6357,3.0586-4.7656,5.4795-6.3867s5.4033-2.4316,8.9492-2.4316c3.501,0,6.4297.7676,8.7861,2.3018,2.3555,1.5352,4.1387,3.5244,5.3496,5.9658,1.21,2.4424,1.793,5.0693,1.751,7.8789,0,.6484-.0439,1.5996-.1299,2.8525h-25.0303ZM211.1259,30.5813c-2.3779,0-4.335.6924-5.8691,2.0752-1.5342,1.3838-2.5605,3.3076-3.0801,5.7715h17.249c-.1738-2.291-.9629-4.1719-2.3672-5.6416-1.4053-1.4688-3.3828-2.2051-5.9326-2.2051Z"/><path d="M233.1084,59.178V12.4251h14.5898c3.2422,0,6.29.498,9.1426,1.4912,2.8535.9951,5.3828,2.4648,7.5869,4.4102,2.2051,1.9453,3.9229,4.377,5.1553,7.2949,1.2324,2.918,1.8477,6.3008,1.8477,10.1475,0,3.8486-.6152,7.2305-1.8477,10.1484-1.2324,2.918-2.9502,5.3613-5.1553,7.3271-2.2041,1.9678-4.7334,3.4482-7.5869,4.4424-2.8525.9951-5.9004,1.4912-9.1426,1.4912h-14.5898ZM247.2441,52.4993c2.8096,0,5.4678-.5518,7.9756-1.6533,2.5068-1.1025,4.5498-2.8857,6.1279-5.3506,1.5781-2.4639,2.3672-5.7061,2.3672-9.7266s-.7891-7.251-2.3672-9.6943c-1.5781-2.4414-3.6211-4.2148-6.1279-5.3164-2.5078-1.1025-5.166-1.6543-7.9756-1.6543h-6.6143v33.3955h6.6143Z"/><path d="M282.583,44.0042c.3018,3.0703,1.3301,5.4473,3.0801,7.1328,1.751,1.6865,3.9883,2.5293,6.7119,2.5293,2.0752,0,3.8682-.4639,5.3818-1.3945,1.5127-.9287,2.4639-2.2578,2.8535-3.9873h6.9385c-.5625,3.6748-2.2598,6.4951-5.0908,8.4619-2.832,1.9678-6.2578,2.9502-10.2773,2.9502-3.5459,0-6.5498-.8105-9.0137-2.4316-2.4639-1.6211-4.3447-3.7607-5.6416-6.4189-1.2969-2.6592-1.9453-5.501-1.9453-8.5273s.6162-5.8574,1.8477-8.4951c1.2324-2.6357,3.0586-4.7656,5.4795-6.3867s5.4033-2.4316,8.9492-2.4316c3.501,0,6.4297.7676,8.7861,2.3018,2.3555,1.5352,4.1387,3.5244,5.3496,5.9658,1.21,2.4424,1.793,5.0693,1.751,7.8789,0,.6484-.0439,1.5996-.1299,2.8525h-25.0303ZM291.8564,30.5813c-2.3779,0-4.335.6924-5.8691,2.0752-1.5342,1.3838-2.5605,3.3076-3.0801,5.7715h17.249c-.1738-2.291-.9629-4.1719-2.3672-5.6416-1.4053-1.4688-3.3828-2.2051-5.9326-2.2051Z"/><path d="M325.6406,59.6966c-2.8105,0-5.2754-.5088-7.3926-1.5234-2.1182-1.0156-3.7832-2.4316-4.9932-4.2471-1.2109-1.8164-1.8799-3.8691-2.0098-6.1611h6.9385c.0859,1.4707.7988,2.8115,2.1396,4.0205,1.3398,1.2109,3.1123,1.8164,5.3174,1.8164,1.8584,0,3.3604-.3896,4.5068-1.168,1.1445-.7773,1.7178-1.75,1.7178-2.918,0-1.123-.3789-1.9873-1.1348-2.5938-.7568-.6045-1.7617-1.0586-3.0146-1.3613l-5.5771-1.2969c-1.6436-.3896-3.1777-.9404-4.6035-1.6533-1.4268-.7139-2.584-1.7285-3.4697-3.0479-.8867-1.3184-1.3291-3.0156-1.3291-5.0908,0-1.7715.5078-3.3711,1.5234-4.7979,1.0156-1.4268,2.4424-2.5615,4.2803-3.4043,1.8369-.8438,3.9883-1.2646,6.4521-1.2646,3.5879,0,6.6143.9297,9.0781,2.7881,2.4639,1.8594,3.9121,4.4092,4.3447,7.6514h-6.9385c-.1738-1.5127-.8975-2.668-2.1729-3.4688-1.2754-.7998-2.7129-1.2002-4.3115-1.2002-1.5137,0-2.7559.3359-3.7285,1.0059-.9727.6709-1.459,1.5674-1.459,2.6904,0,.9082.3564,1.6543,1.0693,2.2373.7139.584,1.6748,1.0273,2.8857,1.3291l5.5771,1.2324c1.8154.3887,3.458.9404,4.9277,1.6533,1.4687.7139,2.6367,1.7295,3.502,3.0479.8643,1.3193,1.2969,3.1025,1.2969,5.3496,0,1.9453-.5518,3.6963-1.6543,5.2529-1.1016,1.5557-2.6582,2.7988-4.668,3.7285-2.0107.9287-4.377,1.3936-7.1006,1.3936Z"/><path d="M344.1666,20.2063v-7.9756h7.9111v7.9756h-7.9111ZM344.5563,59.178V25.5237h7.0674v33.6543h-7.0674Z"/><path d="M374.0413,71.8225c-4.583,0-8.29-1.0049-11.1211-3.0146-2.832-2.0107-4.4854-4.9189-4.9609-8.7217h7.1328c.2598,1.8574,1.1563,3.3164,2.6914,4.377,1.5342,1.0586,3.6201,1.5879,6.2578,1.5879,2.8096,0,4.9922-.7236,6.5488-2.1719,1.5566-1.4492,2.334-3.4912,2.334-6.1279v-4.4092c-.8213,1.2109-2.1182,2.2158-3.8906,3.0156-1.7725.7998-3.7832,1.1992-6.0303,1.1992-3.2852,0-6.1064-.6914-8.4619-2.0752-2.3564-1.3828-4.1729-3.2959-5.4473-5.7383-1.2754-2.4424-1.9131-5.2412-1.9131-8.3975,0-3.1992.627-6.0303,1.8809-8.4951,1.2529-2.4639,3.0576-4.3867,5.4141-5.7705,2.3564-1.3838,5.1338-2.0752,8.333-2.0752,2.1611,0,4.1504.4209,5.9658,1.2646,1.8154.8428,3.1982,1.9561,4.1494,3.3389v-4.085h7.0684v31.5146c0,4.625-1.416,8.2451-4.2471,10.8613-2.832,2.6152-6.7334,3.9229-11.7041,3.9229ZM373.9114,51.4612c2.8955,0,5.1973-.9287,6.9053-2.7881,1.708-1.8584,2.5615-4.3008,2.5615-7.3271,0-3.0693-.8535-5.5332-2.5615-7.3926-1.708-1.8584-4.0098-2.7881-6.9053-2.7881s-5.1992.9297-6.9062,2.7881c-1.708,1.8594-2.5615,4.3232-2.5615,7.3926,0,3.0264.8535,5.4688,2.5615,7.3271,1.707,1.8594,4.0098,2.7881,6.9062,2.7881Z"/><path d="M395.0956,59.178V25.5237h7.0674v5.7061c1.168-1.9014,2.7236-3.4141,4.6689-4.5391,1.9453-1.123,4.1064-1.6855,6.4844-1.6855s4.4746.4971,6.29,1.4912c1.8154.9951,3.2422,2.3896,4.2803,4.1826,1.0371,1.7939,1.5557,3.9014,1.5557,6.3223v22.1768h-7.0684v-20.6201c0-2.1182-.6152-3.8477-1.8477-5.1875-1.2324-1.3398-2.9287-2.0107-5.0898-2.0107-2.8975,0-5.167,1.1572-6.8086,3.4697-1.6436,2.3125-2.4648,5.501-2.4648,9.5645v14.7842h-7.0674Z"/><path d="M427.2454,23.7244v-4.9411h-1.803v-1.0678h4.8411v1.0678h-1.803v4.9411h-1.235ZM430.8841,23.7244v-6.0089h1.4023l1.803,4.2563,1.8021-4.2563h1.3686v6.0089h-1.1351v-3.706l-1.5854,3.706h-.9183l-1.5686-3.706v3.706h-1.1687Z"/><polygon points="26.6592 48.8889 26.6592 39.9888 39.9888 28.9012 39.9888 13.3296 26.6592 0 26.6592 13.3296 0 35.5455 0 48.8751 26.6592 71.0911 53.3183 48.8751 53.3183 26.6729 26.6592 48.8889"/></g></svg>`;
      const logoImgData = await new Promise<string | null>((resolve) => {
        const blob = new Blob([logoSvgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 874; canvas.height = 144;
          canvas.getContext('2d')!.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
      });

      setPdfProgress({ current: 1, total: 3, label: 'Building PDF…' });
      await new Promise(r => setTimeout(r, 30));

      // ── PDF constants & helpers ─────────────────────────────────────────────
      const pdf = new jsPDF('p', 'mm', 'a4');
      const W = 210, H = 297, ML = 15, MR = 15, MT = 15, MB = 16;
      const CW = W - ML - MR;
      let y = MT;

      const scoreRGB = (s: number | null): [number,number,number] => {
        if (s === null || s === undefined) return [156,163,175];
        return s >= 0.9 ? [16,185,129] : s >= 0.5 ? [245,158,11] : [239,68,68];
      };

      const checkBreak = (need: number) => {
        if (y + need > H - MB) {
          pdf.addPage();
          pdf.setFillColor(227, 94, 61); pdf.rect(0, 0, W, 1.5, 'F');
          y = MT + 4;
        }
      };

      const pageHeader = (title: string) => {
        pdf.addPage();
        pdf.setFillColor(227, 94, 61); pdf.rect(0, 0, W, 1.5, 'F');
        y = MT;
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.setTextColor(10,10,10);
        pdf.text(title, ML, y + 10);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(107,114,128);
        pdf.text(`${client?.name}  •  ${dateLabel}`, W - MR, y + 6, { align: 'right' });
        y += 20;
        pdf.setDrawColor(229,231,235); pdf.setLineWidth(0.3);
        pdf.line(ML, y, W - MR, y);
        y += 8;
      };

      const secTitle = (title: string) => {
        checkBreak(14); y += 2;
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(10,10,10);
        pdf.text(title, ML, y); y += 5;
        pdf.setDrawColor(243,244,246); pdf.setLineWidth(0.2);
        pdf.line(ML, y, W - MR, y); y += 5;
      };

      const metricRow = (items: { label: string; value: string; sub?: string }[]) => {
        const colW = CW / items.length;
        checkBreak(26);
        pdf.setFillColor(249,250,251); pdf.rect(ML, y - 2, CW, 24, 'F');
        pdf.setDrawColor(229,231,235); pdf.setLineWidth(0.2); pdf.rect(ML, y - 2, CW, 24, 'S');
        items.forEach((m, i) => {
          const x = ML + i * colW + 5;
          pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(107,114,128);
          pdf.text(m.label, x, y + 5);
          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); pdf.setTextColor(10,10,10);
          pdf.text(m.value, x, y + 15);
          if (m.sub) { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(107,114,128); pdf.text(m.sub, x, y + 20); }
          if (i < items.length - 1) { pdf.setDrawColor(229,231,235); pdf.setLineWidth(0.2); pdf.line(ML + (i+1)*colW, y, ML + (i+1)*colW, y + 22); }
        });
        y += 28;
      };

      const drawTable = (cols: { label: string; w: number; align?: 'left'|'right' }[], rows: (string|null)[][]) => {
        const MAX = 10, RH = 7, HH = 8;
        const shown = rows.slice(0, MAX);
        checkBreak(HH + RH * shown.length + 8);
        // Header
        pdf.setFillColor(249,250,251); pdf.rect(ML, y - 5, CW, HH, 'F');
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(107,114,128);
        let x = ML + 3;
        cols.forEach(c => {
          const a = c.align ?? (x === ML + 3 ? 'left' : 'right');
          if (a === 'right') pdf.text(c.label.toUpperCase(), x + c.w - 3, y, { align: 'right' });
          else pdf.text(c.label.toUpperCase(), x, y);
          x += c.w;
        });
        y += HH;
        // Rows
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
        shown.forEach((row, ri) => {
          checkBreak(RH + 2);
          if (ri % 2 === 1) { pdf.setFillColor(252,252,253); pdf.rect(ML, y - RH + 1.5, CW, RH, 'F'); }
          x = ML + 3;
          cols.forEach((c, ci) => {
            let txt = row[ci] ?? '—';
            if (ci === 0 && txt.length > 45) txt = txt.slice(0, 42) + '…';
            const a = c.align ?? (ci === 0 ? 'left' : 'right');
            pdf.setTextColor(ci === 0 ? 17 : 75, ci === 0 ? 24 : 85, ci === 0 ? 39 : 99);
            if (a === 'right') pdf.text(txt, x + c.w - 3, y, { align: 'right' });
            else pdf.text(txt, x, y);
            x += c.w;
          });
          y += RH;
          pdf.setDrawColor(243,244,246); pdf.setLineWidth(0.15);
          pdf.line(ML, y - 1.5, W - MR, y - 1.5);
        });
        if (rows.length > MAX) {
          pdf.setFont('helvetica', 'italic'); pdf.setFontSize(7); pdf.setTextColor(156,163,175);
          pdf.text(`Showing top ${MAX} of ${rows.length}`, ML, y + 3); y += 6;
        }
        y += 5;
      };

      // ── COVER PAGE ─────────────────────────────────────────────────────────
      pdf.setFillColor(10,10,10); pdf.rect(0, 0, W, H, 'F');
      // Logo (SVG rendered to PNG) — aspect ratio 437.26 / 71.82 ≈ 6.09
      if (logoImgData) {
        pdf.addImage(logoImgData, 'PNG', ML, 16, 55, 55 / 6.09);
      } else {
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13); pdf.setTextColor(255,255,255);
        pdf.text('STOKE DESIGN', ML, 24);
      }
      // Client name
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(32); pdf.setTextColor(255,255,255);
      const nameLines = pdf.splitTextToSize(client?.name || '', CW);
      pdf.text(nameLines, ML, 118);
      const nameLH = nameLines.length * 11;
      // URL
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(12); pdf.setTextColor(156,163,175);
      pdf.text(client?.website_url || '', ML, 118 + nameLH + 6);
      // Divider
      pdf.setDrawColor(55,65,81); pdf.setLineWidth(0.4);
      pdf.line(ML, 118 + nameLH + 14, W - MR, 118 + nameLH + 14);
      const divY = 118 + nameLH + 22;
      // Labels
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(107,114,128);
      pdf.text('WEBSITE PERFORMANCE REPORT', ML, divY);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(156,163,175);
      pdf.text(dateLabel, ML, divY + 9);
      pdf.text(`Generated ${formatInTimeZone(new Date(), TIMEZONE, 'd MMMM yyyy')}`, ML, divY + 17);
      // Confidential
      pdf.setFontSize(8); pdf.setTextColor(75,85,99);
      pdf.text(`Confidential — prepared for ${client?.name}`, ML, 280);
      // Orange bottom bar
      pdf.setFillColor(227,94,61); pdf.rect(0, H - 4, W, 4, 'F');

      // Helper: render multi-paragraph text, respecting \n breaks
      const renderText = (text: string, fontSize = 9) => {
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(fontSize); pdf.setTextColor(55,65,81);
        const clean = text.replace(/[#*_`]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        clean.split('\n').forEach((para) => {
          if (para.trim() === '') { checkBreak(4); y += 3; return; }
          const lines = pdf.splitTextToSize(para.trim(), CW);
          lines.forEach((line: string) => { checkBreak(fontSize * 0.8); pdf.text(line, ML, y); y += fontSize * 0.65; });
        });
        y += 4;
      };

      // ── PAGE: AI Insights ───────────────────────────────────────────────────
      if (activeIds.includes(0) && aiSummary) {
        pageHeader('AI Insights Overview');
        renderText(aiSummary);
      }

      // ── PAGE: Report Overview ───────────────────────────────────────────────
      if (activeIds.includes(1) && reportOverviewData) {
        pageHeader('Report Overview');
        const rod = reportOverviewData;
        if (rod.summary) {
          renderText(rod.summary);
          y += 2;
        }
      }

      // ── PAGE: Website Analytics ─────────────────────────────────────────────
      if (activeIds.includes(2) && gaComp?.curTotals?.rows?.[0]) {
        pageHeader('Website Analytics');
        const compPct = (i: number) => {
          if (!gaComp?.curTotals || !gaComp?.prevTotals) return '';
          const c = parseFloat(gaComp.curTotals.rows?.[0]?.metricValues?.[i]?.value||'0');
          const p = parseFloat(gaComp.prevTotals.rows?.[0]?.metricValues?.[i]?.value||'0');
          if (p === 0) return ''; const v = ((c-p)/p)*100; return `${v>=0?'+':''}${v.toFixed(1)}% vs prev`;
        };
        const mv0 = gaComp.curTotals.rows[0].metricValues;
        const totUsers = parseInt(mv0[0]?.value||'0');
        const totSess  = parseInt(mv0[2]?.value||'0');
        const totViews = parseInt(mv0[3]?.value||'0');
        metricRow([
          { label: 'Active Users', value: totUsers.toLocaleString(), sub: compPct(0) },
          { label: 'Sessions',     value: totSess.toLocaleString(),  sub: compPct(2) },
          { label: 'Page Views',   value: totViews.toLocaleString(), sub: compPct(3) },
        ]);
        const engRate = ((parseFloat(mv0[4]?.value||'0'))*100).toFixed(1);
        const engSecs = parseFloat(mv0[5]?.value||'0');
        const engTime = engSecs < 60 ? `${Math.round(engSecs)}s` : `${Math.floor(engSecs/60)}m ${Math.round(engSecs%60)}s`;
        metricRow([
          { label: 'New Users',          value: parseInt(mv0[1]?.value||'0').toLocaleString(), sub: compPct(1) },
          { label: 'Engagement Rate',    value: `${engRate}%`,  sub: compPct(4) },
          { label: 'Avg Engagement Time',value: engTime,         sub: compPct(5) },
        ]);
        if (gaCtry?.current?.rows?.length > 0) {
          secTitle('Top Countries');
          drawTable(
            [{ label: 'Country', w: 130 }, { label: 'Users', w: 50, align: 'right' }],
            gaCtry.current.rows.map((r: any) => [r.dimensionValues[0].value, parseInt(r.metricValues[0].value).toLocaleString()])
          );
        }
      }

      // ── PAGE: Traffic Sources ───────────────────────────────────────────────
      if (activeIds.includes(3) && gaTraf?.rows?.length > 0) {
        pageHeader('Traffic Sources');
        drawTable(
          [{ label: 'Source', w: 52 }, { label: 'Medium', w: 44 }, { label: 'Users', w: 28, align: 'right' }, { label: 'Sessions', w: 28, align: 'right' }, { label: 'Eng Rate', w: 28, align: 'right' }],
          gaTraf.rows.map((r: any) => [r.dimensionValues[0].value, r.dimensionValues[1].value, parseInt(r.metricValues[0].value).toLocaleString(), parseInt(r.metricValues[1].value).toLocaleString(), `${(parseFloat(r.metricValues[2].value)*100).toFixed(1)}%`])
        );
      }

      // ── PAGE: Pages & Landing Pages ─────────────────────────────────────────
      if (activeIds.includes(4) && gaPages2) {
        pageHeader('Pages & Landing Pages');
        const pRows = (gaPages2.pages?.rows || []).map((r: any) => {
          const v = parseInt(r.metricValues[0].value)||0, u = parseInt(r.metricValues[1].value)||0, es = parseFloat(r.metricValues[2].value)||0;
          const vu = u > 0 ? (v/u).toFixed(1) : '—';
          const sp = u > 0 ? es/u : 0;
          const et = sp < 60 ? `${Math.round(sp)}s` : `${Math.floor(sp/60)}m ${Math.round(sp%60)}s`;
          return [r.dimensionValues[0].value, v.toLocaleString(), u.toLocaleString(), vu, u > 0 ? et : '—'];
        });
        if (pRows.length > 0) {
          secTitle('Top Content');
          drawTable([{ label: 'Page', w: 74 }, { label: 'Views', w: 26, align: 'right' }, { label: 'Users', w: 26, align: 'right' }, { label: 'Views/User', w: 28, align: 'right' }, { label: 'Eng/User', w: 26, align: 'right' }], pRows);
        }
        const lRows = (gaPages2.landing_pages?.rows || []).map((r: any) => [r.dimensionValues[0].value, parseInt(r.metricValues[0].value).toLocaleString(), parseInt(r.metricValues[4].value).toLocaleString()]);
        if (lRows.length > 0) {
          secTitle('Landing Pages');
          drawTable([{ label: 'Landing Page', w: 136 }, { label: 'Sessions', w: 24, align: 'right' }, { label: 'Conversions', w: 20, align: 'right' }], lRows);
        }
      }

      // ── PAGE: Website Events ────────────────────────────────────────────────
      if (activeIds.includes(5) && gaEv?.rows?.length > 0) {
        pageHeader('Website Events');
        drawTable(
          [{ label: 'Event Name', w: 90 }, { label: 'Count', w: 30, align: 'right' }, { label: 'Users', w: 30, align: 'right' }, { label: 'Events/User', w: 30, align: 'right' }],
          gaEv.rows.map((r: any) => { const c = parseInt(r.metricValues[0].value)||0, u = parseInt(r.metricValues[1].value)||0; return [r.dimensionValues[0].value, c.toLocaleString(), u.toLocaleString(), u > 0 ? (c/u).toFixed(1) : '—']; })
        );
      }

      // ── PAGE: Search Performance ────────────────────────────────────────────
      if (activeIds.includes(6) && gscDly) {
        pageHeader('Search Performance');
        const gr = gscDly.rows || [];
        const totClk = gr.reduce((s: number, r: any) => s + r.clicks, 0);
        const totImp = gr.reduce((s: number, r: any) => s + r.impressions, 0);
        const avgCTR = gr.length > 0 ? (gr.reduce((s: number, r: any) => s + r.ctr, 0) / gr.length * 100).toFixed(1) : '0';
        const avgPos = gr.length > 0 ? (gr.reduce((s: number, r: any) => s + r.position, 0) / gr.length).toFixed(1) : '0';
        metricRow([{ label: 'Total Clicks', value: totClk.toLocaleString() }, { label: 'Impressions', value: totImp.toLocaleString() }, { label: 'Avg. CTR', value: `${avgCTR}%` }, { label: 'Avg. Position', value: avgPos }]);
        if (gscQ?.rows?.length > 0) {
          secTitle('Top Queries');
          drawTable(
            [{ label: 'Query', w: 86 }, { label: 'Clicks', w: 22, align: 'right' }, { label: 'Impressions', w: 30, align: 'right' }, { label: 'CTR', w: 22, align: 'right' }, { label: 'Position', w: 20, align: 'right' }],
            gscQ.rows.map((r: any) => [r.keys[0], r.clicks.toLocaleString(), r.impressions.toLocaleString(), `${(r.ctr*100).toFixed(1)}%`, r.position.toFixed(1)])
          );
        }
        if (gscDev?.rows?.length > 0) {
          secTitle('Devices');
          drawTable(
            [{ label: 'Device', w: 90 }, { label: 'Clicks', w: 30, align: 'right' }, { label: 'Impressions', w: 36, align: 'right' }, { label: 'CTR', w: 24, align: 'right' }],
            gscDev.rows.map((r: any) => [r.keys[0].charAt(0).toUpperCase() + r.keys[0].slice(1).toLowerCase(), r.clicks.toLocaleString(), r.impressions.toLocaleString(), `${(r.ctr*100).toFixed(1)}%`])
          );
        }
      }

      // ── PAGE: Page Speed ────────────────────────────────────────────────────
      if (activeIds.includes(7) && psiRes?.lighthouseResult) {
        pageHeader('Page Speed');
        const lr = psiRes.lighthouseResult;
        secTitle('Scores — Desktop');
        checkBreak(36);
        const scores = [
          { label: 'Performance',   score: lr.categories?.performance?.score },
          { label: 'Accessibility', score: lr.categories?.accessibility?.score },
          { label: 'Best Practices',score: lr.categories?.['best-practices']?.score },
          { label: 'SEO',           score: lr.categories?.seo?.score },
        ];
        const bw = CW / 4;
        scores.forEach((s, i) => {
          const x = ML + i * bw;
          const pct = s.score !== null && s.score !== undefined ? Math.round(s.score * 100) : null;
          const col = scoreRGB(s.score);
          pdf.setFillColor(249,250,251); pdf.rect(x, y - 3, bw - 2, 30, 'F');
          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(26); pdf.setTextColor(col[0],col[1],col[2]);
          pdf.text(pct !== null ? String(pct) : '—', x + bw/2 - 1, y + 16, { align: 'center' });
          pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(107,114,128);
          pdf.text(s.label, x + bw/2 - 1, y + 23, { align: 'center' });
          pdf.setFillColor(col[0],col[1],col[2]); pdf.rect(x, y + 26, bw - 2, 2, 'F');
        });
        y += 36;
        secTitle('Core Web Vitals');
        [
          { label: 'Largest Contentful Paint', key: 'largest-contentful-paint', desc: 'Loading performance' },
          { label: 'Total Blocking Time',       key: 'total-blocking-time',       desc: 'Responsiveness' },
          { label: 'Cumulative Layout Shift',   key: 'cumulative-layout-shift',   desc: 'Visual stability' },
        ].forEach(v => {
          const a = lr.audits?.[v.key]; if (!a) return;
          checkBreak(15);
          const col = scoreRGB(a.score);
          pdf.setFillColor(249,250,251); pdf.rect(ML, y - 3, CW, 12, 'F');
          pdf.setFillColor(col[0],col[1],col[2]); pdf.rect(ML, y - 3, 3, 12, 'F');
          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(17,24,39); pdf.text(v.label, ML + 7, y + 3);
          pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(107,114,128); pdf.text(v.desc, ML + 7, y + 8);
          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(col[0],col[1],col[2]); pdf.text(a.displayValue||'—', W - MR, y + 3, { align: 'right' });
          y += 14;
        });
      }

      // ── Footer on every content page ────────────────────────────────────────
      const totalPages = pdf.getNumberOfPages();
      for (let i = 2; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setDrawColor(229,231,235); pdf.setLineWidth(0.2); pdf.line(ML, H - 10, W - MR, H - 10);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(156,163,175);
        pdf.text(`${client?.name} — ${dateLabel}`, ML, H - 6);
        pdf.text(`Page ${i - 1} of ${totalPages - 1}`, W - MR, H - 6, { align: 'right' });
      }

      setPdfProgress({ current: 2, total: 3, label: 'Saving…' });
      await new Promise(r => setTimeout(r, 30));
      pdf.save(`${client?.name || 'client'}-report-${pdfEnd}.pdf`);
    } catch (err) {
      console.error('PDF failed:', err);
      setPdfProgress({ current: 0, total: 1, label: `Error: ${(err as Error).message || 'Unknown error'}` });
      await new Promise(r => setTimeout(r, 3000));
    } finally {
      setPdfProgress(null);
      setPdfGenerating(false);
    }
  };

  const gaChartData = useMemo(() => {
    if (!gaData || !gaData.rows) return [];
    return gaData.rows.map((row: any) => ({
      date: row.dimensionValues[0].value,
      activeUsers: parseInt(row.metricValues[0].value, 10),
      sessions: parseInt(row.metricValues[1].value, 10),
      pageViews: parseInt(row.metricValues[2].value, 10),
    })).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [gaData]);

  // Merge current + previous daily data by day index for dual-line chart
  const gaComparisonChartData = useMemo(() => {
    if (!gaComparisonData) return [];
    const cur  = (gaComparisonData.curDaily?.rows  || []).map((r: any) => ({ date: r.dimensionValues[0].value, v: parseInt(r.metricValues[0].value, 10) })).sort((a: any, b: any) => a.date.localeCompare(b.date));
    const prev = (gaComparisonData.prevDaily?.rows || []).map((r: any) => ({ date: r.dimensionValues[0].value, v: parseInt(r.metricValues[0].value, 10) })).sort((a: any, b: any) => a.date.localeCompare(b.date));
    const len = Math.max(cur.length, prev.length);
    return Array.from({ length: len }, (_, i) => ({
      index: i + 1,
      curDate:  cur[i]?.date  || '',
      prevDate: prev[i]?.date || '',
      current:  cur[i]?.v  ?? null,
      previous: prev[i]?.v ?? null,
    }));
  }, [gaComparisonData]);

  // Country data: merge current + previous into sorted list
  const gaCountryList = useMemo(() => {
    if (!gaCountryData) return [];
    const prevMap: Record<string, number> = {};
    (gaCountryData.previous?.rows || []).forEach((r: any) => {
      const name = r.dimensionValues[0].value;
      prevMap[name] = parseInt(r.metricValues[0].value, 10);
    });
    return (gaCountryData.current?.rows || [])
      .map((r: any) => {
        const name   = r.dimensionValues[0].value;
        const code   = r.dimensionValues[1].value; // ISO alpha-2
        const cur    = parseInt(r.metricValues[0].value, 10);
        const prev   = prevMap[name] ?? 0;
        const change = prev > 0 ? ((cur - prev) / prev) * 100 : null;
        return { name, code, cur, prev, change };
      })
      .sort((a: any, b: any) => b.cur - a.cur)
      .slice(0, 10);
  }, [gaCountryData]);

  // Totals comparison deltas
  const gaDeltas = useMemo(() => {
    if (!gaComparisonData?.curTotals || !gaComparisonData?.prevTotals) return null;
    const cur  = gaComparisonData.curTotals.rows?.[0]?.metricValues  || [];
    const prev = gaComparisonData.prevTotals.rows?.[0]?.metricValues || [];
    const pct = (i: number) => {
      const c = parseFloat(cur[i]?.value  || '0');
      const p = parseFloat(prev[i]?.value || '0');
      if (p === 0) return null;
      return ((c - p) / p) * 100;
    };
    return {
      activeUsers:     { cur: parseFloat(cur[0]?.value || '0'), pct: pct(0) },
      newUsers:        { cur: parseFloat(cur[1]?.value || '0'), pct: pct(1) },
      sessions:        { cur: parseFloat(cur[2]?.value || '0'), pct: pct(2) },
      views:           { cur: parseFloat(cur[3]?.value || '0'), pct: pct(3) },
      engagementRate:  { cur: parseFloat(cur[4]?.value || '0'), pct: pct(4) },
      engagementTime:  { cur: parseFloat(cur[5]?.value || '0'), pct: pct(5) },
    };
  }, [gaComparisonData]);

  const gscChartData = useMemo(() => {
    if (!gscData || !gscData.rows) return [];
    const byDate: Record<string, any> = {};
    for (const row of gscData.rows) {
      byDate[row.keys[0]] = { clicks: row.clicks, impressions: row.impressions };
    }
    // Build full date range so missing days appear as zero
    const days = dateRange === '365daysAgo' ? 365 : dateRange === '90daysAgo' ? 90 : 30;
    const end   = dateRange === 'custom' ? parseISO(customEndDate)   : new Date();
    const start = dateRange === 'custom' ? parseISO(customStartDate) : subDays(end, days);
    return eachDayOfInterval({ start, end }).map(d => {
      const key = format(d, 'yyyy-MM-dd');
      return { date: key, clicks: byDate[key]?.clicks ?? 0, impressions: byDate[key]?.impressions ?? 0 };
    });
  }, [gscData, dateRange, customStartDate, customEndDate]);

  const displayDateRange = useMemo(() => {
    const today = new Date();
    let start: Date;
    let end = today;

    if (dateRange === 'custom') {
      start = customStartDate ? new Date(customStartDate + 'T00:00:00') : subDays(today, 30);
      end = customEndDate ? new Date(customEndDate + 'T00:00:00') : today;
    } else if (dateRange === '90daysAgo') {
      start = subDays(today, 90);
    } else if (dateRange === '365daysAgo') {
      start = subDays(today, 365);
    } else {
      start = subDays(today, 30);
    }

    return `${format(start, 'dd/MM/yyyy')} – ${format(end, 'dd/MM/yyyy')}`;
  }, [dateRange, customStartDate, customEndDate]);

  const pageSubtitles: Record<number, string> = {
    0: 'AI-powered insights and recommendations for your website.',
    1: 'A snapshot of your website performance across the selected period.',
    2: 'Visitor behaviour, engagement and activity across your website.',
    3: 'Where your visitors are coming from across the web.',
    4: 'Your most visited pages and top entry experiences.',
    5: 'Tracked actions and user interactions across your website.',
    6: 'How your website is performing in Google search results.',
    7: 'Speed and performance scores powered by Google PageSpeed Insights.',
    8: 'Real-time availability and uptime monitoring for your website.',
    9: 'WordPress core, plugin and theme update status via MainWP.',
  };

  const allPages = [
    { id: 0, name: 'AI Insights Overview', icon: Sparkles, source: 'AI' },
    { id: 1, name: 'Report Overview', icon: ClipboardList, source: 'AI' },
    { id: 2, name: 'Website Analytics', icon: LayoutDashboard, source: 'GA4' },
    { id: 3, name: 'Traffic Sources', icon: Share2, source: 'GA4' },
    { id: 4, name: 'Pages & Landing Pages', icon: FileText, source: 'GA4' },
    { id: 5, name: 'Website Events', icon: Zap, source: 'GA4' },
    { id: 6, name: 'Search Performance', icon: Search, source: 'SC' },
    { id: 7, name: 'Page Speed', icon: Gauge, source: 'PSI' },
    { id: 8, name: 'Uptime Monitor', icon: Activity, source: 'Uptime' },
    { id: 9, name: 'WP Updates & Stats', icon: RefreshCw, source: 'MainWP' },
  ];

  const pages = useMemo(() => {
    if (!client) return [];
    let enabledPageIds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    try {
      if (client.enabled_pages) {
        enabledPageIds = JSON.parse(client.enabled_pages);
      }
    } catch (e) {
      console.error('Failed to parse enabled_pages', e);
    }
    return allPages.filter(page => enabledPageIds.includes(page.id));
  }, [client]);

  useEffect(() => {
    if (pages.length > 0 && !pages.find(p => p.id === activePage)) {
      setActivePage(pages[0].id);
    }
  }, [pages, activePage]);


  const renderAnalyticsOverview = () => {
    if (!client?.hasGA) return <NoDataConfigured source="Google Analytics" />;
    if (gaLoading && !gaData && !gaComparisonData) return <LoadingState />;
    if (gaError) return <ErrorState message={gaError} />;

    const formatDuration = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      if (h > 0) return `${h}h ${m}m ${s}s`;
      if (m > 0) return `${m}m ${s}s`;
      return `${s}s`;
    };

    // Flag emoji from ISO alpha-2 code
    const flag = (code: string) => {
      if (!code || code.length !== 2) return '🌐';
      return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)));
    };

    // Country name → ISO alpha-2 map for world-atlas matching
    // We'll match by the countryId alpha-2 code returned by GA
    const countryMaxUsers = gaCountryList[0]?.cur || 1;

    // Build lookup: country name → cur users (for map colouring)
    const countryLookup: Record<string, number> = {};
    gaCountryList.forEach(c => { countryLookup[c.name] = c.cur; });

    const d = gaDeltas;
    const sessions  = d?.sessions.cur  ?? 0;
    const views     = d?.views.cur     ?? 0;
    const activeUsers = d?.activeUsers.cur ?? 0;
    const engTime   = d?.engagementTime.cur ?? 0;
    const pageViewsPerUser = activeUsers > 0 ? (views / activeUsers).toFixed(2) : '0';
    const engRate   = ((d ? gaComparisonData?.curTotals?.rows?.[0]?.metricValues?.[4]?.value : 0) * 100 || 0).toFixed(1);

    const prevLabel = gaComparisonData ? `${gaComparisonData.prevStart} – ${gaComparisonData.prevEnd}` : 'Previous period';

    return (
      <div className="space-y-8">
        {/* ── Top metric cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard title="Active Users" value={d ? parseInt(String(d.activeUsers.cur)).toLocaleString() : '—'} icon={Users} delay={0.1} change={d?.activeUsers.pct} tooltip="The number of people who visited your site and had at least one engaged session in the selected period." />
          <MetricCard title="New Users"    value={d ? parseInt(String(d.newUsers.cur)).toLocaleString()    : '—'} icon={Users} delay={0.2} change={d?.newUsers.pct}    tooltip="First-time visitors to your website — a measure of how well you're attracting fresh audiences." />
          <MetricCard title="Engagement Rate" value={`${engRate}%`} icon={Zap} delay={0.3} change={d?.engagementRate.pct} tooltip="The percentage of sessions where a user actively engaged — scrolled, clicked, or spent 10+ seconds on the page." />
          <MetricCard title="Views" value={d ? parseInt(String(d.views.cur)).toLocaleString() : '—'} icon={Eye} delay={0.4} change={d?.views.pct} tooltip="Total number of pages viewed across all visitors, including repeated views of the same page." />
        </div>

        {/* ── Dual-line chart + secondary metrics ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Active Users</h3>
                <p className="text-sm text-gray-400">{displayDateRange}</p>
              </div>
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 bg-[#e35e3d] rounded-full" />
                  <span className="text-xs text-gray-500 font-medium">Current</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 bg-gray-300 rounded-full border-dashed" style={{ borderTop: '2px dashed #d1d5db', height: 0 }} />
                  <span className="text-xs text-gray-400 font-medium">Previous period</span>
                </div>
              </div>
            </div>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={gaComparisonChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                  <XAxis
                    dataKey="index"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#a1a1aa' }}
                    dy={8}
                    tickFormatter={(i) => {
                      const row = gaComparisonChartData[i - 1];
                      if (!row?.curDate) return '';
                      try { return format(parseISO(row.curDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')), 'MMM d'); }
                      catch { return ''; }
                    }}
                    interval="preserveStartEnd"
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#a1a1aa' }} width={35} />
                  <Tooltip
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px 16px' }}
                    formatter={(value: any, name: string, props: any) => {
                      const row = props.payload;
                      if (name === 'current') {
                        const d = row.curDate?.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
                        return [value?.toLocaleString(), d ? format(parseISO(d), 'MMM d, yyyy') : 'Current'];
                      }
                      const d = row.prevDate?.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
                      return [value?.toLocaleString(), d ? format(parseISO(d), 'MMM d, yyyy') : 'Previous'];
                    }}
                    labelFormatter={() => 'Active Users'}
                  />
                  <Line type="monotone" dataKey="current"  name="current"  stroke="#e35e3d" strokeWidth={2.5} dot={false} connectNulls />
                  <Line type="monotone" dataKey="previous" name="previous" stroke="#d1d5db" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-6">
            <MetricCard title="Sessions" value={parseInt(String(sessions)).toLocaleString()} icon={Share2} delay={0.5} change={d?.sessions.pct} tooltip="A group of user interactions within a 30-minute window. Each visit typically counts as one session." />
            <MetricCard title="Page Views/User" value={pageViewsPerUser} icon={FileText} delay={0.6} tooltip="On average, how many pages each visitor views — a higher number suggests strong content engagement." />
            <MetricCard title="Engagement Time" value={formatDuration(engTime)} icon={Clock} delay={0.7} change={d?.engagementTime.pct} tooltip="Total combined time all users spent actively engaged with your website across the period." />
          </div>
        </div>

        {/* ── Country Map + Table ── */}
        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-900">Users by Country</h3>
            <p className="text-sm text-gray-400">Active users by location · vs {prevLabel}</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* SVG World Map */}
            <div className="relative bg-gray-50 border-b lg:border-b-0 lg:border-r border-gray-100">
              {/* Zoom controls */}
              <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
                <button
                  onClick={() => setMapZoom(z => Math.min(8, +(z * 1.5).toFixed(2)))}
                  className="w-7 h-7 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm font-bold shadow-sm"
                  title="Zoom in"
                >+</button>
                <button
                  onClick={() => setMapZoom(z => Math.max(1, +(z / 1.5).toFixed(2)))}
                  className="w-7 h-7 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm font-bold shadow-sm"
                  title="Zoom out"
                >−</button>
                <button
                  onClick={() => { setMapZoom(1); setMapCenter([0, 0]); }}
                  className="w-7 h-7 bg-white border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100 flex items-center justify-center shadow-sm"
                  title="Reset view"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                </button>
              </div>

              <ComposableMap
                projection="geoNaturalEarth1"
                projectionConfig={{ scale: 145 }}
                style={{ width: '100%', height: '300px' }}
              >
                <ZoomableGroup
                  zoom={mapZoom}
                  center={mapCenter}
                  minZoom={1}
                  maxZoom={8}
                  onMoveEnd={({ zoom, coordinates }) => {
                    setMapZoom(zoom);
                    setMapCenter(coordinates as [number, number]);
                  }}
                >
                  <Geographies geography={WORLD_TOPO_URL}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const users = countryLookup[geo.properties.name] || 0;
                        const intensity = users > 0 ? Math.min(0.9, 0.15 + (users / countryMaxUsers) * 0.75) : 0;
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            onMouseEnter={() => setHoveredCountry(geo.properties.name)}
                            onMouseLeave={() => setHoveredCountry(null)}
                            style={{
                              default: {
                                fill: users > 0 ? `rgba(227, 94, 61, ${intensity})` : '#e5e7eb',
                                stroke: '#fff',
                                strokeWidth: 0.5,
                                outline: 'none',
                              },
                              hover: {
                                fill: users > 0 ? `rgba(227, 94, 61, ${Math.min(1, intensity + 0.15)})` : '#d1d5db',
                                stroke: '#fff',
                                strokeWidth: 0.5,
                                outline: 'none',
                                cursor: 'grab',
                              },
                              pressed: { outline: 'none', cursor: 'grabbing' },
                            }}
                          />
                        );
                      })
                    }
                  </Geographies>
                </ZoomableGroup>
              </ComposableMap>

              {/* Hover label */}
              <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none">
                {hoveredCountry && (
                  <span className="bg-gray-900/80 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg">
                    {hoveredCountry}
                    {countryLookup[hoveredCountry] ? ` · ${countryLookup[hoveredCountry].toLocaleString()} users` : ''}
                  </span>
                )}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-end gap-1.5 px-4 pb-3">
                <span className="text-[10px] text-gray-400">Less</span>
                {[0.15, 0.35, 0.55, 0.75, 0.9].map(o => (
                  <div key={o} className="w-4 h-2.5 rounded-sm" style={{ backgroundColor: `rgba(227,94,61,${o})` }} />
                ))}
                <span className="text-[10px] text-gray-400">More</span>
              </div>
            </div>

            {/* Country table */}
            <div className="overflow-auto max-h-[360px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white border-b border-gray-100">
                  <tr className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    <th className="p-4 text-left">Country</th>
                    <th className="p-4 text-right">Users</th>
                    <th className="p-4 text-right">vs Prev</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {gaCountryList.map((c, i) => (
                    <tr key={c.name}
                      className={`transition-colors ${hoveredCountry === c.name ? 'bg-orange-50' : 'hover:bg-gray-50'}`}
                      onMouseEnter={() => setHoveredCountry(c.name)}
                      onMouseLeave={() => setHoveredCountry(null)}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <span className="text-base leading-none">{flag(c.code)}</span>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                            <div className="mt-1 h-1 rounded-full bg-gray-100 w-24">
                              <div className="h-1 rounded-full bg-[#e35e3d]" style={{ width: `${(c.cur / countryMaxUsers) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right font-mono font-semibold text-gray-900">{c.cur.toLocaleString()}</td>
                      <td className="p-4 text-right">
                        {c.change !== null ? (
                          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${c.change >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                            {c.change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {Math.abs(c.change).toFixed(1)}%
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                    </tr>
                  ))}
                  {gaCountryList.length === 0 && (
                    <tr><td colSpan={3} className="p-8 text-center text-gray-400 text-sm">No country data available yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTrafficSources = () => {
    if (!client?.hasGA) return <NoDataConfigured source="Google Analytics" />;
    if (gaLoading) return <LoadingState />;

    const rows = gaTrafficData?.rows || [];

    return (
      <div className="bg-white rounded-3xl border border-gray-200 shadow-none overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-gray-900">Traffic Sources</h3>
            <TrafficGlossaryTooltip />
          </div>
          <p className="text-sm text-gray-500">Where your visitors are coming from</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/50 text-gray-500">
                <th className="p-6 font-semibold uppercase tracking-wider text-[10px]">Source / Medium</th>
                <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">
                  <span className="inline-flex items-center gap-1 justify-end">
                    Active Users
                    <MetricTooltip text="The number of distinct users who visited your site at least once in the period." below />
                  </span>
                </th>
                <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">
                  <span className="inline-flex items-center gap-1 justify-end">
                    Sessions
                    <MetricTooltip text="A session is a group of interactions one user takes on your site within a given time frame." below />
                  </span>
                </th>
                <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">
                  <span className="inline-flex items-center gap-1 justify-end">
                    Engagement Rate
                    <MetricTooltip text="Percentage of sessions where the user was actively engaged — spent 10+ seconds, viewed 2+ pages, or completed a conversion." below />
                  </span>
                </th>
                <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">
                  <span className="inline-flex items-center gap-1 justify-end">
                    Conversions
                    <MetricTooltip text="Times a key goal was completed (e.g. form submission, purchase) as configured in Google Analytics." below />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((row: any, i: number) => (
                <tr key={i} className="hover:bg-gray-100 transition-colors group">
                  <td className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-gray-200 group-hover:text-gray-900 transition-colors">
                        <Globe className="w-4 h-4" />
                      </div>
                      <span className="font-medium text-gray-900">{row.dimensionValues[0].value} / {row.dimensionValues[1].value}</span>
                    </div>
                  </td>
                  <td className="p-6 text-right text-gray-500 font-mono">{parseInt(row.metricValues[0].value).toLocaleString()}</td>
                  <td className="p-6 text-right text-gray-500 font-mono">{parseInt(row.metricValues[1].value).toLocaleString()}</td>
                  <td className="p-6 text-right text-gray-500 font-mono">{(parseFloat(row.metricValues[2].value) * 100).toFixed(1)}%</td>
                  <td className="p-6 text-right text-gray-500 font-mono">{parseInt(row.metricValues[3].value).toLocaleString()}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="p-12 text-center text-gray-400">No traffic source data found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderPagesAndLanding = () => {
    if (!client?.hasGA) return <NoDataConfigured source="Google Analytics" />;
    if (gaLoading) return <LoadingState />;

    const pagesRows = gaPagesData?.pages?.rows || [];
    const landingRows = gaPagesData?.landing_pages?.rows || [];

    return (
      <div className="grid grid-cols-1 gap-8">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-none overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900">Top Content</h3>
              <PagesGlossaryTooltip />
            </div>
            <p className="text-sm text-gray-500">Most visited pages on your website</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50/50 text-gray-500">
                  <th className="p-6 font-semibold uppercase tracking-wider text-[10px]">Page</th>
                  <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">
                    <span className="inline-flex items-center gap-1 justify-end">
                      Views
                      <MetricTooltip text="Total number of times this page was loaded or reloaded." below />
                    </span>
                  </th>
                  <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">
                    <span className="inline-flex items-center gap-1 justify-end">
                      Active Users
                      <MetricTooltip text="Distinct users who visited this page at least once in the period." below />
                    </span>
                  </th>
                  <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">
                    <span className="inline-flex items-center gap-1 justify-end">
                      Views / User
                      <MetricTooltip text="Average number of times each active user viewed this page." below />
                    </span>
                  </th>
                  <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">
                    <span className="inline-flex items-center gap-1 justify-end">
                      Eng. Time / User
                      <MetricTooltip text="Average time each user spent actively engaging with this page (scrolling, clicking, etc.)." below />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pagesRows.map((row: any, i: number) => {
                  const views = parseInt(row.metricValues[0].value) || 0;
                  const users = parseInt(row.metricValues[1].value) || 0;
                  const engSecs = parseFloat(row.metricValues[2].value) || 0;
                  const viewsPerUser = users > 0 ? (views / users).toFixed(1) : '—';
                  const secsPerUser = users > 0 ? engSecs / users : 0;
                  const engTime = secsPerUser < 60
                    ? `${Math.round(secsPerUser)}s`
                    : `${Math.floor(secsPerUser / 60)}m ${Math.round(secsPerUser % 60)}s`;
                  return (
                    <tr key={i} className="hover:bg-gray-100 transition-colors">
                      <td className="p-6 font-medium text-gray-900 truncate max-w-sm" title={row.dimensionValues[0].value}>{row.dimensionValues[0].value}</td>
                      <td className="p-6 text-right text-gray-500 font-mono">{views.toLocaleString()}</td>
                      <td className="p-6 text-right text-gray-500 font-mono">{users.toLocaleString()}</td>
                      <td className="p-6 text-right text-gray-500 font-mono">{viewsPerUser}</td>
                      <td className="p-6 text-right text-gray-500 font-mono">{users > 0 ? engTime : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-200 shadow-none overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900">Landing Pages</h3>
              <MetricTooltip text="The first page a visitor lands on when they arrive at your site. High sessions here means this page is a strong entry point." />
            </div>
            <p className="text-sm text-gray-500">First pages your users see</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50/50 text-gray-500">
                  <th className="p-6 font-semibold uppercase tracking-wider text-[10px]">Landing Page</th>
                  <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">Sessions</th>
                  <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">Conversions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {landingRows.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-100 transition-colors">
                    <td className="p-6 font-medium text-gray-900 truncate max-w-md" title={row.dimensionValues[0].value}>{row.dimensionValues[0].value}</td>
                    <td className="p-6 text-right text-gray-500 font-mono">{parseInt(row.metricValues[0].value).toLocaleString()}</td>
                    <td className="p-6 text-right text-gray-500 font-mono">{parseInt(row.metricValues[4].value).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderWebsiteEvents = () => {
    if (!client?.hasGA) return <NoDataConfigured source="Google Analytics" />;
    if (gaLoading) return <LoadingState />;

    const rows = gaEventsData?.rows || [];

    return (
      <div className="bg-white rounded-3xl border border-gray-200 shadow-none overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-gray-900">Website Events</h3>
            <EventsGlossaryTooltip />
          </div>
          <p className="text-sm text-gray-500">Tracked user interactions</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/50 text-gray-500">
                <th className="p-6 font-semibold uppercase tracking-wider text-[10px]">Event Name</th>
                <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">
                  <span className="inline-flex items-center gap-1 justify-end">
                    Event Count
                    <MetricTooltip text="Total number of times this event was triggered across all users in the period." below />
                  </span>
                </th>
                <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">
                  <span className="inline-flex items-center gap-1 justify-end">
                    Total Users
                    <MetricTooltip text="Number of distinct users who triggered this event at least once." below />
                  </span>
                </th>
                <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">
                  <span className="inline-flex items-center gap-1 justify-end">
                    Events / User
                    <MetricTooltip text="Average number of times each user triggered this event. Higher values indicate repeated engagement." below />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((row: any, i: number) => {
                const count = parseInt(row.metricValues[0].value) || 0;
                const users = parseInt(row.metricValues[1].value) || 0;
                const perUser = users > 0 ? (count / users).toFixed(1) : '—';
                return (
                  <tr key={i} className="hover:bg-gray-100 transition-colors">
                    <td className="p-6 font-medium text-gray-900">{row.dimensionValues[0].value}</td>
                    <td className="p-6 text-right text-gray-500 font-mono">{count.toLocaleString()}</td>
                    <td className="p-6 text-right text-gray-500 font-mono">{users.toLocaleString()}</td>
                    <td className="p-6 text-right text-gray-500 font-mono">{perUser}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="p-12 text-center text-gray-400">No event data found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderSearchPerformance = () => {
    if (!client?.hasGSC) return <NoDataConfigured source="Search Console" />;
    if (gscLoading) return <LoadingState />;
    if (gscError) return <ErrorState message={gscError} />;

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard title="Total Clicks" value={gscChartData.reduce((sum: number, item: any) => sum + item.clicks, 0).toLocaleString()} icon={MousePointerClick} tooltip="How many times users clicked your website link in Google search results during the selected period." />
          <MetricCard title="Total Impressions" value={gscChartData.reduce((sum: number, item: any) => sum + item.impressions, 0).toLocaleString()} icon={Eye} tooltip="How many times your site appeared in Google search results, whether or not users clicked through." />
          <MetricCard title="Avg. Position" value={(gscChartData.reduce((sum: number, item: any) => sum + parseFloat(item.position), 0) / (gscChartData.length || 1)).toFixed(1)} icon={TrendingUp} tooltip="Your average ranking position in Google search results. Lower numbers are better — position 1 means top of the page." />
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-none">
          <h3 className="text-lg font-bold text-gray-900 mb-8">Search Trends</h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gscChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(val) => {
                    try { return format(parseISO(val), 'MMM d'); } catch { return val; }
                  }}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#a1a1aa' }}
                  dy={10}
                />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#a1a1aa' }} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#a1a1aa' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  labelFormatter={(val) => {
                    try { return format(parseISO(val), 'MMM d, yyyy'); } catch { return val; }
                  }}
                />
                <Legend iconType="circle" />
                <Bar yAxisId="left" dataKey="clicks" name="Clicks" fill="#e35e3d" radius={[6, 6, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="impressions" name="Impressions" stroke="#d1d5db" strokeWidth={2.5} dot={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Queries */}
        {gscQueriesData?.rows?.length > 0 && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-none overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900">Top Queries</h3>
                <MetricTooltip text="The search terms people typed into Google that led to your site appearing in results. Shows the top 25 queries for the selected period." />
              </div>
              <p className="text-sm text-gray-500">Search terms that surfaced your website</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50/50 text-gray-500">
                    <th className="p-6 font-semibold uppercase tracking-wider text-[10px]">Query</th>
                    <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">
                      <span className="inline-flex items-center gap-1 justify-end">
                        Clicks
                        <MetricTooltip text="Times a user clicked your link after seeing this query." below />
                      </span>
                    </th>
                    <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">
                      <span className="inline-flex items-center gap-1 justify-end">
                        Impressions
                        <MetricTooltip text="Times your site appeared in results for this query." below />
                      </span>
                    </th>
                    <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">
                      <span className="inline-flex items-center gap-1 justify-end">
                        CTR
                        <MetricTooltip text="Click-through rate — percentage of impressions that resulted in a click." below />
                      </span>
                    </th>
                    <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">
                      <span className="inline-flex items-center gap-1 justify-end">
                        Avg. Position
                        <MetricTooltip text="Your average ranking position for this query. Lower is better." below />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {gscQueriesData.rows.map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-100 transition-colors">
                      <td className="p-6 font-medium text-gray-900">{row.keys[0]}</td>
                      <td className="p-6 text-right text-gray-500 font-mono">{row.clicks.toLocaleString()}</td>
                      <td className="p-6 text-right text-gray-500 font-mono">{row.impressions.toLocaleString()}</td>
                      <td className="p-6 text-right text-gray-500 font-mono">{(row.ctr * 100).toFixed(1)}%</td>
                      <td className="p-6 text-right text-gray-500 font-mono">{row.position.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Devices */}
        {gscDevicesData?.rows?.length > 0 && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-none overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900">Devices</h3>
                <MetricTooltip text="Breakdown of search traffic by the type of device used. Helps you understand whether most visitors find you on mobile, desktop, or tablet." />
              </div>
              <p className="text-sm text-gray-500">Search traffic by device type</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50/50 text-gray-500">
                    <th className="p-6 font-semibold uppercase tracking-wider text-[10px]">Device</th>
                    <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">
                      <span className="inline-flex items-center gap-1 justify-end">
                        Clicks
                        <MetricTooltip text="Times users on this device clicked your link in Google results." below />
                      </span>
                    </th>
                    <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">
                      <span className="inline-flex items-center gap-1 justify-end">
                        Impressions
                        <MetricTooltip text="Times your site appeared in search results on this device type." below />
                      </span>
                    </th>
                    <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">
                      <span className="inline-flex items-center gap-1 justify-end">
                        CTR
                        <MetricTooltip text="Click-through rate for this device type." below />
                      </span>
                    </th>
                    <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">
                      <span className="inline-flex items-center gap-1 justify-end">
                        Avg. Position
                        <MetricTooltip text="Average ranking position in search results for this device type." below />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {gscDevicesData.rows.map((row: any, i: number) => {
                    const device = row.keys[0];
                    const label = device.charAt(0).toUpperCase() + device.slice(1).toLowerCase();
                    return (
                      <tr key={i} className="hover:bg-gray-100 transition-colors">
                        <td className="p-6 font-medium text-gray-900">{label}</td>
                        <td className="p-6 text-right text-gray-500 font-mono">{row.clicks.toLocaleString()}</td>
                        <td className="p-6 text-right text-gray-500 font-mono">{row.impressions.toLocaleString()}</td>
                        <td className="p-6 text-right text-gray-500 font-mono">{(row.ctr * 100).toFixed(1)}%</td>
                        <td className="p-6 text-right text-gray-500 font-mono">{row.position.toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPageSpeed = () => {
    if (!client?.hasPSI) return <NoDataConfigured source="PageSpeed Insights" />;
    if (psiLoading) return <LoadingState />;
    if (psiError) return <ErrorState message={psiError} />;
    if (!psiData) return <div className="p-12 text-center text-gray-400">No PageSpeed data available</div>;

    return (
      <div className="space-y-8">
        <div className="flex justify-end">
          <div className="bg-gray-100 p-1 rounded-xl flex">
            <button
              onClick={() => setPsiStrategy('mobile')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${psiStrategy === 'mobile' ? 'bg-white text-gray-900 shadow-none' : 'text-gray-500 hover:text-gray-600'
                }`}
            >
              Mobile
            </button>
            <button
              onClick={() => setPsiStrategy('desktop')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${psiStrategy === 'desktop' ? 'bg-white text-gray-900 shadow-none' : 'text-gray-500 hover:text-gray-600'
                }`}
            >
              Desktop
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <ScoreCircle label="Performance" score={psiData.lighthouseResult?.categories?.performance?.score} tooltip="How fast your page loads and responds to users. Higher scores mean a better experience and lower bounce rates." />
          <ScoreCircle label="Accessibility" score={psiData.lighthouseResult?.categories?.accessibility?.score} tooltip="How easy it is for all users, including those with disabilities, to navigate and use your website." />
          <ScoreCircle label="Best Practices" score={psiData.lighthouseResult?.categories?.['best-practices']?.score} tooltip="Whether your site follows modern web development standards, security practices and browser compatibility." />
          <ScoreCircle label="SEO" score={psiData.lighthouseResult?.categories?.seo?.score} tooltip="How well your page is technically optimised for search engine discovery and indexing." />
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-none">
          <h3 className="text-lg font-bold text-gray-900 mb-8">Core Web Vitals</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <VitalsCard
              label="Largest Contentful Paint"
              value={psiData.lighthouseResult?.audits?.['largest-contentful-paint']?.displayValue}
              score={psiData.lighthouseResult?.audits?.['largest-contentful-paint']?.score}
              description="Measures loading performance"
            />
            <VitalsCard
              label="Total Blocking Time"
              value={psiData.lighthouseResult?.audits?.['total-blocking-time']?.displayValue}
              score={psiData.lighthouseResult?.audits?.['total-blocking-time']?.score}
              description="Measures responsiveness"
            />
            <VitalsCard
              label="Cumulative Layout Shift"
              value={psiData.lighthouseResult?.audits?.['cumulative-layout-shift']?.displayValue}
              score={psiData.lighthouseResult?.audits?.['cumulative-layout-shift']?.score}
              description="Measures visual stability"
            />
          </div>
        </div>
      </div>
    );
  };

  const renderWebsiteStats = () => {
    if (!client?.hasMainWP) return <NoDataConfigured source="MainWP" />;
    if (mainwpLoading) return <LoadingState />;
    if (mainwpError) return <ErrorState message={mainwpError} />;
    if (!mainwpData) return <LoadingState />;

    const d = mainwpData as any;
    const upgrades: any[] = d.upgrades || [];
    const hasUpdates = upgrades.length > 0;

    const typeLabel: Record<string, string> = {
      core: 'Core',
      plugin: 'Plugin',
      theme: 'Theme',
      translation: 'Translation',
    };

    const typeBadge: Record<string, string> = {
      core: 'bg-blue-50 text-blue-700',
      plugin: 'bg-purple-50 text-purple-700',
      theme: 'bg-indigo-50 text-indigo-700',
      translation: 'bg-gray-100 text-gray-600',
    };

    const stats = [
      { label: 'WordPress Version', value: d.wpVersion || '—' },
      { label: 'PHP Version', value: d.phpVersion || '—' },
      { label: 'MySQL Version', value: d.mysqlVersion || '—' },
      { label: 'Memory Limit', value: d.memoryLimit || '—' },
      { label: 'Active Theme', value: d.activeTheme || '—' },
      { label: 'Server IP', value: d.serverIp || '—' },
      {
        label: 'Last Sync',
        value: d.lastSynced
          ? new Date(d.lastSynced).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
          : '—',
        sub: d.lastSynced
          ? new Date(d.lastSynced).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
          : null,
      },
    ];

    const rawCarePlan = client?.care_plan || null;
    // Match on first word so "Pink Plan" → pink, "White Plan" → white, "Black Plan" → black
    const carePlanKey = rawCarePlan ? rawCarePlan.toLowerCase().split(' ')[0] : null;
    const carePlanStyles: Record<string, { bg: string; text: string; border: string; chip: string }> = {
      pink:  { bg: 'bg-pink-50',   text: 'text-pink-800',  border: 'border-pink-200', chip: 'bg-pink-400' },
      white: { bg: 'bg-white',     text: 'text-gray-700',  border: 'border-gray-200', chip: 'bg-white border-2 border-gray-300' },
      black: { bg: 'bg-gray-900',  text: 'text-white',     border: 'border-gray-700', chip: 'bg-gray-900' },
    };
    const cpStyle = carePlanKey ? carePlanStyles[carePlanKey] : null;

    return (
      <div className="space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-3xl border border-gray-200 p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{s.label}</p>
              <p className="text-base font-bold text-gray-900 break-all leading-tight">{s.value}</p>
              {(s as any).sub && (
                <p className="text-xs text-gray-400 mt-1">{(s as any).sub}</p>
              )}
            </div>
          ))}
          {/* Care Plan card — fills the 8th (empty) slot in the 4-column grid */}
          <div className={`rounded-3xl border p-5 ${cpStyle ? `${cpStyle.bg} ${cpStyle.border}` : 'bg-white border-gray-200'}`}>
            <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${cpStyle?.text || 'text-gray-500'}`}>Care Plan</p>
            {rawCarePlan && cpStyle ? (
              <div className="flex items-center gap-2">
                <span className={`inline-block w-4 h-4 rounded-full shrink-0 ${cpStyle.chip}`} />
                <p className={`text-base font-bold ${cpStyle.text}`}>{rawCarePlan}</p>
              </div>
            ) : (
              <p className="text-base font-bold text-gray-400">—</p>
            )}
          </div>
        </div>

        {/* Update schedule disclaimer */}
        <p className="text-[11px] text-gray-400 leading-relaxed">
          <span className="font-medium text-gray-500">Please note:</span> WordPress updates — including core, plugin, and theme updates — are typically undertaken once per calendar month.
        </p>

        {/* Pending upgrades table */}
        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Pending Updates</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {hasUpdates
                  ? `${upgrades.length} update${upgrades.length !== 1 ? 's' : ''} available`
                  : 'Everything is up to date'}
              </p>
            </div>
            {hasUpdates && (
              <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold">
                {upgrades.length} pending
              </span>
            )}
          </div>
          {hasUpdates ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-gray-50/60 text-gray-500">
                    <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">Type</th>
                    <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">Name</th>
                    <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">Current</th>
                    <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">Available</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {upgrades.map((u: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeBadge[u.type] || 'bg-gray-100 text-gray-600'}`}>
                          {typeLabel[u.type] || u.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">{u.name}</td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">{u.currentVersion || '—'}</td>
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-amber-600">{u.newVersion || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-10 text-center">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">All plugins, themes and core are up to date.</p>
            </div>
          )}
        </div>

        {/* Completed updates table */}
        {(() => {
          const completed: any[] = d.completedUpdates || [];
          if (completed.length === 0) return null;
          return (
            <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Recently Updated</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Changes detected since the last snapshot</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                  {completed.length} updated
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="bg-gray-50/60 text-gray-500">
                      <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">Type</th>
                      <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">Name</th>
                      <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">From</th>
                      <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">To</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {completed.map((u: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeBadge[u.type] || 'bg-gray-100 text-gray-600'}`}>
                            {typeLabel[u.type] || u.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">{u.name}</td>
                        <td className="px-6 py-4 font-mono text-xs text-gray-400">{u.from}</td>
                        <td className="px-6 py-4 font-mono text-xs font-semibold text-emerald-600">{u.to}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  const ScoreCircle = ({ label, score, tooltip }: any) => {
    const value = Math.round((score || 0) * 100);
    const isGood = value >= 90;
    const isMid  = value >= 50 && value < 90;
    const color       = isGood ? 'text-emerald-600' : isMid ? 'text-amber-500' : 'text-red-500';
    const strokeColor = isGood ? '#10b981'           : isMid ? '#f59e0b'        : '#ef4444';
    const trackColor  = isGood ? '#d1fae5'           : isMid ? '#fef3c7'        : '#fee2e2';
    const statusLabel = isGood ? 'Good'              : isMid ? 'Needs improvement' : 'Poor';
    const statusColor = isGood ? 'text-emerald-600'  : isMid ? 'text-amber-500'    : 'text-red-500';

    return (
      <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-none flex flex-col items-center text-center group hover:shadow-none transition-all">
        <div className="relative w-24 h-24 mb-6">
          <svg className="w-full h-full" viewBox="0 0 36 36">
            <path
              stroke={trackColor}
              strokeWidth="3"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <motion.path
              initial={{ strokeDasharray: "0, 100" }}
              animate={{ strokeDasharray: `${value}, 100` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              stroke={strokeColor}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <div className={`absolute inset-0 flex items-center justify-center text-2xl font-bold ${color}`}>
            {value}
          </div>
        </div>
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <h3 className="text-sm font-bold text-gray-900">{label}</h3>
          {tooltip && <MetricTooltip text={tooltip} />}
        </div>
        <p className={`text-xs font-semibold ${statusColor}`}>{statusLabel}</p>
        <p className="text-[10px] text-gray-400 mt-1.5 leading-snug">
          <span className="text-emerald-600 font-medium">90–100</span> good ·{' '}
          <span className="text-amber-500 font-medium">50–89</span> fair ·{' '}
          <span className="text-red-500 font-medium">0–49</span> poor
        </p>
      </div>
    );
  };

  const VitalsCard = ({ label, value, score, description }: any) => {
    const color = score >= 0.9 ? 'text-emerald-500' : score >= 0.5 ? 'text-amber-500' : 'text-red-500';
    const bgColor = score >= 0.9 ? 'bg-emerald-500' : score >= 0.5 ? 'bg-amber-500' : 'bg-red-500';

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-900 uppercase tracking-wider">{label}</p>
          <span className={`text-sm font-mono font-bold ${color}`}>{value || 'N/A'}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(score || 0) * 100}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={`h-full ${bgColor}`}
          />
        </div>
        <p className="text-[10px] text-gray-500">{description}</p>
      </div>
    );
  };

  const LoadingState = () => (
    <div className="h-96 bg-white rounded-3xl border border-gray-200 flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div>
      </div>
      <p className="text-sm font-medium text-gray-400">Synchronizing data sources...</p>
    </div>
  );

  const ErrorState = ({ message }: { message: string }) => (
    <div className="p-8 bg-rose-900/20 border border-rose-100 rounded-3xl text-rose-400 flex items-start gap-4">
      <div className="p-2 bg-rose-100 rounded-xl">
        <AlertCircle className="w-6 h-6" />
      </div>
      <div>
        <h4 className="font-bold text-lg mb-1">Connection Interrupted</h4>
        <p className="text-sm opacity-80 leading-relaxed">{message}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors"
        >
          Retry Connection
        </button>
      </div>
    </div>
  );

  const NoDataConfigured = ({ source }: { source: string }) => (
    <div className="p-20 bg-white rounded-3xl border border-gray-200 text-center">
      <div className="w-20 h-20 bg-gray-50 text-gray-900 rounded-3xl flex items-center justify-center mx-auto mb-6">
        <Layers className="w-10 h-10" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">{source} Integration</h3>
      <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
        This data source hasn't been configured for this client yet. Please contact your account manager to enable {source} tracking.
      </p>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-gray-900" />
        <p className="text-sm font-medium text-gray-400 animate-pulse">Initializing Dashboard...</p>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white p-12 rounded-3xl shadow-none border border-gray-200 text-center max-w-md w-full">
          <div className="w-20 h-20 bg-rose-900/20 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Dashboard Unavailable</h2>
          <p className="text-gray-500 leading-relaxed mb-8">{error || 'The requested client dashboard does not exist or you do not have permission to view it.'}</p>
          <a href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-all">
            Return Home
          </a>
        </div>
      </div>
    );
  }

  const NotificationIcon = () => {
    const iconName = client.global_notification_icon || 'AlertCircle';
    switch (iconName) {
      case 'Info': return <Info className="w-5 h-5 mr-3" />;
      case 'CheckCircle': return <CheckCircle className="w-5 h-5 mr-3" />;
      case 'AlertTriangle': return <AlertTriangle className="w-5 h-5 mr-3" />;
      case 'Zap': return <Zap className="w-5 h-5 mr-3" />;
      case 'Megaphone': return <Megaphone className="w-5 h-5 mr-3" />;
      case 'Bell': return <Bell className="w-5 h-5 mr-3" />;
      default: return <AlertCircle className="w-5 h-5 mr-3" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      {client.global_notification && (() => {
        // WCAG AA-compliant colour map (white text on dark bg, all ≥ 4.5:1 contrast)
        const colorMap: Record<string, string> = {
          green: '#15803d', // contrast 4.64:1 ✓
          yellow: '#b45309', // contrast 4.73:1 ✓
          red: '#b91c1c', // contrast 6.14:1 ✓
        };
        const bg = colorMap[client.global_notification_color || 'red'] ?? colorMap.red;
        return (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 50, opacity: 1 }}
            style={{ backgroundColor: bg }}
            className="text-white px-4 h-[50px] flex items-center justify-center text-sm font-bold z-50 relative overflow-hidden shrink-0"
          >
            <NotificationIcon />
            <span>{client.global_notification}</span>
          </motion.div>
        );
      })()}

      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Logo className="h-9 text-gray-900" />
            <div className="h-8 w-px bg-gray-200 hidden sm:block"></div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-3">
                {client.website_url && (
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${new URL(client.website_url).hostname}&sz=64`}
                    alt=""
                    className="w-6 h-6 rounded-md"
                    referrerPolicy="no-referrer"
                  />
                )}
                <h1 className="text-lg font-bold text-gray-900 tracking-tight">{client.name}</h1>
              </div>
              {client.website_url && (
                <a
                  href={client.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-medium text-gray-400 hover:text-gray-900 transition-colors flex items-center gap-1.5"
                >
                  {client.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-3 bg-gray-100 p-1 rounded-2xl border border-gray-200">
              {dateRange === 'custom' && (
                <div className="flex items-center gap-2 px-2">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-transparent border-none text-[11px] font-bold focus:ring-0 p-0 w-24"
                  />
                  <span className="text-gray-600">-</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-transparent border-none text-[11px] font-bold focus:ring-0 p-0 w-24"
                  />
                </div>
              )}
              <div className="relative">
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="appearance-none bg-white px-4 py-2 pr-10 rounded-xl text-[11px] font-bold border border-gray-200 shadow-none focus:outline-none focus:ring-2 focus:ring-gray-900/20 cursor-pointer"
                >
                  <option value="30daysAgo">Last 30 Days</option>
                  <option value="90daysAgo">Last 3 Months</option>
                  <option value="365daysAgo">Last 12 Months</option>
                  <option value="custom">Custom Range</option>
                </select>
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
              <span className="text-[11px] font-medium text-gray-500 px-2 hidden xl:block">
                {displayDateRange}
              </span>
            </div>

            <button
              onClick={downloadPDF}
              disabled={pdfGenerating}
              className="flex items-center gap-2.5 px-5 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 transition-all shadow-none active:scale-95"
            >
              {pdfGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              <span>Export Report</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden max-w-[1600px] mx-auto w-full">
        {/* Sidebar Navigation */}
        <aside className="w-72 bg-white border-r border-gray-200 hidden md:flex flex-col">
          <div className="flex-1 py-10 px-6 space-y-8 overflow-y-auto">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-6 px-4">Navigation</p>
              <nav className="space-y-1.5">
                {pages.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => setActivePage(page.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all group ${activePage === page.id
                        ? 'bg-gray-900 text-white shadow-none'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                  >
                    <div className="flex items-center gap-4">
                      <page.icon className={`w-5 h-5 transition-colors ${activePage === page.id ? 'text-gray-400' : 'text-gray-400 group-hover:text-gray-900'}`} />
                      <span>{page.name}</span>
                    </div>
                    {activePage === page.id && (
                      <motion.div layoutId="active-indicator" className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </button>
                ))}
              </nav>
            </div>

            <div className="pt-8 border-t border-gray-200">
              <div className="bg-gray-100 rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-gray-200 rounded-full opacity-50"></div>
                <div className="relative z-10">
                  <p className="text-[10px] font-bold text-gray-900 uppercase tracking-wider mb-3">Reporting System Status</p>
                  <div className="flex items-center gap-3 text-xs font-bold text-gray-900">
                    <div className="relative">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                      <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
                    </div>
                    <span>Using live data</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </aside>

        {/* Main Content Area */}
        <main id="pdf-main-content" className="flex-1 overflow-y-auto bg-gray-50 p-6 sm:p-10 lg:p-14">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-12"
            >
<div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                  <h2 className="text-4xl font-black text-gray-900 tracking-tight mb-2">
                    {pages.find(p => p.id === activePage)?.name}
                  </h2>
                  <p className="text-gray-500 font-medium max-w-2xl">
                    {pageSubtitles[activePage] || ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl border border-gray-200 shadow-none self-start sm:self-auto">
                  <Activity className="w-4 h-4 text-gray-900" />
                  <span className="text-xs font-bold text-gray-500">Updated {format(new Date(), 'h:mm a')}</span>
                </div>
              </div>
            </motion.div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activePage}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                {renderPageContent()}
              </motion.div>
            </AnimatePresence>

            {/* Disclaimer */}
            <div className="mt-10 border-t border-gray-100 pt-6 space-y-2 max-w-xl">
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Data presented in this report is sourced from Google Search Console, Google Analytics 4, MainWP, PageSpeed Insights, and Uptime Monitor. Figures may vary between platforms due to differences in data collection methods and attribution. All data is provided for indicative purposes only.
              </p>
              <p className="text-[10px] text-gray-400">
                © {new Date().getFullYear()} Stoke Design Co Pty Ltd T/A Stoke Design™. All Rights Reserved.
              </p>
            </div>
          </div>
        </main>
      </div>


{/* ── PDF Generation Progress Modal ── */}
      {pdfProgress && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-2xl p-8 w-80 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {pdfProgress.label.startsWith('Error:') ? 'Export Failed' : 'Generating PDF'}
            </h3>
            <p className={`text-sm mb-5 ${pdfProgress.label.startsWith('Error:') ? 'text-red-500' : 'text-gray-500'}`}>
              {pdfProgress.label}
            </p>
            {!pdfProgress.label.startsWith('Error:') && (
              <>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-900 rounded-full transition-all duration-500"
                    style={{ width: `${(pdfProgress.current / pdfProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2 text-right">
                  {pdfProgress.current} of {pdfProgress.total}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  function renderPageContent() {
    switch (activePage) {
      case 0: return renderAiOverview();
      case 1: return renderReportOverview();
      case 2: return renderAnalyticsOverview();
      case 3: return renderTrafficSources();
      case 4: return renderPagesAndLanding();
      case 5: return renderWebsiteEvents();
      case 6: return renderSearchPerformance();
      case 7: return renderPageSpeed();
      case 8: return renderUptimeMonitor();
      case 9: return renderWebsiteStats();
      default: return renderAiOverview();
    }
  }

  function renderReportOverview() {
    if (reportOverviewLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          <p className="text-gray-500 text-sm">Generating your executive summary…</p>
          <p className="text-gray-400 text-xs">This may take up to 20 seconds</p>
        </div>
      );
    }
    if (reportOverviewError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-red-500 font-medium">{reportOverviewError}</p>
          <button
            onClick={() => { setReportOverviewData(null); setReportOverviewError(''); fetchReportOverview(); }}
            className="mt-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-xl hover:bg-gray-700 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }
    if (!reportOverviewData) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <ClipboardList className="w-8 h-8 text-gray-300" />
          <p className="text-gray-400 text-sm">No report data available</p>
        </div>
      );
    }

    const { summary, keyMetrics, generatedAt, reportStart, reportEnd } = reportOverviewData;
    const km = keyMetrics || {};

    const statCards = [
      km.ga && { label: 'Active Users', value: parseInt(km.ga.activeUsers || '0').toLocaleString(), icon: Users, sub: `${km.ga.engagementRate}% engagement`, tooltip: 'The number of people who visited your site and had at least one engaged session in the period.' },
      km.ga && { label: 'Sessions', value: parseInt(km.ga.sessions || '0').toLocaleString(), icon: Activity, sub: `${parseInt(km.ga.newUsers || '0').toLocaleString()} new users`, tooltip: 'A group of user interactions within a 30-minute window. Each visit typically counts as one session.' },
      km.gsc && { label: 'Search Clicks', value: km.gsc.totalClicks.toLocaleString(), icon: MousePointerClick, sub: `${km.gsc.totalImpressions.toLocaleString()} impressions`, tooltip: 'How many times users clicked your website link in Google search results during the period.' },
      km.gsc && { label: 'Avg Position', value: `#${km.gsc.avgPosition}`, icon: Search, sub: `${km.gsc.avgCtr}% avg CTR`, tooltip: 'Your average ranking position in Google search. Lower is better — position 1 means top of page.' },
      km.psi && { label: 'Performance', value: `${km.psi.performance}/100`, icon: Gauge, sub: `SEO ${km.psi.seo}/100`, tooltip: 'How fast your page loads and responds. Higher scores mean a better user experience.' },
      km.mainwp && { label: 'WP Updates', value: km.mainwp.pendingUpdates, icon: RefreshCw, sub: `WordPress ${km.mainwp.wpVersion}`, tooltip: 'Pending plugin, theme or WordPress core updates that need to be applied to keep your site secure.' },
    ].filter(Boolean) as { label: string; value: any; icon: any; sub: string; tooltip?: string }[];

    return (
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Report Overview</h2>
          <p className="text-sm text-gray-500 mt-1">
            {reportStart && reportEnd ? `${reportStart} – ${reportEnd}` : 'Last 30 days'}
            {generatedAt && (
              <span className="ml-3 text-gray-400">
                · Generated {(() => {
                  const diffMs = Date.now() - new Date(generatedAt).getTime();
                  const diffH = Math.floor(diffMs / 3600000);
                  const diffM = Math.floor((diffMs % 3600000) / 60000);
                  if (diffH >= 1) return `${diffH}h ago`;
                  if (diffM >= 1) return `${diffM}m ago`;
                  return 'just now';
                })()}
              </span>
            )}
          </p>
        </div>

        {/* Key Metric Cards */}
        {statCards.length > 0 && (
          <div className={`grid gap-4 ${statCards.length <= 2 ? 'grid-cols-2' : statCards.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'}`}>
            {statCards.map(({ label, value, icon: Icon, sub, tooltip }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="bg-white rounded-2xl border border-gray-200 p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">{label}</span>
                  {tooltip && <MetricTooltip text={tooltip} />}
                </div>
                <p className="text-2xl font-bold text-gray-900 font-mono">{value}</p>
                <p className="text-xs text-gray-400 mt-1">{sub}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Report Summary */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-3xl border border-gray-200 p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gray-50 rounded-xl">
              <Sparkles className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Report Summary</h3>
            </div>
          </div>
          <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed space-y-4">
            {summary.split('\n\n').filter(Boolean).map((para: string, i: number) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          {/* Sign-off */}
          <div className="mt-6 pt-6 border-t border-gray-100 text-sm text-gray-600 space-y-1">
            <p>If you have any questions about your report, please don't hesitate to reach out to the Stoke team at{' '}
              <a href="mailto:support@stokedesign.co" className="text-gray-900 font-medium hover:underline">support@stokedesign.co</a>{' '}
              or call us on{' '}
              <a href="tel:0353127136" className="text-gray-900 font-medium hover:underline">03 5312 7136</a>.
            </p>
            <p className="font-medium text-gray-800">— The Stoke Design Team</p>
          </div>

          {generatedAt && (
            <p className="text-xs text-gray-300 mt-4 border-t border-gray-100 pt-4">
              Generated {new Date(generatedAt).toLocaleString('en-AU')}
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  function renderUptimeMonitor() {
    if (!client?.hasUptime) return <NoDataConfigured source="Uptime Kuma" />;
    if (uptimeLoading) return <LoadingState />;
    if (uptimeError) return <ErrorState message={uptimeError} />;
    if (!uptimeData) return <div className="p-12 text-center text-gray-400">No uptime data available</div>;

    const { title, monitors } = uptimeData as { title: string; monitors: any[] };

    // Status helpers
    const statusLabel = (s: number | null) =>
      s === 1 ? 'UP' : s === 0 ? 'DOWN' : s === 2 ? 'PENDING' : s === 3 ? 'MAINTENANCE' : 'UNKNOWN';
    const statusColour = (s: number | null) =>
      s === 1 ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
        : s === 0 ? 'text-red-600 bg-red-50 border-red-200'
          : s === 2 ? 'text-amber-600 bg-amber-50 border-amber-200'
            : 'text-blue-600 bg-blue-50 border-blue-200';
    const dotColour = (s: number | null) =>
      s === 1 ? 'bg-emerald-500' : s === 0 ? 'bg-red-500' : s === 2 ? 'bg-amber-400' : 'bg-blue-400';
    const beatColour = (s: number) =>
      s === 1 ? '#10b981' : s === 0 ? '#ef4444' : s === 2 ? '#f59e0b' : '#60a5fa';

    return (
      <div className="space-y-10">
        {/* Page header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500 mt-1">Real-time and historical uptime data from Uptime Kuma</p>
        </div>

        {monitors.length === 0 && (
          <div className="p-12 text-center text-gray-400">No monitors found on this status page.</div>
        )}

        {monitors.map((monitor: any) => {
          // Build response-time chart data (oldest → newest)
          const chartData = monitor.heartbeats
            .filter((h: any) => h.ping != null && h.ping > 0)
            .slice(-60)
            .map((h: any, i: number) => ({ i, ping: h.ping, time: h.time }));

          return (
            <motion.div
              key={monitor.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border border-gray-200 overflow-hidden"
            >
              {/* Monitor header */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`w-3 h-3 rounded-full ${dotColour(monitor.currentStatus)}`} />
                    {monitor.currentStatus === 1 && (
                      <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-500 animate-ping opacity-75" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{monitor.name}</h3>
                    <p className="text-xs text-gray-400 uppercase tracking-wider">{monitor.type}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full border text-xs font-bold tracking-wider ${statusColour(monitor.currentStatus)}`}>
                  {statusLabel(monitor.currentStatus)}
                </span>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
                {[
                  { label: 'Uptime (24 h)', value: monitor.uptime24h != null ? `${monitor.uptime24h}%` : '—', Icon: Activity },
                  { label: 'Uptime (30 d)', value: monitor.uptime30d != null ? `${monitor.uptime30d}%` : '—', Icon: TrendingUp },
                  { label: 'Avg Response', value: monitor.avgPing != null ? `${monitor.avgPing} ms` : '—', Icon: Timer },
                  { label: 'Checks Shown', value: monitor.heartbeats.length > 0 ? `${monitor.heartbeats.length}` : '—', Icon: Clock },
                ].map(({ label, value, Icon }) => (
                  <div key={label} className="p-5 text-center">
                    <Icon className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                    <p className="text-xl font-bold text-gray-900">{value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Heartbeat bar history */}
              {monitor.heartbeats.length > 0 && (
                <div className="px-6 pb-4 pt-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Last {monitor.heartbeats.length} checks
                  </p>
                  <div className="flex gap-px flex-wrap">
                    {monitor.heartbeats.map((h: any, i: number) => (
                      <div
                        key={i}
                        title={`${h.time ? new Date(h.time).toLocaleString() : ''} — ${statusLabel(h.status)}${h.ping ? ` (${h.ping} ms)` : ''}`}
                        className="h-8 flex-1 min-w-[4px] max-w-[12px] rounded-sm cursor-default transition-opacity hover:opacity-70"
                        style={{ backgroundColor: beatColour(h.status) }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                    <span>Oldest</span>
                    <span>Latest</span>
                  </div>
                </div>
              )}

              {/* Response time chart */}
              {chartData.length > 1 && (
                <div className="px-6 pb-6">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Response Time (ms)
                  </p>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`uptimeGrad-${monitor.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="i" hide />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(v: any) => [`${v} ms`, 'Response time']}
                        labelFormatter={() => ''}
                        contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="ping"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill={`url(#uptimeGrad-${monitor.id})`}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    );
  }
}
