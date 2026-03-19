import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend, AreaChart, Area
} from 'recharts';
import { format, subDays, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import {
  Loader2, AlertCircle, TrendingUp, Users, Eye, MousePointerClick, Search, Download, ExternalLink,
  LayoutDashboard, Share2, FileText, Zap, Gauge, Database, RefreshCw, ChevronRight,
  Calendar, Globe, ArrowUpRight, ArrowDownRight, Activity, Clock, Layers,
  Info, CheckCircle, AlertTriangle, Megaphone, Bell, Sparkles, Phone, Mail,
  Wifi, WifiOff, Timer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Logo } from '../components/Logo';
import { GoogleGenAI } from "@google/genai";

const TIMEZONE = 'Australia/Melbourne';

interface ClientInfo {
  client_id_number: string | null;
  name: string;
  slug: string;
  website_url: string | null;
  contact_first_name: string | null;
  hasGA: boolean;
  hasGSC: boolean;
  hasBQ: boolean;
  hasPSI: boolean;
  hasUptime: boolean;
  global_notification: string | null;
  global_notification_icon: string | null;
  global_notification_color: string | null;
  enabled_pages?: string;
}

export default function ClientDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const [activePage, setActivePage] = useState(0);
  const [gaData, setGaData] = useState<any>(null);
  const [gaExtendedData, setGaExtendedData] = useState<any>(null);
  const [gaTrafficData, setGaTrafficData] = useState<any>(null);
  const [gaPagesData, setGaPagesData] = useState<any>(null);
  const [gaEventsData, setGaEventsData] = useState<any>(null);
  const [gaLoading, setGaLoading] = useState(false);
  const [gaError, setGaError] = useState('');

  const [gscData, setGscData] = useState<any>(null);
  const [gscLoading, setGscLoading] = useState(false);
  const [gscError, setGscError] = useState('');

  const [bqData, setBqData] = useState<any>(null);
  const [bqLoading, setBqLoading] = useState(false);
  const [bqError, setBqError] = useState('');

  const [psiData, setPsiData] = useState<any>(null);
  const [psiHistory, setPsiHistory] = useState<any[]>([]);
  const [psiLoading, setPsiLoading] = useState(false);
  const [psiError, setPsiError] = useState('');
  const [psiStrategy, setPsiStrategy] = useState<'mobile' | 'desktop'>('mobile');

  const [uptimeData, setUptimeData] = useState<any>(null);
  const [uptimeLoading, setUptimeLoading] = useState(false);
  const [uptimeError, setUptimeError] = useState('');

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
      
      if (client.hasGA) {
        if (activePage === 0 || activePage === 1) {
          fetchGA('overview');
          fetchGA('overview_extended');
        } else if (activePage === 2) {
          fetchGA('traffic_sources');
        } else if (activePage === 3) {
          fetchGA('pages');
          fetchGA('landing_pages');
        } else if (activePage === 4) {
          fetchGA('events');
        }
      }
      
      if (client.hasGSC && (activePage === 0 || activePage === 5)) fetchGSC();
      if (client.hasBQ && (activePage === 8 || activePage === 9)) fetchBQ();
      if (client.hasPSI && (activePage === 0 || activePage === 6)) {
        fetchPSI();
        fetchPSIHistory();
      }
      if (client.hasUptime && activePage === 7) {
        fetchUptime();
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
      
      const res = await fetch(`/api/client/${slug}/gsc?startDate=${startDate}&endDate=${endDate}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch GSC data');
      setGscData(data);
    } catch (err: any) {
      setGscError(err.message);
    } finally {
      setGscLoading(false);
    }
  };

  const fetchBQ = async () => {
    setBqLoading(true);
    setBqError('');
    try {
      const res = await fetch(`/api/client/${slug}/bq`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch BQ data');
      setBqData(data);
    } catch (err: any) {
      setBqError(err.message);
    } finally {
      setBqLoading(false);
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
        
        IMPORTANT: Start the response with a friendly greeting addressing the client by their first name.
        For example: "Hey ${client.contact_first_name || 'there'}, this month..."
        
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

  const gscChartData = useMemo(() => {
    if (!gscData || !gscData.rows) return [];
    return gscData.rows.map((row: any) => ({
      date: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: (row.ctr * 100).toFixed(2),
      position: row.position.toFixed(1),
    })).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [gscData]);

  const allPages = [
    { id: 0, name: 'AI Insights Overview', icon: Sparkles, source: 'AI' },
    { id: 1, name: 'Analytics Overview', icon: LayoutDashboard, source: 'GA4' },
    { id: 2, name: 'Traffic Sources', icon: Share2, source: 'GA4' },
    { id: 3, name: 'Pages & Landing Pages', icon: FileText, source: 'GA4' },
    { id: 4, name: 'Website Events', icon: Zap, source: 'GA4' },
    { id: 5, name: 'Search Performance', icon: Search, source: 'SC' },
    { id: 6, name: 'Page Speed', icon: Gauge, source: 'PSI' },
    { id: 7, name: 'Uptime Monitor', icon: Activity, source: 'Uptime' },
    { id: 8, name: 'Website Statistics', icon: Database, source: 'BQ' },
    { id: 9, name: 'Website Updates', icon: RefreshCw, source: 'BQ' },
  ];

  const pages = useMemo(() => {
    if (!client) return [];
    let enabledPageIds = [0, 1, 2, 3, 4, 5, 6, 7, 8];
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

  const MetricCard = ({ title, value, icon: Icon, trend, trendValue, delay = 0 }: any) => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white p-6 rounded-2xl border border-gray-200 shadow-none hover:shadow-none transition-all group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="p-2.5 bg-gray-50 rounded-xl group-hover:bg-gray-100 transition-colors">
          <Icon className="w-5 h-5 text-gray-500 group-hover:text-gray-900 transition-colors" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend === 'up' ? 'text-emerald-500' : 'text-rose-400'}`}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trendValue}
          </div>
        )}
      </div>
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{title}</h3>
      <p className="text-2xl font-bold text-gray-900 font-mono tracking-tight">{value}</p>
    </motion.div>
  );

  const renderAnalyticsOverview = () => {
    if (!client?.hasGA) return <NoDataConfigured source="Google Analytics" />;
    if (gaLoading && !gaData) return <LoadingState />;
    if (gaError) return <ErrorState message={gaError} />;

    const extendedMetrics = gaExtendedData?.rows?.[0]?.metricValues || [];
    const activeUsers = extendedMetrics[0]?.value || '0';
    const newUsers = extendedMetrics[1]?.value || '0';
    const newUserPercentage = activeUsers !== '0' ? ((parseInt(newUsers) / parseInt(activeUsers)) * 100).toFixed(1) : '0';
    const sessions = extendedMetrics[2]?.value || '0';
    const views = extendedMetrics[3]?.value || '0';
    const engagementRate = (parseFloat(extendedMetrics[5]?.value || '0') * 100).toFixed(1);
    const totalEngagementTime = parseFloat(extendedMetrics[6]?.value || '0');
    const pageViewsPerUser = activeUsers !== '0' ? (parseInt(views) / parseInt(activeUsers)).toFixed(2) : '0';

    const formatDuration = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      if (h > 0) return `${h}h ${m}m ${s}s`;
      if (m > 0) return `${m}m ${s}s`;
      return `${s}s`;
    };

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard title="Active Users" value={parseInt(activeUsers).toLocaleString()} icon={Users} delay={0.1} />
          <MetricCard title="New Users" value={parseInt(newUsers).toLocaleString()} icon={Users} delay={0.2} />
          <MetricCard title="Engagement Rate" value={`${engagementRate}%`} icon={Zap} delay={0.3} />
          <MetricCard title="Views" value={parseInt(views).toLocaleString()} icon={Eye} delay={0.4} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-gray-200 shadow-none">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-gray-900">User Activity</h3>
                <p className="text-sm text-gray-500">Daily active users over the selected period</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#e35e3d]"></div>
                  <span className="text-xs text-gray-500">Active Users</span>
                </div>
              </div>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={gaChartData}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e35e3d" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#e35e3d" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
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
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#a1a1aa' }}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    labelFormatter={(val) => {
                      try { return format(parseISO(val), 'MMM d, yyyy'); } catch { return val; }
                    }}
                  />
                  <Area type="monotone" dataKey="activeUsers" name="Active Users" stroke="#e35e3d" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-6">
            <MetricCard title="Sessions" value={parseInt(sessions).toLocaleString()} icon={Share2} delay={0.5} />
            <MetricCard title="Page Views/User" value={pageViewsPerUser} icon={FileText} delay={0.6} />
            <MetricCard title="Engagement Time" value={formatDuration(totalEngagementTime)} icon={Clock} delay={0.7} />
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
          <h3 className="text-lg font-bold text-gray-900">Traffic Sources</h3>
          <p className="text-sm text-gray-500">Where your visitors are coming from</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/50 text-gray-500">
                <th className="p-6 font-semibold uppercase tracking-wider text-[10px]">Source / Medium</th>
                <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">Active Users</th>
                <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">Sessions</th>
                <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">Engagement Rate</th>
                <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">Conversions</th>
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
            <h3 className="text-lg font-bold text-gray-900">Top Content</h3>
            <p className="text-sm text-gray-500">Most visited pages on your website</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50/50 text-gray-500">
                  <th className="p-6 font-semibold uppercase tracking-wider text-[10px]">Page Path</th>
                  <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">Views</th>
                  <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">Users</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pagesRows.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-100 transition-colors">
                    <td className="p-6 font-medium text-gray-900 truncate max-w-md" title={row.dimensionValues[0].value}>{row.dimensionValues[0].value}</td>
                    <td className="p-6 text-right text-gray-500 font-mono">{parseInt(row.metricValues[0].value).toLocaleString()}</td>
                    <td className="p-6 text-right text-gray-500 font-mono">{parseInt(row.metricValues[1].value).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-200 shadow-none overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">Landing Pages</h3>
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
          <h3 className="text-lg font-bold text-gray-900">Website Events</h3>
          <p className="text-sm text-gray-500">Tracked user interactions</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/50 text-gray-500">
                <th className="p-6 font-semibold uppercase tracking-wider text-[10px]">Event Name</th>
                <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">Event Count</th>
                <th className="p-6 font-semibold uppercase tracking-wider text-[10px] text-right">Total Users</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((row: any, i: number) => (
                <tr key={i} className="hover:bg-gray-100 transition-colors">
                  <td className="p-6 font-medium text-gray-900">{row.dimensionValues[0].value}</td>
                  <td className="p-6 text-right text-gray-500 font-mono">{parseInt(row.metricValues[0].value).toLocaleString()}</td>
                  <td className="p-6 text-right text-gray-500 font-mono">{parseInt(row.metricValues[1].value).toLocaleString()}</td>
                </tr>
              ))}
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
          <MetricCard title="Total Clicks" value={gscChartData.reduce((sum: number, item: any) => sum + item.clicks, 0).toLocaleString()} icon={MousePointerClick} />
          <MetricCard title="Total Impressions" value={gscChartData.reduce((sum: number, item: any) => sum + item.impressions, 0).toLocaleString()} icon={Eye} />
          <MetricCard title="Avg. Position" value={(gscChartData.reduce((sum: number, item: any) => sum + parseFloat(item.position), 0) / (gscChartData.length || 1)).toFixed(1)} icon={TrendingUp} />
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
                <Bar yAxisId="left" dataKey="clicks" name="Clicks" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="impressions" name="Impressions" stroke="#c084fc" strokeWidth={3} dot={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
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
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                psiStrategy === 'mobile' ? 'bg-white text-gray-900 shadow-none' : 'text-gray-500 hover:text-gray-600'
              }`}
            >
              Mobile
            </button>
            <button
              onClick={() => setPsiStrategy('desktop')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                psiStrategy === 'desktop' ? 'bg-white text-gray-900 shadow-none' : 'text-gray-500 hover:text-gray-600'
              }`}
            >
              Desktop
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <ScoreCircle label="Performance" score={psiData.lighthouseResult?.categories?.performance?.score} />
          <ScoreCircle label="Accessibility" score={psiData.lighthouseResult?.categories?.accessibility?.score} />
          <ScoreCircle label="Best Practices" score={psiData.lighthouseResult?.categories?.['best-practices']?.score} />
          <ScoreCircle label="SEO" score={psiData.lighthouseResult?.categories?.seo?.score} />
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

  const renderWebsiteStatistics = () => {
    if (!client?.hasBQ) return <NoDataConfigured source="BigQuery" />;
    if (bqLoading) return <LoadingState />;
    if (bqError) return <ErrorState message={bqError} />;

    return (
      <div className="bg-white rounded-3xl border border-gray-200 shadow-none overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Custom Statistics</h3>
          <p className="text-sm text-gray-500">Advanced data from BigQuery</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/50 text-gray-500">
                {bqData.schema?.fields?.map((field: any, i: number) => (
                  <th key={i} className="p-6 font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap">{field.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {bqData.rows?.map((row: any, i: number) => (
                <tr key={i} className="hover:bg-gray-100 transition-colors">
                  {row.f.map((cell: any, j: number) => (
                    <td key={j} className="p-6 text-gray-600 whitespace-nowrap font-mono">{cell.v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderWebsiteUpdates = () => {
    if (!client?.hasBQ) return <NoDataConfigured source="BigQuery" />;
    if (bqLoading) return <LoadingState />;
    if (bqError) return <ErrorState message={bqError} />;

    return (
      <div className="bg-white rounded-3xl border border-gray-200 shadow-none overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Website Updates</h3>
          <p className="text-sm text-gray-500">History of changes tracked in BigQuery</p>
        </div>
        <div className="p-20 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <RefreshCw className="w-10 h-10 text-gray-900" />
          </div>
          <h4 className="text-lg font-semibold text-gray-900 mb-2">Tracking Coming Soon</h4>
          <p className="text-gray-500 max-w-xs mx-auto">We're currently setting up the automated change tracking for your website.</p>
        </div>
      </div>
    );
  };

  const ScoreCircle = ({ label, score }: any) => {
    const value = Math.round((score || 0) * 100);
    const color = value >= 90 ? 'text-gray-900' : value >= 50 ? 'text-amber-500' : 'text-red-500';
    const strokeColor = value >= 90 ? '#e35e3d' : value >= 50 ? '#f59e0b' : '#ef4444';
    
    return (
      <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-none flex flex-col items-center text-center group hover:shadow-none transition-all">
        <div className="relative w-24 h-24 mb-6">
          <svg className="w-full h-full" viewBox="0 0 36 36">
            <path
              className="text-gray-100 stroke-current"
              strokeWidth="3"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <motion.path
              initial={{ strokeDasharray: "0, 100" }}
              animate={{ strokeDasharray: `${value}, 100` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="stroke-current"
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
        <h3 className="text-sm font-bold text-gray-900">{label}</h3>
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
          green:  '#15803d', // contrast 4.64:1 ✓
          yellow: '#b45309', // contrast 4.73:1 ✓
          red:    '#b91c1c', // contrast 6.14:1 ✓
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
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all group ${
                      activePage === page.id
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
              <div className="flex items-center gap-3 text-gray-400 text-[11px] font-bold uppercase tracking-widest mb-4">
                <span className="hover:text-gray-500 cursor-pointer transition-colors">Client Portal</span>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="text-gray-900">{pages.find(p => p.id === activePage)?.name}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                  <h2 className="text-4xl font-black text-gray-900 tracking-tight mb-2">
                    {pages.find(p => p.id === activePage)?.name}
                  </h2>
                  <p className="text-gray-500 font-medium max-w-lg">
                    Comprehensive performance analysis and data visualization powered by {pages.find(p => p.id === activePage)?.source}.
                  </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl border border-gray-200 shadow-none self-start sm:self-auto">
                  <Activity className="w-4 h-4 text-gray-900" />
                  <span className="text-xs font-bold text-gray-500">Updated {format(new Date(), 'HH:mm')}</span>
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
          </div>
        </main>
      </div>
    </div>
  );

  function renderPageContent() {
    switch (activePage) {
      case 0: return renderAiOverview();
      case 1: return renderAnalyticsOverview();
      case 2: return renderTrafficSources();
      case 3: return renderPagesAndLanding();
      case 4: return renderWebsiteEvents();
      case 5: return renderSearchPerformance();
      case 6: return renderPageSpeed();
      case 7: return renderUptimeMonitor();
      case 8: return renderWebsiteStatistics();
      case 9: return renderWebsiteUpdates();
      default: return renderAiOverview();
    }
  }

  function renderUptimeMonitor() {
    if (!client?.hasUptime) return <NoDataConfigured source="Uptime Kuma" />;
    if (uptimeLoading) return <LoadingState />;
    if (uptimeError) return <ErrorState message={uptimeError} />;
    if (!uptimeData) return <div className="p-12 text-center text-gray-400">No uptime data available</div>;

    const { title, monitors } = uptimeData as { title: string; monitors: any[] };

    // Status helpers
    const statusLabel  = (s: number | null) =>
      s === 1 ? 'UP' : s === 0 ? 'DOWN' : s === 2 ? 'PENDING' : s === 3 ? 'MAINTENANCE' : 'UNKNOWN';
    const statusColour = (s: number | null) =>
      s === 1 ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
      : s === 0 ? 'text-red-600 bg-red-50 border-red-200'
      : s === 2 ? 'text-amber-600 bg-amber-50 border-amber-200'
      : 'text-blue-600 bg-blue-50 border-blue-200';
    const dotColour    = (s: number | null) =>
      s === 1 ? 'bg-emerald-500' : s === 0 ? 'bg-red-500' : s === 2 ? 'bg-amber-400' : 'bg-blue-400';
    const beatColour   = (s: number) =>
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
                  { label: 'Uptime (24 h)',  value: monitor.uptime24h  != null ? `${monitor.uptime24h}%`  : '—', Icon: Activity },
                  { label: 'Uptime (30 d)',  value: monitor.uptime30d  != null ? `${monitor.uptime30d}%`  : '—', Icon: TrendingUp },
                  { label: 'Avg Response',   value: monitor.avgPing    != null ? `${monitor.avgPing} ms`  : '—', Icon: Timer },
                  { label: 'Checks Shown',   value: monitor.heartbeats.length > 0 ? `${monitor.heartbeats.length}` : '—', Icon: Clock },
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
                          <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
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
