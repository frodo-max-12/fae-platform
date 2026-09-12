"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  History, Search, Mail, Clock, CheckCircle2, FileText, Timer,
  TrendingUp, Send, Package, ArrowRight, RefreshCw,
  Calendar, Building2, User, Eye, ChevronDown, ChevronUp,
  Sparkles, GitCompareArrows, Filter, CalendarDays
} from "lucide-react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";

interface RequestRow {
  id: string;
  userId: string | null;
  customerId: string | null;
  rawEmail: string | null;
  extractedSpecs: string | null;
  comparison: string | null;
  emailDraft: string | null;
  status: string;
  sentAt: string | null;
  totalTime: number | null;
  createdAt: string;
  updatedAt: string;
  customerName: string | null;
  customerCompany: string | null;
}

interface Stats {
  total: number;
  sent: number;
  today: number;
  avgTime: number;
}

// Progress steps for each inquiry
const progressSteps = [
  { key: "intake", label: "Email Loaded", icon: Mail, color: "blue" },
  { key: "extracted", label: "Requirements Analysed", icon: Sparkles, color: "indigo" },
  { key: "compared", label: "Comparison Done", icon: GitCompareArrows, color: "purple" },
  { key: "draft", label: "Email Drafted", icon: FileText, color: "amber" },
  { key: "sent", label: "Email Sent", icon: Send, color: "emerald" },
];

const statusOrder: Record<string, number> = {
  intake: 0, extracted: 1, compared: 2, draft: 3, sent: 4,
};

const statusConfig: Record<string, { label: string; bg: string; text: string; icon: typeof CheckCircle2 }> = {
  sent: { label: "Sent", bg: "bg-emerald-100", text: "text-emerald-700", icon: CheckCircle2 },
  draft: { label: "Draft Ready", bg: "bg-amber-100", text: "text-amber-700", icon: FileText },
  compared: { label: "Compared", bg: "bg-purple-100", text: "text-purple-700", icon: GitCompareArrows },
  extracted: { label: "Analysed", bg: "bg-indigo-100", text: "text-indigo-700", icon: Eye },
  intake: { label: "In Progress", bg: "bg-blue-100", text: "text-blue-700", icon: Timer },
};

type DateFilter = "all" | "today" | "yesterday" | "week" | "custom";

// Mock data for when DB is empty
const mockRequests: RequestRow[] = [
  {
    id: "mock-1", userId: null, customerId: null,
    rawEmail: "Dear Sales Team,\n\nWe are installing a new automated packaging line at our local facility and need proximity sensors urgently.\n\nRequirement:\n- Type: Inductive proximity sensor\n- Sensing: min 10mm\n- IP67+\n- PNP NO\n- Qty: 500\n- Budget: Rs.850/unit\n\nCurrently using SICK IM08-08BPS-ZC1.",
    extractedSpecs: JSON.stringify({ type: "Inductive Proximity Sensor", referenceProduct: "SICK IM08-08BPS-ZC1", quantity: "500", targetPrice: "Rs.850", sensingDistance: "10mm", ipRating: "IP67", outputType: "PNP NO" }),
    comparison: JSON.stringify({ overallScore: 87, totalSaving: 35000, rows: [
      { spec: "Sensing Distance", customerNeed: "Min 10mm", ourValue: "8mm", verdict: "CLOSE" },
      { spec: "IP Rating", customerNeed: "IP67+", ourValue: "IP67", verdict: "MEETS" },
      { spec: "Output", customerNeed: "PNP NO", ourValue: "PNP NO", verdict: "MEETS" },
      { spec: "Price", customerNeed: "< Rs.850", ourValue: "Rs.780", verdict: "EXCEEDS" },
    ] }),
    emailDraft: JSON.stringify({ subject: "Technical Comparison — Autonics PR18-8DP vs SICK IM08-08BPS-ZC1" }),
    status: "sent", sentAt: new Date().toISOString(), totalTime: 142,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    customerName: "Priya Sharma", customerCompany: "Automation Corp India",
  },
  {
    id: "mock-2", userId: null, customerId: null,
    rawEmail: "We need photoelectric sensors for our conveyor detection system.\n\n- Diffuse reflective\n- Range: 100-500mm\n- IP65 min\n- Qty: 200\n- Budget: Rs.1200/unit\n\nCurrently using Omron E3Z-D62.",
    extractedSpecs: JSON.stringify({ type: "Photoelectric Sensor", referenceProduct: "Omron E3Z-D62", quantity: "200", targetPrice: "Rs.1200" }),
    comparison: JSON.stringify({ overallScore: 91, totalSaving: 18000 }),
    emailDraft: JSON.stringify({ subject: "Proposal — Autonics BEN5M vs Omron E3Z-D62" }),
    status: "draft", sentAt: null, totalTime: 185,
    createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString(),
    customerName: "Amit Patel", customerCompany: "Precision Manufacturing",
  },
  {
    id: "mock-3", userId: null, customerId: null,
    rawEmail: "We need K-type thermocouples for furnace monitoring.\n- Temp: 0-1200C\n- Probe: 300mm\n- IP68\n- Qty: 50\n\nReference: Honeywell C7080.",
    extractedSpecs: JSON.stringify({ type: "K-Type Thermocouple", referenceProduct: "Honeywell C7080", quantity: "50" }),
    comparison: null, emailDraft: null,
    status: "extracted", sentAt: null, totalTime: null,
    createdAt: new Date(Date.now() - 172800000).toISOString(), updatedAt: new Date(Date.now() - 172800000).toISOString(),
    customerName: "Deepak Verma", customerCompany: "SteelWorks India",
  },
  {
    id: "mock-4", userId: null, customerId: null,
    rawEmail: "Capacitive sensor requirement for liquid level detection.\n- 300 units\n- Budget: Rs.950/unit\n\nReference: IFM KI5087.",
    extractedSpecs: JSON.stringify({ type: "Capacitive Proximity Sensor", referenceProduct: "IFM KI5087", quantity: "300", targetPrice: "Rs.950" }),
    comparison: JSON.stringify({ overallScore: 94, totalSaving: 22500 }),
    emailDraft: JSON.stringify({ subject: "Technical Comparison — Autonics CR18 vs IFM KI5087" }),
    status: "sent", sentAt: new Date(Date.now() - 345600000).toISOString(), totalTime: 128,
    createdAt: new Date(Date.now() - 345600000).toISOString(), updatedAt: new Date(Date.now() - 345600000).toISOString(),
    customerName: "Neha Gupta", customerCompany: "PharmaPack Solutions",
  },
  {
    id: "mock-5", userId: null, customerId: null,
    rawEmail: "Fiber optic sensor — 100 units for precision detection.\n\nReference: Keyence FU-35FA.",
    extractedSpecs: null, comparison: null, emailDraft: null,
    status: "intake", sentAt: null, totalTime: null,
    createdAt: new Date(Date.now() - 86400000 * 6).toISOString(), updatedAt: new Date(Date.now() - 86400000 * 6).toISOString(),
    customerName: "Rajesh Kumar", customerCompany: "AutoLine Systems",
  },
];

const mockStats: Stats = { total: 48, sent: 32, today: 5, avgTime: 155 };

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  if (diff < 172800000) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function isYesterday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  return d.toDateString() === y.toDateString();
}

function isThisWeek(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  return d >= weekAgo;
}

export default function HistoryPage() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [stats, setStats] = useState<Stats>(mockStats);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/requests");
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.requests.length > 0) {
        setRequests(data.requests);
        setStats(data.stats);
      } else {
        setRequests(mockRequests);
        setStats(mockStats);
      }
    } catch {
      setRequests(mockRequests);
      setStats(mockStats);
    }
    setLoading(false);
  };

  const filtered = requests.filter((r) => {
    const matchSearch = !search ||
      r.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      r.customerCompany?.toLowerCase().includes(search.toLowerCase()) ||
      r.rawEmail?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || r.status === filterStatus;

    let matchDate = true;
    if (dateFilter === "today") matchDate = isToday(r.createdAt);
    else if (dateFilter === "yesterday") matchDate = isYesterday(r.createdAt);
    else if (dateFilter === "week") matchDate = isThisWeek(r.createdAt);
    else if (dateFilter === "custom" && customFrom) {
      const d = new Date(r.createdAt);
      matchDate = d >= new Date(customFrom) && (!customTo || d <= new Date(customTo + "T23:59:59"));
    }

    return matchSearch && matchStatus && matchDate;
  });

  const getSpecs = (r: RequestRow) => {
    try { return r.extractedSpecs ? JSON.parse(r.extractedSpecs) : null; } catch { return null; }
  };
  const getComparison = (r: RequestRow) => {
    try { return r.comparison ? JSON.parse(r.comparison) : null; } catch { return null; }
  };
  const getDraft = (r: RequestRow) => {
    try { return r.emailDraft ? JSON.parse(r.emailDraft) : null; } catch { return null; }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-slate-50">
        <div className="px-8 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <History className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-800">Past Inquiries</h1>
                <p className="text-sm text-slate-400">Your complete inquiry history with progress tracking</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
              <Link href="/wizard" className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/25">
                <Mail className="w-4 h-4" /> New Inquiry
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Inquiries", value: stats.total.toString(), icon: Mail, color: "from-blue-500 to-blue-600", sub: "all time" },
              { label: "Emails Sent", value: stats.sent.toString(), icon: Send, color: "from-emerald-500 to-emerald-600", sub: `${stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0}% conversion` },
              { label: "Today", value: stats.today.toString(), icon: Calendar, color: "from-purple-500 to-purple-600", sub: "inquiries handled" },
              { label: "Avg Response", value: stats.avgTime ? formatTime(stats.avgTime) : "—", icon: Clock, color: "from-amber-500 to-amber-600", sub: "vs 45min manual" },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
                className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center`}>
                    <s.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[11px] text-slate-400 font-semibold">{s.sub}</span>
                </div>
                <p className="text-2xl font-extrabold text-slate-800">{s.value}</p>
                <p className="text-xs text-slate-400 font-medium mt-0.5">{s.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Search + Status Filter + Date Filter */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by customer, company, or product..."
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none" />
              </div>
              <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
                {[
                  { key: "all", label: "All" },
                  { key: "sent", label: "Sent" },
                  { key: "draft", label: "Draft" },
                  { key: "extracted", label: "Analysed" },
                  { key: "intake", label: "In Progress" },
                ].map((f) => (
                  <button key={f.key} onClick={() => setFilterStatus(f.key)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${filterStatus === f.key ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-slate-400" />
              <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
                {[
                  { key: "all" as DateFilter, label: "All Time" },
                  { key: "today" as DateFilter, label: "Today" },
                  { key: "yesterday" as DateFilter, label: "Yesterday" },
                  { key: "week" as DateFilter, label: "This Week" },
                  { key: "custom" as DateFilter, label: "Custom" },
                ].map((f) => (
                  <button key={f.key} onClick={() => setDateFilter(f.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${dateFilter === f.key ? "bg-purple-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
                    {f.label}
                  </button>
                ))}
              </div>
              <AnimatePresence>
                {dateFilter === "custom" && (
                  <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} className="flex items-center gap-2 overflow-hidden">
                    <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 outline-none focus:border-purple-400" />
                    <span className="text-xs text-slate-400">to</span>
                    <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 outline-none focus:border-purple-400" />
                  </motion.div>
                )}
              </AnimatePresence>
              <span className="text-xs text-slate-400 ml-auto">{filtered.length} results</span>
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-3" />
              <span className="text-sm text-slate-500">Loading inquiries...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <History className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-700 mb-2">No inquiries found</h3>
              <p className="text-sm text-slate-400 mb-6">{search ? "Try a different search term" : "Start by handling your first customer inquiry"}</p>
              <Link href="/wizard" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700">
                <Mail className="w-4 h-4" /> Handle New Inquiry
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((req, i) => {
                const st = statusConfig[req.status] || statusConfig.intake;
                const StatusIcon = st.icon;
                const specs = getSpecs(req);
                const comp = getComparison(req);
                const draft = getDraft(req);
                const isExpanded = expandedId === req.id;
                const currentStepIdx = statusOrder[req.status] ?? 0;

                return (
                  <motion.div key={req.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * i }}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md transition-all">

                    {/* Main Row */}
                    <div className="flex items-center gap-4 p-5 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : req.id)}>
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {req.customerName ? req.customerName.split(" ").map((n) => n[0]).join("") : "?"}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-bold text-slate-800 truncate">{req.customerName || "Unknown Customer"}</p>
                          {req.customerCompany && <span className="text-xs text-slate-400 shrink-0">— {req.customerCompany}</span>}
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          {specs?.type ? `${specs.type} — ` : ""}{specs?.referenceProduct || req.rawEmail?.substring(0, 60) || "No details"}
                        </p>
                      </div>

                      {comp?.overallScore && (
                        <div className="text-center shrink-0 hidden sm:block">
                          <p className="text-lg font-extrabold text-blue-600">{comp.overallScore}%</p>
                          <p className="text-[10px] text-slate-400">match</p>
                        </div>
                      )}

                      {comp?.totalSaving > 0 && (
                        <div className="text-right shrink-0 hidden md:block">
                          <p className="text-sm font-bold text-emerald-600">Rs.{comp.totalSaving.toLocaleString()}</p>
                          <p className="text-[10px] text-slate-400">saved</p>
                        </div>
                      )}

                      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${st.bg} shrink-0`}>
                        <StatusIcon className={`w-3.5 h-3.5 ${st.text}`} />
                        <span className={`text-[11px] font-bold ${st.text}`}>{st.label}</span>
                      </div>

                      <div className="text-right shrink-0 w-20">
                        <p className="text-xs text-slate-400">{formatDate(req.createdAt)}</p>
                        {req.totalTime && <p className="text-[10px] text-slate-300">{formatTime(req.totalTime)}</p>}
                      </div>

                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="border-t border-slate-100 overflow-hidden">
                          <div className="p-5 space-y-5">

                            {/* Progress Stepper */}
                            <div>
                              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Progress</h4>
                              <div className="flex items-center gap-1">
                                {progressSteps.map((step, idx) => {
                                  const done = idx <= currentStepIdx;
                                  const isCurrent = idx === currentStepIdx;
                                  const StepIcon = step.icon;
                                  return (
                                    <div key={step.key} className="flex items-center flex-1">
                                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg flex-1 ${
                                        done
                                          ? isCurrent ? "bg-blue-50 border-2 border-blue-300" : "bg-emerald-50 border border-emerald-200"
                                          : "bg-slate-50 border border-slate-200"
                                      }`}>
                                        <StepIcon className={`w-3.5 h-3.5 ${done ? isCurrent ? "text-blue-600" : "text-emerald-600" : "text-slate-300"}`} />
                                        <span className={`text-[10px] font-bold ${done ? isCurrent ? "text-blue-700" : "text-emerald-700" : "text-slate-400"}`}>
                                          {step.label}
                                        </span>
                                        {done && !isCurrent && <CheckCircle2 className="w-3 h-3 text-emerald-500 ml-auto" />}
                                      </div>
                                      {idx < progressSteps.length - 1 && (
                                        <div className={`w-3 h-0.5 shrink-0 ${idx < currentStepIdx ? "bg-emerald-300" : "bg-slate-200"}`} />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Detail Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-slate-50 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <User className="w-4 h-4 text-blue-500" />
                                  <h4 className="text-xs font-bold text-slate-700 uppercase">Customer</h4>
                                </div>
                                <p className="text-sm font-semibold text-slate-800">{req.customerName || "—"}</p>
                                <p className="text-xs text-slate-500">{req.customerCompany || "—"}</p>
                                <p className="text-[10px] text-slate-400 mt-1">{new Date(req.createdAt).toLocaleString("en-IN")}</p>
                              </div>

                              <div className="bg-slate-50 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <Package className="w-4 h-4 text-purple-500" />
                                  <h4 className="text-xs font-bold text-slate-700 uppercase">Requirement</h4>
                                </div>
                                {specs ? (
                                  <div className="space-y-1">
                                    <p className="text-xs text-slate-600"><span className="font-semibold">Type:</span> {specs.type}</p>
                                    <p className="text-xs text-slate-600"><span className="font-semibold">Reference:</span> {specs.referenceProduct || specs.referenceMPN || "—"}</p>
                                    {specs.quantity && <p className="text-xs text-slate-600"><span className="font-semibold">Qty:</span> {specs.quantity}</p>}
                                    {specs.targetPrice && <p className="text-xs text-slate-600"><span className="font-semibold">Budget:</span> {specs.targetPrice}</p>}
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400 italic">Not yet analysed</p>
                                )}
                              </div>

                              <div className="bg-slate-50 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                                  <h4 className="text-xs font-bold text-slate-700 uppercase">Result</h4>
                                </div>
                                {comp ? (
                                  <div className="space-y-1">
                                    <p className="text-xs text-slate-600"><span className="font-semibold">Match:</span> <span className="text-blue-600 font-bold">{comp.overallScore}%</span></p>
                                    <p className="text-xs text-slate-600"><span className="font-semibold">Saving:</span> <span className="text-emerald-600 font-bold">Rs.{comp.totalSaving?.toLocaleString() || 0}</span></p>
                                    {req.totalTime && <p className="text-xs text-slate-600"><span className="font-semibold">Time:</span> {formatTime(req.totalTime)}</p>}
                                    {req.sentAt && <p className="text-xs text-slate-600"><span className="font-semibold">Sent:</span> {new Date(req.sentAt).toLocaleString("en-IN")}</p>}
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400 italic">Comparison pending</p>
                                )}
                              </div>
                            </div>

                            {/* Email preview */}
                            {req.rawEmail && (
                              <div className="bg-slate-900 rounded-xl p-4">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Customer Email</h4>
                                <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto">{req.rawEmail}</pre>
                              </div>
                            )}

                            {/* Comparison summary if available */}
                            {comp?.rows && (
                              <div>
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Comparison Summary</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  {comp.rows.map((row: { spec: string; verdict: string; ourValue: string }, ri: number) => (
                                    <div key={ri} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
                                      ["MEETS", "EXCEEDS", "COMPATIBLE"].includes(row.verdict)
                                        ? "bg-emerald-50 text-emerald-700"
                                        : row.verdict === "GAP" ? "bg-red-50 text-red-600"
                                        : "bg-amber-50 text-amber-700"
                                    }`}>
                                      {["MEETS", "EXCEEDS", "COMPATIBLE"].includes(row.verdict)
                                        ? <CheckCircle2 className="w-3 h-3" />
                                        : <Timer className="w-3 h-3" />}
                                      <span>{row.spec}: {row.verdict}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Draft subject */}
                            {draft?.subject && (
                              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-1">
                                  <Mail className="w-3.5 h-3.5 text-blue-500" />
                                  <span className="text-[10px] font-bold text-blue-500 uppercase">Email Draft</span>
                                </div>
                                <p className="text-sm font-semibold text-slate-800">{draft.subject}</p>
                              </div>
                            )}

                            {/* Resume button for non-sent */}
                            {req.status !== "sent" && (
                              <Link href={`/wizard?id=${req.id}`} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/25">
                                <ArrowRight className="w-4 h-4" /> Continue This Inquiry
                              </Link>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
