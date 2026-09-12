"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, PenLine, Inbox, Clock, ChevronRight, Sparkles, Loader2,
  LogIn, User, CheckCircle2, ArrowRight, CalendarDays, Eye,
  MessageSquare, ChevronDown, ChevronUp, Layers,
  MailOpen, Check, Hash, Tag, Table2, List
} from "lucide-react";
import { useWizard } from "@/lib/store";
import { SAMPLE_EMAILS } from "@/lib/constants";
import type { Email } from "@/types";
import toast from "react-hot-toast";
import { persistProgress } from "@/lib/persistProgress";

type DateRange = "all" | "today" | "yesterday" | "custom";

interface ThreadMessage {
  index: number;
  from: string;
  date: string;
  subject: string;
  body: string;
  preview: string;
  isLatest: boolean;
  topic: string;        // auto-detected topic (e.g. "Line 2 — photoelectric sensor specs in table")
  hasTable: boolean;     // whether this message contains a table
  hasBullets: boolean;   // whether this message has bullet-point specs
  mpnCount: number;      // how many MPNs detected
}

function getGmailUser(): { email: string; name: string; picture: string } | null {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie.split("; ").find((c) => c.startsWith("gmail_user="));
  if (!cookie) return null;
  try {
    return JSON.parse(decodeURIComponent(cookie.split("=").slice(1).join("=")));
  } catch {
    return null;
  }
}

function isToday(dateStr: string) {
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

function isYesterday(dateStr: string) {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return new Date(dateStr).toDateString() === y.toDateString();
}

function inRange(dateStr: string, from: string, to: string) {
  const d = new Date(dateStr);
  return d >= new Date(from) && (!to || d <= new Date(to + "T23:59:59"));
}

// ── Detect what a message is about ──
function detectTopic(text: string): string {
  const lower = text.toLowerCase();

  // Look for explicit "Line X", "Requirement X", "Item X" labels
  const lineMatch = lower.match(/\b(line\s*\d+|item\s*\d+|requirement\s*\d+|type\s*[a-z]|option\s*\d+)/i);

  // Look for sensor types
  const sensorTypes: string[] = [];
  if (/\binductive\b/i.test(text)) sensorTypes.push("Inductive");
  if (/\bphotoelectric\b/i.test(text)) sensorTypes.push("Photoelectric");
  if (/\bcapacitive\b/i.test(text)) sensorTypes.push("Capacitive");
  if (/\bultrasonic\b/i.test(text)) sensorTypes.push("Ultrasonic");
  if (/\btemperature\b/i.test(text)) sensorTypes.push("Temperature");
  if (/\bthermocouple\b/i.test(text)) sensorTypes.push("Thermocouple");
  if (/\bpressure\b/i.test(text)) sensorTypes.push("Pressure");
  if (/\bfiber\s*optic\b/i.test(text)) sensorTypes.push("Fiber Optic");
  if (/\blaser\b/i.test(text)) sensorTypes.push("Laser");
  if (/\bproximity\b/i.test(text)) sensorTypes.push("Proximity");
  if (/\blevel\b/i.test(text)) sensorTypes.push("Level");
  if (/\bflow\b/i.test(text)) sensorTypes.push("Flow");

  // Look for MPNs (alphanumeric codes with dashes)
  const mpnMatches = text.match(/\b[A-Z][A-Z0-9]{1,4}[-]?[A-Z0-9]{2,}[-]?[A-Z0-9]*/g) || [];
  const mpns = mpnMatches.filter(m => m.length >= 5 && /\d/.test(m) && /[A-Z]/.test(m));

  // Build topic string
  const parts: string[] = [];
  if (lineMatch) parts.push(lineMatch[1].replace(/\s+/g, " "));
  if (sensorTypes.length > 0) parts.push(sensorTypes.join(", ") + " sensor");
  if (mpns.length > 0) parts.push(mpns.slice(0, 2).join(", "));

  if (parts.length === 0) {
    // Fallback: first meaningful line
    const lines = text.split("\n").filter(l => l.trim().length > 10 && !l.startsWith("From:") && !l.startsWith("Date:") && !l.startsWith("On "));
    if (lines.length > 0) return lines[0].trim().slice(0, 80);
    return "General requirements";
  }

  return parts.join(" — ");
}

function detectHasTable(text: string): boolean {
  // Pipe table: | ... | ... |
  if (/\|.+\|.+\|/m.test(text)) return true;
  // Markdown separator: | --- |
  if (/\|\s*-{2,}\s*\|/.test(text)) return true;
  // Tab-separated with 2+ tabs per line
  if (/\t.+\t/m.test(text)) return true;
  return false;
}

function detectHasBullets(text: string): boolean {
  const bulletLines = text.match(/^[\s]*[-*•]\s+.+$/gm);
  return (bulletLines?.length || 0) >= 2;
}

function countMPNs(text: string): number {
  const matches = text.match(/\b[A-Z][A-Z0-9]{1,4}[-]?[A-Z0-9]{2,}[-]?[A-Z0-9]*/g) || [];
  return matches.filter(m => m.length >= 5 && /\d/.test(m) && /[A-Z]/.test(m)).length;
}

/**
 * Robust email thread parser.
 * Splits a single email body into separate sub-messages.
 */
function parseEmailThread(body: string): ThreadMessage[] {
  const raw = body.trim();
  if (!raw) return [];

  // Patterns that indicate a new message boundary
  const boundaryPatterns = [
    /\n\s*On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|January|February|March|April|May|June|July|August|September|October|November|December|\d).{8,80}\s+wrote:\s*\n/gi,
    /\n\s*-{2,}\s*(?:Original Message|Forwarded message|Forwarded Message|Quoted Message)\s*-{2,}\s*\n/gi,
    /\n\s*From:\s+.{5,80}\n\s*(?:Sent|Date|To):/gi,
    /\n[_]{5,}\n/g,
    /\n[-]{5,}\n/g,
    /\nSent from my .{3,30}\n/gi,
    /\n>{1,}\s*On\s+.{8,80}\s+wrote:/gi,
    /\nBegin forwarded message:\s*\n/gi,
  ];

  const splitPoints: { pos: number; headerEnd: number }[] = [];

  for (const pattern of boundaryPatterns) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(raw)) !== null) {
      const pos = m.index + 1;
      if (pos > 10) {
        splitPoints.push({ pos, headerEnd: m.index + m[0].length });
      }
    }
  }

  splitPoints.sort((a, b) => a.pos - b.pos);
  const deduped: { pos: number; headerEnd: number }[] = [];
  for (const sp of splitPoints) {
    if (deduped.length === 0 || sp.pos - deduped[deduped.length - 1].pos > 20) {
      deduped.push(sp);
    }
  }

  // If no splits found, single message
  if (deduped.length === 0) {
    const topic = detectTopic(raw);
    return [{
      index: 0, from: "", date: "", subject: "",
      body: raw, preview: raw.slice(0, 150).replace(/\n/g, " "),
      isLatest: true, topic,
      hasTable: detectHasTable(raw),
      hasBullets: detectHasBullets(raw),
      mpnCount: countMPNs(raw),
    }];
  }

  // Build segments
  const segments: { start: number; end: number; header: string }[] = [];
  segments.push({ start: 0, end: deduped[0].pos, header: "" });
  for (let i = 0; i < deduped.length; i++) {
    const start = deduped[i].pos;
    const end = i + 1 < deduped.length ? deduped[i + 1].pos : raw.length;
    segments.push({ start, end, header: raw.slice(deduped[i].pos, deduped[i].headerEnd) });
  }

  const messages: ThreadMessage[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const text = raw.slice(seg.start, seg.end).trim();
    if (text.length < 5) continue;

    const fromMatch = text.match(/(?:^|\n)\s*From:\s*(.+?)(?:\n|$)/i);
    const dateMatch = text.match(/(?:^|\n)\s*(?:Date|Sent):\s*(.+?)(?:\n|$)/i)
      || seg.header.match(/On\s+(.{10,50})\s+wrote/i);
    const subjectMatch = text.match(/(?:^|\n)\s*Subject:\s*(.+?)(?:\n|$)/i);
    const onWroteMatch = text.match(/On\s+.+?<(.+?)>\s+wrote/i) || text.match(/On\s+.+?(\S+@\S+)\s+wrote/i);

    const bodyText = text
      .replace(/^(From|Date|Sent|To|Cc|Subject|On .*wrote):.*$/gm, "")
      .replace(/^-{3,}\s*(Original Message|Forwarded message|Quoted Message)\s*-{3,}$/gm, "")
      .replace(/^[_-]{5,}$/gm, "")
      .trim();

    const sender = fromMatch?.[1]?.trim()
      || onWroteMatch?.[1]?.trim()
      || (i === 0 ? "Latest Message" : `Message ${i + 1}`);

    const topic = detectTopic(bodyText || text);

    messages.push({
      index: i,
      from: sender,
      date: dateMatch?.[1]?.trim() || "",
      subject: subjectMatch?.[1]?.trim() || "",
      body: text,
      preview: bodyText.slice(0, 150).replace(/\n/g, " ").trim(),
      isLatest: i === 0,
      topic,
      hasTable: detectHasTable(text),
      hasBullets: detectHasBullets(text),
      mpnCount: countMPNs(text),
    });
  }

  return messages.length > 0 ? messages : [{
    index: 0, from: "", date: "", subject: "",
    body: raw, preview: raw.slice(0, 150).replace(/\n/g, " "),
    isLatest: true, topic: detectTopic(raw),
    hasTable: detectHasTable(raw),
    hasBullets: detectHasBullets(raw),
    mpnCount: countMPNs(raw),
  }];
}

export default function Step1Intake() {
  const { state, dispatch } = useWizard();
  const [tab, setTab] = useState<"gmail" | "manual">("gmail");
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState<Email[]>([]);
  const [gmailUser, setGmailUser] = useState<{ email: string; name: string } | null>(null);
  const [usingSamples, setUsingSamples] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [selectedThreadParts, setSelectedThreadParts] = useState<Set<number>>(new Set());
  const [showRawEmail, setShowRawEmail] = useState(false);

  useEffect(() => {
    const user = getGmailUser();
    if (user) setGmailUser(user);
  }, []);

  const handleGmailSignIn = () => { window.location.href = "/api/auth/google"; };

  const buildGmailQuery = (): { q: string; maxResults: number; fetchAll: boolean } => {
    const toGmailDate = (s: string) => s.replaceAll("-", "/"); // YYYY-MM-DD → YYYY/MM/DD
    const parts: string[] = ["in:inbox"];
    if (dateRange === "today") {
      const t = new Date();
      const y = t.toISOString().slice(0, 10).replaceAll("-", "/");
      parts.push(`after:${y}`);
    } else if (dateRange === "yesterday") {
      const y = new Date(); y.setDate(y.getDate() - 1);
      const t = new Date();
      parts.push(`after:${y.toISOString().slice(0, 10).replaceAll("-", "/")}`);
      parts.push(`before:${t.toISOString().slice(0, 10).replaceAll("-", "/")}`);
    } else if (dateRange === "custom") {
      if (customFrom) parts.push(`after:${toGmailDate(customFrom)}`);
      if (customTo) {
        // Gmail `before:` is exclusive — bump by 1 day so the to-date is inclusive
        const d = new Date(customTo); d.setDate(d.getDate() + 1);
        parts.push(`before:${d.toISOString().slice(0, 10).replaceAll("-", "/")}`);
      }
    }
    return {
      q: parts.join(" "),
      maxResults: dateRange === "all" ? 15 : 500,
      fetchAll: dateRange !== "all", // paginate through every match in the date range
    };
  };

  const handleLoadGmail = async () => {
    if (dateRange === "custom" && !customFrom) {
      toast.error("Pick a 'From' date for custom range");
      return;
    }
    setLoading(true);
    setUsingSamples(false);
    try {
      const { q, maxResults, fetchAll } = buildGmailQuery();
      const res = await fetch("/api/gmail/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxResults, query: q, fetchAll }),
      });
      if (res.status === 401) { toast.error("Please sign in with Google first"); setLoading(false); return; }
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      if (data.emails && data.emails.length > 0) {
        setEmails(data.emails);
        toast.success(`Loaded ${data.emails.length} emails`);
      } else {
        setEmails(SAMPLE_EMAILS);
        setUsingSamples(true);
        toast("No emails found, showing sample inquiries", { icon: "📧" });
      }
    } catch {
      setEmails(SAMPLE_EMAILS);
      setUsingSamples(true);
      toast("Using sample inquiries for demo", { icon: "📧" });
    }
    setLoading(false);
  };

  const handleSelectEmail = (email: Email) => {
    if (state.selectedEmail?.id !== email.id) {
      dispatch({ type: "RESET" });
    }
    dispatch({ type: "SELECT_EMAIL", email });
    setShowPreview(true);
    setShowRawEmail(false);

    const threads = parseEmailThread(email.body);
    setThreadMessages(threads);

    if (threads.length > 1) {
      setSelectedThreadParts(new Set(threads.map((t) => t.index)));
    } else {
      setSelectedThreadParts(new Set([0]));
    }
  };

  const toggleThreadPart = (idx: number) => {
    setSelectedThreadParts((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const selectAllThreads = () => setSelectedThreadParts(new Set(threadMessages.map((t) => t.index)));
  const selectNone = () => setSelectedThreadParts(new Set());

  const saveIntake = async (rawEmail: string) => {
    const id = await persistProgress({ rawEmail, status: "intake" });
    if (id) dispatch({ type: "SET_REQUEST_ID", requestId: id });
  };

  const handleAnalyse = () => {
    let bodyUsed = state.selectedEmail?.body || "";
    if (threadMessages.length > 1 && selectedThreadParts.size > 0 && selectedThreadParts.size < threadMessages.length) {
      bodyUsed = threadMessages
        .filter((t) => selectedThreadParts.has(t.index))
        .map((t) => t.body)
        .join("\n\n---\n\n");
      dispatch({ type: "SELECT_EMAIL", email: { ...state.selectedEmail!, body: bodyUsed } });
    }
    saveIntake(bodyUsed);
    dispatch({ type: "SET_STEP", step: 2 });
  };

  const handleAnalyseSingle = (msg: ThreadMessage) => {
    dispatch({ type: "SELECT_EMAIL", email: { ...state.selectedEmail!, body: msg.body } });
    saveIntake(msg.body);
    dispatch({ type: "SET_STEP", step: 2 });
  };

  const handleManualNext = () => {
    if (state.manualInput.trim().length > 20) {
      dispatch({ type: "RESET" });
      dispatch({
        type: "SELECT_EMAIL",
        email: {
          id: "manual-" + Date.now(), from: "manual-entry", subject: "Manual Requirement Entry",
          body: state.manualInput, date: new Date().toISOString(), snippet: state.manualInput.slice(0, 100),
        },
      });
      saveIntake(state.manualInput);
      dispatch({ type: "SET_STEP", step: 2 });
    }
  };

  // Server-side Gmail query already applies the date filter; client filter only
  // runs over sample emails (when Gmail returned nothing) so users can still
  // narrow the demo set.
  const filteredEmails = !usingSamples ? emails : emails.filter((email) => {
    if (dateRange === "today") return isToday(email.date);
    if (dateRange === "yesterday") return isYesterday(email.date);
    if (dateRange === "custom" && customFrom) return inRange(email.date, customFrom, customTo);
    return true;
  });

  const hasMultipleThreads = threadMessages.length > 1;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
        <button onClick={() => setTab("gmail")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === "gmail" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          <Mail className="w-4 h-4" /> Load from Gmail
        </button>
        <button onClick={() => setTab("manual")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === "manual" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          <PenLine className="w-4 h-4" /> Paste / Type
        </button>
      </div>

      <AnimatePresence mode="wait">
        {tab === "gmail" ? (
          <motion.div key="gmail" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
            {/* Gmail Connection + Load */}
            <div className="flex items-center gap-3 flex-wrap">
              {gmailUser ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700">{gmailUser.email}</span>
                </div>
              ) : (
                <button onClick={handleGmailSignIn}
                  className="flex items-center gap-2 px-5 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50 transition-all">
                  <LogIn className="w-4 h-4" /> Sign in with Google
                </button>
              )}
              <button onClick={handleLoadGmail} disabled={loading}
                className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold text-sm hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-60">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Inbox className="w-5 h-5" />}
                {loading ? "Loading..." : "Load Inbox"}
              </button>
            </div>

            {/* Date Range Filter */}
            {emails.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap">
                <CalendarDays className="w-4 h-4 text-slate-400" />
                <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
                  {([
                    { key: "all" as DateRange, label: "All Emails" },
                    { key: "today" as DateRange, label: "Today" },
                    { key: "yesterday" as DateRange, label: "Yesterday" },
                    { key: "custom" as DateRange, label: "Custom Date" },
                  ]).map((f) => (
                    <button key={f.key} onClick={() => setDateRange(f.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${dateRange === f.key ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
                      {f.label}
                    </button>
                  ))}
                </div>
                <AnimatePresence>
                  {dateRange === "custom" && (
                    <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }}
                      className="flex items-center gap-2 overflow-hidden">
                      <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 outline-none focus:border-blue-400" />
                      <span className="text-xs text-slate-400">to</span>
                      <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 outline-none focus:border-blue-400" />
                    </motion.div>
                  )}
                </AnimatePresence>
                <span className="text-xs text-slate-400 ml-auto">{filteredEmails.length} emails</span>
              </div>
            )}

            {usingSamples && emails.length > 0 && (
              <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs text-amber-700 font-medium">Showing sample customer inquiries for demo.</p>
              </div>
            )}

            {/* Email List */}
            <div className="space-y-3">
              {filteredEmails.map((email, i) => {
                const isSelected = state.selectedEmail?.id === email.id;
                return (
                  <motion.div key={email.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                    className={`group rounded-xl border-2 transition-all overflow-hidden ${
                      isSelected ? "border-blue-500 bg-blue-50/50 shadow-lg shadow-blue-500/10" : "border-slate-200 bg-white hover:border-blue-300 hover:shadow-md"
                    }`}>

                    {/* Email Row */}
                    <div onClick={() => handleSelectEmail(email)} className="p-5 cursor-pointer">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {email.from.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{email.from}</p>
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <Clock className="w-3 h-3" />
                                {new Date(email.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          </div>
                          <h3 className="text-sm font-bold text-slate-700 mb-1 truncate">{email.subject}</h3>
                          <p className="text-xs text-slate-500 line-clamp-2">{email.snippet}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          {isSelected && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold">Selected</span>}
                          <ChevronRight className={`w-5 h-5 transition-all ${isSelected ? "text-blue-500" : "text-slate-300 group-hover:text-slate-500"}`} />
                        </div>
                      </div>
                    </div>

                    {/* Expanded Section */}
                    <AnimatePresence>
                      {isSelected && showPreview && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="border-t border-blue-200 p-4 space-y-4">

                            {/* ═══ THREAD PICKER — when multiple sub-emails detected ═══ */}
                            {hasMultipleThreads && (
                              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-2xl p-5">
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg">
                                      <Layers className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                      <h4 className="text-sm font-extrabold text-indigo-900">
                                        {threadMessages.length} Conversations Found in This Email
                                      </h4>
                                      <p className="text-xs text-indigo-600">
                                        Each message may have different requirements. Pick which to analyse:
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={selectAllThreads}
                                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-all">
                                      Select All
                                    </button>
                                    <button onClick={selectNone}
                                      className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-[10px] font-bold hover:bg-indigo-50 transition-all">
                                      Clear
                                    </button>
                                  </div>
                                </div>

                                {/* Sub-email cards */}
                                <div className="space-y-2">
                                  {threadMessages.map((msg) => {
                                    const checked = selectedThreadParts.has(msg.index);
                                    return (
                                      <div key={msg.index}
                                        className={`rounded-xl border-2 transition-all overflow-hidden ${
                                          checked ? "border-indigo-400 bg-white shadow-md" : "border-slate-200 bg-white/60 opacity-70"
                                        }`}>
                                        {/* Card header */}
                                        <div onClick={() => toggleThreadPart(msg.index)}
                                          className="flex items-center gap-3 p-4 cursor-pointer hover:bg-indigo-50/50 transition-all">
                                          {/* Checkbox */}
                                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                                            checked ? "bg-indigo-600 border-indigo-600" : "border-slate-300 bg-white"
                                          }`}>
                                            {checked && <Check className="w-4 h-4 text-white" />}
                                          </div>

                                          {/* Message number */}
                                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                                            msg.isLatest ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                                          }`}>
                                            <Hash className="w-3 h-3" />{msg.index + 1}
                                          </div>

                                          {/* Info */}
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className="text-xs font-bold text-slate-800 truncate">{msg.from}</span>
                                              {msg.isLatest && (
                                                <span className="px-2 py-0.5 bg-blue-500 text-white rounded-full text-[9px] font-bold">LATEST</span>
                                              )}
                                            </div>

                                            {/* ★ TOPIC — what this sub-email is about */}
                                            <div className="flex items-center gap-1.5 mb-1">
                                              <Tag className="w-3 h-3 text-indigo-500 shrink-0" />
                                              <span className="text-[11px] font-semibold text-indigo-700 truncate">{msg.topic}</span>
                                            </div>

                                            {/* Data format badges */}
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              {msg.hasTable && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-bold">
                                                  <Table2 className="w-2.5 h-2.5" /> Table Data
                                                </span>
                                              )}
                                              {msg.hasBullets && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold">
                                                  <List className="w-2.5 h-2.5" /> Bullet Specs
                                                </span>
                                              )}
                                              {msg.mpnCount > 0 && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-bold">
                                                  <MessageSquare className="w-2.5 h-2.5" /> {msg.mpnCount} MPN{msg.mpnCount > 1 ? "s" : ""}
                                                </span>
                                              )}
                                              {msg.date && (
                                                <span className="text-[10px] text-slate-400">{msg.date}</span>
                                              )}
                                            </div>
                                          </div>

                                          {/* Analyse this one */}
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleAnalyseSingle(msg); }}
                                            className="px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg text-[10px] font-bold hover:from-blue-600 hover:to-indigo-600 transition-all shadow-sm shrink-0"
                                          >
                                            <Sparkles className="w-3 h-3 inline mr-1" />
                                            Analyse This
                                          </button>
                                        </div>

                                        {/* Body preview when selected */}
                                        {checked && (
                                          <div className="border-t border-indigo-100 px-4 py-3 bg-slate-50/50">
                                            <pre className="text-[11px] text-slate-600 whitespace-pre-wrap font-sans leading-relaxed max-h-36 overflow-y-auto">
                                              {msg.body.slice(0, 600)}{msg.body.length > 600 ? "\n..." : ""}
                                            </pre>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Combined analyse button */}
                                {selectedThreadParts.size >= 1 && (
                                  <button onClick={handleAnalyse}
                                    className="mt-4 w-full flex items-center justify-center gap-3 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-sm hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/25">
                                    <Sparkles className="w-5 h-5" />
                                    {selectedThreadParts.size === threadMessages.length
                                      ? "Analyse All Messages Together"
                                      : `Analyse ${selectedThreadParts.size} Selected Message${selectedThreadParts.size > 1 ? "s" : ""}`}
                                    <ArrowRight className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            )}

                            {/* ═══ SINGLE MESSAGE — preview + Analyse ═══ */}
                            {!hasMultipleThreads && (
                              <>
                                <div className="bg-slate-900 rounded-xl p-5">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <User className="w-4 h-4 text-blue-400" />
                                      <span className="text-sm text-blue-400 font-medium">From: {email.from}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {threadMessages[0]?.hasTable && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[9px] font-bold">
                                          <Table2 className="w-2.5 h-2.5" /> Table
                                        </span>
                                      )}
                                      {threadMessages[0]?.hasBullets && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[9px] font-bold">
                                          <List className="w-2.5 h-2.5" /> Bullets
                                        </span>
                                      )}
                                      <span className="text-xs text-slate-500">{new Date(email.date).toLocaleString("en-IN")}</span>
                                    </div>
                                  </div>
                                  <pre className="email-body text-slate-300 text-sm whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">
                                    {email.body}
                                  </pre>
                                </div>
                                <div className="flex items-center gap-3">
                                  <button onClick={() => setShowPreview(false)}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-all">
                                    <Eye className="w-4 h-4" /> Hide
                                  </button>
                                  <button onClick={handleAnalyse}
                                    className="flex-1 flex items-center justify-center gap-3 px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-sm hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 group">
                                    <Sparkles className="w-5 h-5" />
                                    Analyse Requirements
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                  </button>
                                </div>
                              </>
                            )}

                            {/* Raw email toggle for multi-thread */}
                            {hasMultipleThreads && (
                              <div>
                                <button onClick={() => setShowRawEmail(!showRawEmail)}
                                  className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-all mb-2">
                                  <MailOpen className="w-3.5 h-3.5" />
                                  {showRawEmail ? "Hide" : "View"} Full Raw Email
                                  {showRawEmail ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                                {showRawEmail && (
                                  <div className="bg-slate-900 rounded-xl p-4 max-h-48 overflow-y-auto">
                                    <pre className="text-[11px] text-slate-400 whitespace-pre-wrap font-sans leading-relaxed">{email.body}</pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>

            {/* Empty states */}
            {emails.length === 0 && !loading && (
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 flex flex-col items-center justify-center">
                <Inbox className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-sm font-semibold text-slate-400">No emails loaded yet</p>
                <p className="text-xs text-slate-300 mt-1">
                  {gmailUser ? "Click \"Load Inbox\" to fetch your emails" : "Sign in with Google or click \"Load Inbox\" for sample emails"}
                </p>
              </div>
            )}
            {emails.length > 0 && filteredEmails.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-500">No emails match this date range</p>
                <p className="text-xs text-slate-400 mt-1">Try selecting a different date range</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="manual" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="relative">
              <textarea value={state.manualInput}
                onChange={(e) => dispatch({ type: "SET_MANUAL_INPUT", text: e.target.value })}
                placeholder={"Paste or type the customer requirement here...\n\nExample:\n- Type: Inductive proximity sensor\n- Sensing distance: minimum 10mm\n- Protection: IP67\n- Quantity: 500 units\n- Target price: under Rs.850/unit"}
                className="w-full h-64 p-5 bg-white border-2 border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 resize-none transition-all outline-none" />
              <div className="absolute bottom-3 right-3 text-xs text-slate-400">{state.manualInput.length} characters</div>
            </div>
            <button onClick={handleManualNext} disabled={state.manualInput.trim().length < 20}
              className="flex items-center gap-3 px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-sm hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-40 group">
              <Sparkles className="w-5 h-5" /> Analyse Requirements
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
