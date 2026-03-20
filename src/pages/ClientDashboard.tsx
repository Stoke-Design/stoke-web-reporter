import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, AreaChart, Area
} from 'recharts';
import { format, subDays, parseISO, eachDayOfInterval } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import {
  Loader2, AlertCircle, TrendingUp, Users, Eye, MousePointerClick, Search, Download, ExternalLink,
  LayoutDashboard, Share2, FileText, Zap, Gauge, Database, RefreshCw,
  Calendar, Globe, ArrowUpRight, ArrowDownRight, Activity, Clock, Layers,
  Info, CheckCircle, AlertTriangle, Megaphone, Bell, Sparkles, Phone, Mail,
  Wifi, WifiOff, Timer, ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';
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
    const element = document.getElementById('dashboard-content');
    if (!element) return;

    setPdfGenerating(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#fafafa',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgProps = pdf.getImageProperties(imgData);
      const pdfImgHeight = (imgProps.height * pdfWidth) / imgProps.width;

      let heightLeft = pdfImgHeight;
      let position = 0;
      let pageHeight = pdfHeight;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfImgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfImgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfImgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${client?.name || 'client'}-report-${formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd')}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
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
              {pdfGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
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
        <main id="dashboard-content" className="flex-1 overflow-y-auto bg-gray-50 p-6 sm:p-10 lg:p-14">
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
            <p className="mt-10 text-[10px] text-gray-400 leading-relaxed border-t border-gray-100 pt-6 max-w-xl">
              Data presented in this report is sourced from Google Search Console, Google Analytics 4, MainWP, PageSpeed Insights, and Uptime Monitor. Figures may vary between platforms due to differences in data collection methods and attribution. All data is provided for indicative purposes only.
            </p>
          </div>
        </main>
      </div>
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
