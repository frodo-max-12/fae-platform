"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, Building2, Cpu, Banknote, Award, ArrowRight, Search,
  PenLine, Loader2, Trophy, Target, CheckCircle2,
  Home, Star, Shield, Zap, ChevronDown, ChevronUp,
  Check, X, Ruler, Thermometer, Plug, Gauge, ShieldCheck,
  GitCompareArrows, XCircle, AlertTriangle, ArrowUpRight, DollarSign, TrendingDown
} from "lucide-react";
import { useWizard } from "@/lib/store";
import type { ProductDetails, AIRecommendation, RequirementItem, ComparisonResult, ComparisonRow, Verdict } from "@/types";
import toast from "react-hot-toast";
import { DEALER_NAMES } from "@/lib/dealers";

type SearchMode = "brand" | "ai";
type Granularity = "all" | "each";

const initialProduct: ProductDetails = {
  company: "", model: "", series: "", sensing: "", ipRating: "", tempRange: "",
  output: "", voltage: "", price: 0, moq: 0, warranty: "", advantages: "",
};

type Tab = "manual" | "inhouse";

interface SpecMatch {
  sensing?: boolean;
  ipRating?: boolean;
  tempRange?: boolean;
  output?: boolean;
  voltage?: boolean;
  price?: boolean;
  warranty?: boolean;
}

const specLabels: { key: keyof SpecMatch; label: string; icon: typeof Ruler }[] = [
  { key: "sensing", label: "Sensing", icon: Ruler },
  { key: "ipRating", label: "IP Rating", icon: ShieldCheck },
  { key: "tempRange", label: "Temp Range", icon: Thermometer },
  { key: "output", label: "Output", icon: Plug },
  { key: "voltage", label: "Voltage", icon: Gauge },
  { key: "price", label: "Price", icon: Banknote },
  { key: "warranty", label: "Warranty", icon: Shield },
];

const verdictConfig: Record<string, { icon: typeof CheckCircle2; bg: string; text: string; border: string; label: string }> = {
  MEETS:      { icon: CheckCircle2,   bg: "bg-emerald-50",  text: "text-emerald-700",  border: "border-emerald-200", label: "Meets" },
  EXCEEDS:    { icon: ArrowUpRight,   bg: "bg-blue-50",     text: "text-blue-700",     border: "border-blue-200",    label: "Exceeds" },
  COMPATIBLE: { icon: CheckCircle2,   bg: "bg-emerald-50",  text: "text-emerald-700",  border: "border-emerald-200", label: "Compatible" },
  GAP:        { icon: XCircle,        bg: "bg-red-50",      text: "text-red-700",      border: "border-red-200",     label: "Gap" },
  CLOSE:      { icon: AlertTriangle,  bg: "bg-amber-50",    text: "text-amber-700",    border: "border-amber-200",   label: "Close" },
  "APP-SAFE": { icon: AlertTriangle,  bg: "bg-amber-50",    text: "text-amber-700",    border: "border-amber-200",   label: "App-Safe" },
};

function RecommendationCard({
  rec, index, isSelected, onSelect,
}: {
  rec: AIRecommendation & { specMatches?: SpecMatch };
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const getScoreColor = (s: number) => s >= 90 ? "from-emerald-500 to-emerald-600" : s >= 80 ? "from-blue-500 to-blue-600" : "from-amber-500 to-amber-600";
  const getScoreBadge = (s: number) => s >= 90 ? { l: "Excellent", bg: "bg-emerald-100", t: "text-emerald-700" } : s >= 80 ? { l: "Strong", bg: "bg-blue-100", t: "text-blue-700" } : { l: "Good", bg: "bg-amber-100", t: "text-amber-700" };
  const badge = getScoreBadge(rec.matchScore);

  const matches: SpecMatch = rec.specMatches || {};
  const matchCount = Object.values(matches).filter(Boolean).length;
  const totalSpecs = Object.keys(matches).length || 7;

  return (
    <div className={`bg-white rounded-xl border-2 transition-all ${isSelected ? "border-emerald-400 shadow-lg shadow-emerald-500/10" : "border-slate-200 hover:border-blue-300 hover:shadow-md"}`}>
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getScoreColor(rec.matchScore)} flex items-center justify-center shadow text-white font-bold text-sm`}>
              {index === 0 ? <Trophy className="w-5 h-5" /> : `#${index + 1}`}
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-slate-800">{rec.company} {rec.model}</h4>
              <p className="text-[10px] text-slate-400">{rec.series}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.bg} ${badge.t}`}>{badge.l}</span>
            <span className="text-lg font-extrabold text-slate-800">{rec.matchScore}%</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { l: "Sensing", v: rec.sensing },
            { l: "IP", v: rec.ipRating },
            { l: "Output", v: rec.output },
            { l: "Price", v: rec.price ? `Rs.${rec.price}` : "—" },
          ].map((s) => (
            <div key={s.l} className="bg-slate-50 rounded-lg p-2">
              <p className="text-[9px] font-bold text-slate-400 uppercase">{s.l}</p>
              <p className="text-xs font-bold text-slate-700">{s.v || "—"}</p>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-slate-50 to-blue-50/50 rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Technical Compliance</span>
            <span className="text-[10px] font-bold text-blue-600">{matchCount}/{totalSpecs} specs met</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {specLabels.map(({ key, label, icon: Icon }) => {
              const met = matches[key];
              const unknown = met === undefined;
              return (
                <div key={key}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-semibold ${
                    unknown ? "bg-slate-100 text-slate-400"
                    : met ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-600"
                  }`}>
                  {unknown ? <div className="w-3 h-3 rounded-full bg-slate-300" /> : met ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  {label}
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-slate-500 mb-1">{rec.reasoning}</p>
      </div>

      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1 py-2 border-t border-slate-100 text-[10px] font-semibold text-slate-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all">
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {expanded ? "Less Details" : "Full Specs & Advantages"}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-5 pb-3 space-y-2 border-t border-slate-100 pt-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-400">Temp:</span> <span className="font-semibold text-slate-700">{rec.tempRange}</span></div>
                <div><span className="text-slate-400">Voltage:</span> <span className="font-semibold text-slate-700">{rec.voltage}</span></div>
                <div><span className="text-slate-400">MOQ:</span> <span className="font-semibold text-slate-700">{rec.moq} units</span></div>
                <div><span className="text-slate-400">Warranty:</span> <span className="font-semibold text-slate-700">{rec.warranty}</span></div>
              </div>
              <div className="bg-blue-50 rounded-lg p-2.5">
                <p className="text-[10px] font-bold text-blue-700 uppercase mb-1">Key Advantages</p>
                <p className="text-xs text-blue-800">{rec.advantages}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-5 pb-4 pt-1">
        <button onClick={onSelect}
          className={`w-full py-2.5 rounded-lg font-semibold text-xs transition-all ${
            isSelected ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25" : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600"
          }`}>
          {isSelected ? <span className="flex items-center justify-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Selected</span> : "Select This Product"}
        </button>
      </div>
    </div>
  );
}

/* ── Mouser-style Comparison Section ── */
function ComparisonSection({ comparison, product, extractedSpecs }: {
  comparison: ComparisonResult;
  product: ProductDetails;
  extractedSpecs: { referenceProduct?: string } | null;
}) {
  const meetsCount = comparison.rows.filter((r) => ["MEETS", "EXCEEDS", "COMPATIBLE"].includes(r.verdict)).length;
  const totalRows = comparison.rows.length;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mt-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Match Score</p>
          <p className="text-4xl font-extrabold">{comparison.overallScore}%</p>
          <p className="text-xs text-slate-400 mt-1">{meetsCount}/{totalRows} specs pass</p>
        </div>
        {comparison.totalSaving > 0 && (
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-5 text-white">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-emerald-200" />
              <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider">Total Saving</p>
            </div>
            <p className="text-4xl font-extrabold">Rs.{comparison.totalSaving.toLocaleString()}</p>
            <p className="text-xs text-emerald-200 mt-1">vs customer budget</p>
          </div>
        )}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white">
          <p className="text-[10px] font-bold text-blue-200 uppercase tracking-wider mb-1">Our Product</p>
          <p className="text-lg font-extrabold">{product.company} {product.model}</p>
          <p className="text-xs text-blue-200 mt-1">vs {extractedSpecs?.referenceProduct || "customer requirement"}</p>
        </div>
      </div>

      {/* Mouser-style Spec Comparison Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="grid grid-cols-[220px_1fr_1fr_120px] bg-slate-900 text-white">
          <div className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider border-r border-slate-700">Specification</div>
          <div className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider border-r border-slate-700">
            <span className="text-amber-300">Customer Requirement</span>
          </div>
          <div className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider border-r border-slate-700">
            <span className="text-emerald-300">Company A Offering</span>
          </div>
          <div className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-center">Status</div>
        </div>

        {comparison.rows.map((row, i) => {
          const config = verdictConfig[row.verdict] || verdictConfig.MEETS;
          const Icon = config.icon;
          const isEven = i % 2 === 0;

          return (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className={`grid grid-cols-[220px_1fr_1fr_120px] border-b border-slate-100 ${isEven ? "bg-white" : "bg-slate-50/50"} hover:bg-blue-50/30 transition-colors`}>
              <div className="px-5 py-4 border-r border-slate-100">
                <span className="text-xs font-bold text-slate-700">{row.spec}</span>
              </div>
              <div className="px-5 py-4 border-r border-slate-100">
                <span className="text-sm text-slate-600">{row.customerNeed || "—"}</span>
              </div>
              <div className="px-5 py-4 border-r border-slate-100">
                <span className="text-sm font-semibold text-slate-800">{row.ourValue || "—"}</span>
                {row.note && <p className="text-[10px] text-emerald-600 mt-0.5">{row.note}</p>}
              </div>
              <div className="px-3 py-4 flex items-center justify-center">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${config.bg} ${config.text} border ${config.border}`}>
                  <Icon className="w-3 h-3" />
                  {config.label}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Verdict Summary */}
      <div className="flex items-center gap-3 flex-wrap">
        {["MEETS", "EXCEEDS", "COMPATIBLE", "CLOSE", "APP-SAFE", "GAP"].map((v) => {
          const count = comparison.rows.filter((r) => r.verdict === v).length;
          if (count === 0) return null;
          const c = verdictConfig[v];
          const VIcon = c.icon;
          return (
            <div key={v} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${c.bg} ${c.text} ${c.border}`}>
              <VIcon className="w-3.5 h-3.5" />
              {c.label}: {count}
            </div>
          );
        })}
      </div>

      {/* Cost Saving */}
      {comparison.totalSaving > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <TrendingDown className="w-6 h-6 text-emerald-600" />
            <div>
              <p className="text-sm font-bold text-emerald-800">
                Total Saving: <span className="text-xl">Rs.{comparison.totalSaving.toLocaleString()}</span>
              </p>
              <p className="text-xs text-emerald-600 mt-1">vs customer&apos;s budget target</p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ── Mouser-style per-MPN comparison table (Customer Need vs N candidates) ── */
function MpnComparisonTable({
  req, matches, selectedKey, onSelect,
}: {
  req: RequirementItem;
  matches: Array<AIRecommendation & { specMatches?: SpecMatch }>;
  selectedKey: string;
  onSelect: (rec: AIRecommendation) => void;
}) {
  const rows: Array<{
    label: string;
    customer: string;
    get: (m: AIRecommendation) => string;
    matchKey?: keyof SpecMatch;
  }> = [
    { label: "Manufacturer",     customer: req.referenceCompany || "—", get: (m) => m.company },
    { label: "MPN / Model",      customer: req.referenceMPN || "—",     get: (m) => m.model },
    { label: "Series / Line",    customer: "—",                          get: (m) => m.series },
    { label: "Key Spec",         customer: req.sensingDistance || "—",  get: (m) => m.sensing,   matchKey: "sensing" },
    { label: "IP / Package",     customer: req.ipRating || "—",         get: (m) => m.ipRating,  matchKey: "ipRating" },
    { label: "Temp Range",       customer: req.tempRange || "—",        get: (m) => m.tempRange, matchKey: "tempRange" },
    { label: "Output / Config",  customer: req.outputType || "—",       get: (m) => m.output,    matchKey: "output" },
    { label: "Supply Voltage",   customer: req.supplyVoltage || "—",    get: (m) => m.voltage,   matchKey: "voltage" },
    { label: "Unit Price",       customer: req.targetPrice || "—",      get: (m) => m.price ? `Rs.${m.price}` : "—", matchKey: "price" },
    { label: "MOQ",              customer: req.quantity || "—",         get: (m) => m.moq ? `${m.moq} units` : "—" },
    { label: "Warranty",         customer: "Standard",                  get: (m) => m.warranty || "—", matchKey: "warranty" },
  ];

  const scoreColor = (s: number) =>
    s >= 90 ? "from-emerald-500 to-emerald-600"
    : s >= 80 ? "from-blue-500 to-blue-600"
    : "from-amber-500 to-amber-600";

  const cols = matches.length;
  const grid = `220px 1.2fr ${Array(cols).fill("1fr").join(" ")}`;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header row */}
      <div className="grid items-stretch bg-slate-900 text-white" style={{ gridTemplateColumns: grid }}>
        <div className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider border-r border-slate-700">Specification</div>
        <div className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider border-r border-slate-700">
          <span className="text-amber-300">Customer Requirement</span>
        </div>
        {matches.map((m, i) => {
          const key = `${m.company}-${m.model}`;
          const isSel = key === selectedKey;
          return (
            <div key={key} className={`px-3 py-3 border-r border-slate-700 flex flex-col gap-2 ${isSel ? "bg-emerald-700/30" : ""}`}>
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-md bg-gradient-to-br ${scoreColor(m.matchScore)} flex items-center justify-center text-white text-[11px] font-extrabold shadow`}>
                  #{i + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold text-emerald-200 truncate">{m.company}</p>
                  <p className="text-[10px] text-white font-bold truncate">{m.model}</p>
                </div>
                <span className="ml-auto text-[11px] font-extrabold text-white">{m.matchScore}%</span>
              </div>
              <button onClick={() => onSelect(m)}
                className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-bold transition-colors ${
                  isSel ? "bg-emerald-500 text-white" : "bg-white/10 text-white hover:bg-white/20"
                }`}>
                {isSel ? <><CheckCircle2 className="w-3.5 h-3.5" /> Selected</> : <><Check className="w-3.5 h-3.5" /> Select</>}
              </button>
            </div>
          );
        })}
      </div>

      {/* Spec rows */}
      {rows.map((row, ri) => (
        <div key={row.label} className={`grid items-stretch border-b border-slate-100 ${ri % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`} style={{ gridTemplateColumns: grid }}>
          <div className="px-4 py-3 border-r border-slate-100 text-xs font-bold text-slate-700">{row.label}</div>
          <div className="px-4 py-3 border-r border-slate-100 text-xs text-slate-600">{row.customer}</div>
          {matches.map((m) => {
            const val = row.get(m) || "—";
            const specPass = row.matchKey ? m.specMatches?.[row.matchKey] : undefined;
            const key = `${m.company}-${m.model}`;
            const isSel = key === selectedKey;
            return (
              <div key={key + "-" + row.label}
                className={`px-3 py-3 border-r border-slate-100 flex items-center gap-2 text-xs ${isSel ? "bg-emerald-50/60" : ""}`}>
                <span className="font-semibold text-slate-800 truncate">{val}</span>
                {specPass === true && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                {specPass === false && <X className="w-3.5 h-3.5 text-red-500 shrink-0" />}
              </div>
            );
          })}
        </div>
      ))}

      {/* Reasoning row */}
      <div className="grid items-stretch bg-blue-50/40" style={{ gridTemplateColumns: grid }}>
        <div className="px-4 py-3 border-r border-slate-100 text-xs font-bold text-blue-800">FAE Reasoning</div>
        <div className="px-4 py-3 border-r border-slate-100 text-xs text-slate-400 italic">Why this candidate fits the customer&apos;s ask</div>
        {matches.map((m) => (
          <div key={"reason-" + m.company + m.model} className="px-3 py-3 border-r border-slate-100 text-[11px] text-slate-700">
            {m.reasoning || "—"}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Hero tick card for 100% matches — no comparison needed ── */
function PerfectMatchCard({
  rec, isSelected, onSelect,
}: {
  rec: AIRecommendation & { specMatches?: SpecMatch };
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div className={`relative bg-gradient-to-br from-emerald-50 via-white to-emerald-50 rounded-2xl border-2 transition-all ${
      isSelected ? "border-emerald-500 shadow-xl shadow-emerald-500/20" : "border-emerald-300 hover:border-emerald-500 hover:shadow-lg"
    }`}>
      <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold shadow">
        <Trophy className="w-3 h-3" />
        100% MATCH
      </div>
      <div className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-extrabold shadow-lg">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-slate-800">{rec.company} {rec.model}</h4>
            <p className="text-[11px] text-slate-500">{rec.series}</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { l: "Key Spec", v: rec.sensing },
            { l: "Package", v: rec.ipRating },
            { l: "Output", v: rec.output },
            { l: "Price", v: rec.price ? `Rs.${rec.price}` : "—" },
          ].map((s) => (
            <div key={s.l} className="bg-white/80 border border-emerald-100 rounded-lg p-2">
              <p className="text-[9px] font-bold text-emerald-700 uppercase">{s.l}</p>
              <p className="text-xs font-bold text-slate-800 truncate">{s.v || "—"}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-600 mb-4 italic">{rec.reasoning}</p>
        <button onClick={onSelect}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
            isSelected
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30"
              : "bg-white border-2 border-emerald-400 text-emerald-700 hover:bg-emerald-500 hover:text-white hover:border-emerald-500"
          }`}>
          <CheckCircle2 className="w-4 h-4" />
          {isSelected ? "Selected" : "Select This Match"}
        </button>
      </div>
    </div>
  );
}

export default function Step3Product() {
  const { state, dispatch } = useWizard();
  const [activeTab, setActiveTab] = useState<Tab>("inhouse");
  const [product, setProduct] = useState<ProductDetails>(state.productDetails || initialProduct);

  // In-house brand matches (from Company A brand websites via AI)
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogMatches, setCatalogMatches] = useState<Record<string, AIRecommendation[]>>({});
  const [catalogNoMatch, setCatalogNoMatch] = useState<Record<string, string>>({});
  const [catalogFetched, setCatalogFetched] = useState(false);

  // Sub-mode controls
  const [searchMode, setSearchMode] = useState<SearchMode>("brand");
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [brandQuery, setBrandQuery] = useState<string>("");
  const [brandListOpen, setBrandListOpen] = useState(false);
  const [granularity, setGranularity] = useState<Granularity>("each");
  const [selectedReqIds, setSelectedReqIds] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const brandBoxRef = useRef<HTMLDivElement | null>(null);

  // Comparison state
  const [comparison, setComparison] = useState<ComparisonResult | null>(state.comparison || null);
  const [compareLoading, setCompareLoading] = useState(false);

  const [selectedPerReq, setSelectedPerReq] = useState<Record<string, ProductDetails>>({});

  const requirements = state.extraction?.requirements || [];

  // Default-select all MPNs when extraction loads
  useEffect(() => {
    if (requirements.length > 0 && selectedReqIds.size === 0) {
      setSelectedReqIds(new Set(requirements.map((r) => r.id)));
    }
  }, [requirements.length]);

  // Close brand typeahead on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (brandBoxRef.current && !brandBoxRef.current.contains(e.target as Node)) {
        setBrandListOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredBrands = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    if (!q) return DEALER_NAMES;
    return DEALER_NAMES.filter((b) => b.toLowerCase().includes(q));
  }, [brandQuery]);

  const toggleReq = (id: string) => {
    setSelectedReqIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllReqs = () => {
    setSelectedReqIds((prev) => {
      if (prev.size === requirements.length) return new Set();
      return new Set(requirements.map((r) => r.id));
    });
  };

  const stopSearch = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setCatalogLoading(false);
    toast("Search stopped", { icon: "⏹️" });
  };

  const update = (key: keyof ProductDetails, value: string | number) => {
    setProduct((prev) => ({ ...prev, [key]: value }));
    // Clear comparison when product changes
    setComparison(null);
  };

  const selectFromRec = (rec: AIRecommendation, reqId?: string) => {
    const p: ProductDetails = {
      company: rec.company, model: rec.model, series: rec.series, sensing: rec.sensing,
      ipRating: rec.ipRating, tempRange: rec.tempRange, output: rec.output, voltage: rec.voltage,
      price: rec.price, moq: rec.moq, warranty: rec.warranty, advantages: rec.advantages,
    };
    setProduct(p);
    dispatch({ type: "SET_PRODUCT_DETAILS", product: p });
    if (reqId) setSelectedPerReq((prev) => ({ ...prev, [reqId]: p }));
    toast.success(`Selected ${rec.company} ${rec.model}`);
    setComparison(null);
    // Silently prepare the /api/compare payload for Step 4/5 email draft
    void buildComparisonFor(p, true);
  };

  // Research in-house brand matches — searches Company A brand websites via AI
  const fetchCatalogMatches = async () => {
    if (requirements.length === 0) return;
    const picked = requirements.filter((r) => selectedReqIds.has(r.id));
    if (picked.length === 0) {
      toast.error("Pick at least one MPN to search");
      return;
    }
    if (searchMode === "brand" && !selectedBrand) {
      toast.error("Pick a make to search");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setCatalogLoading(true);

    try {
      const payload: Record<string, unknown> = { requirements: picked };
      if (searchMode === "brand") {
        payload.mode = "brand";
        payload.brand = selectedBrand;
        payload.granularity = granularity;
      } else {
        payload.mode = "ai";
      }

      const res = await fetch("/api/products/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const raw = (data.batchMatches || {}) as Record<string, { matches?: AIRecommendation[]; noMatchReason?: string } | AIRecommendation[]>;
      const results: Record<string, AIRecommendation[]> = {};
      const noMatch: Record<string, string> = {};
      for (const [id, val] of Object.entries(raw)) {
        if (Array.isArray(val)) {
          results[id] = val;
        } else {
          results[id] = Array.isArray(val?.matches) ? (val.matches as AIRecommendation[]) : [];
          if (val?.noMatchReason) noMatch[id] = val.noMatchReason;
        }
      }
      for (const req of requirements) {
        if (!results[req.id]) results[req.id] = [];
      }

      setCatalogMatches(results);
      setCatalogNoMatch(noMatch);
      setCatalogFetched(true);
      const totalMatches = Object.values(results).reduce((s, m) => s + m.length, 0);
      if (totalMatches > 0) toast.success(`Found ${totalMatches} matches${searchMode === "brand" ? ` from ${selectedBrand}` : " from Company A brand lines"}`);
      else toast("No matching products found.", { icon: "🔍" });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // user-stopped — leave prior results as-is
        abortRef.current = null;
        return;
      }
      const empty: Record<string, AIRecommendation[]> = {};
      for (const req of requirements) empty[req.id] = [];
      setCatalogMatches(empty);
      setCatalogFetched(true);
      toast.error("Failed to search brand products");
    }

    abortRef.current = null;
    setCatalogLoading(false);
  };

  // Build comparison + draft in ONE API call
  const buildComparisonFor = async (p: ProductDetails, silent: boolean = false) => {
    if (!p.company || !p.model) {
      if (!silent) toast.error("Please select or enter a product first");
      return;
    }
    dispatch({ type: "SET_PRODUCT_DETAILS", product: p });
    setCompareLoading(true);

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerSpecs: state.extractedSpecs,
          productSpecs: p,
          generateDraft: true,
        }),
      });

      if (!res.ok) throw new Error("Comparison failed");
      const data = await res.json();

      const comp = { rows: data.rows, totalSaving: data.totalSaving, overallScore: data.overallScore };
      setComparison(comp);
      dispatch({ type: "SET_COMPARISON", comparison: comp });

      // Store draft for Step 4
      if (data.emailDraft) {
        dispatch({ type: "SET_EMAIL_DRAFT", draft: data.emailDraft });
      }

      if (!silent) toast.success("Comparison built successfully!");
    } catch {
      // Fallback comparison
      const targetPrice = parseFloat(state.extractedSpecs?.targetPrice?.replace(/[^0-9.]/g, "") || "850");
      const ourPrice = p.price || 780;
      const qty = parseInt(state.extractedSpecs?.quantity || "500");
      const saving = (targetPrice - ourPrice) * qty;

      const fallback: ComparisonResult = {
        rows: [
          { spec: "Manufacturer", customerNeed: state.extractedSpecs?.referenceProduct || "—", ourValue: p.company, verdict: "COMPATIBLE" as Verdict, note: "" },
          { spec: "Part Number", customerNeed: state.extractedSpecs?.referenceProduct || "—", ourValue: p.model, verdict: "COMPATIBLE" as Verdict, note: "" },
          { spec: "Key Specification", customerNeed: state.extractedSpecs?.sensingDistance || "—", ourValue: p.sensing || "—", verdict: "MEETS" as Verdict, note: "" },
          { spec: "Package / Rating", customerNeed: state.extractedSpecs?.ipRating || "—", ourValue: p.ipRating || "—", verdict: "MEETS" as Verdict, note: "" },
          { spec: "Operating Temperature", customerNeed: state.extractedSpecs?.tempRange || "—", ourValue: p.tempRange || "—", verdict: "APP-SAFE" as Verdict, note: "" },
          { spec: "Output / Configuration", customerNeed: state.extractedSpecs?.outputType || "—", ourValue: p.output || "—", verdict: "MEETS" as Verdict, note: "" },
          { spec: "Voltage", customerNeed: state.extractedSpecs?.supplyVoltage || "—", ourValue: p.voltage || "—", verdict: "COMPATIBLE" as Verdict, note: "" },
          { spec: "Unit Price", customerNeed: state.extractedSpecs?.targetPrice || `Rs.${targetPrice}`, ourValue: `Rs.${ourPrice}`, verdict: saving >= 0 ? "EXCEEDS" as Verdict : "GAP" as Verdict, note: saving > 0 ? `Saves Rs.${(targetPrice - ourPrice).toFixed(0)}/unit` : "" },
          { spec: "Warranty", customerNeed: "Standard", ourValue: p.warranty || "12 months", verdict: "MEETS" as Verdict, note: "" },
        ],
        totalSaving: saving > 0 ? saving : 0,
        overallScore: 87,
      };
      setComparison(fallback);
      dispatch({ type: "SET_COMPARISON", comparison: fallback });
      if (!silent) toast.success("Comparison built (demo mode)");
    }

    setCompareLoading(false);
  };

  // Manual-tab entry point — uses current form state
  const buildComparison = () => buildComparisonFor(product, false);

  const handleNext = () => {
    if (!comparison) {
      toast.error("Please build comparison first");
      return;
    }
    dispatch({ type: "SET_STEP", step: 4 });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
      {/* Tab Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200 p-1.5 flex gap-1">
        {([
          { key: "inhouse" as Tab, label: "In-house Product Line", icon: Home, active: "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-500/25" },
          { key: "manual" as Tab, label: "Manual Entry", icon: PenLine, active: "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25" },
        ]).map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === t.key ? t.active : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            }`}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ──── TAB 1: IN-HOUSE PRODUCT LINE ──── */}
        {activeTab === "inhouse" && (
          <motion.div key="inhouse" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
            {/* Header */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-4">
                <Home className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-bold text-emerald-800">Company A — In-house Product Line</p>
                  <p className="text-xs text-emerald-600">Pick your make for a focused search, or let AI scan all 54 dealer brands.</p>
                </div>
              </div>

              {/* Sub-mode selector */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button onClick={() => setSearchMode("brand")}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${
                    searchMode === "brand"
                      ? "bg-emerald-600 text-white shadow shadow-emerald-500/30"
                      : "bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  }`}>
                  <Search className="w-3.5 h-3.5" />
                  Search Your Make
                </button>
                <button onClick={() => setSearchMode("ai")}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${
                    searchMode === "ai"
                      ? "bg-blue-600 text-white shadow shadow-blue-500/30"
                      : "bg-white border border-blue-200 text-blue-700 hover:bg-blue-50"
                  }`}>
                  <Star className="w-3.5 h-3.5" />
                  AI Search — 54+ Brands
                </button>
              </div>

              {/* Brand-mode controls */}
              {searchMode === "brand" && (
                <div className="space-y-3">
                  {/* Typeahead brand search */}
                  <div ref={brandBoxRef} className="relative">
                    <label className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1 block">Search Your Make</label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={brandQuery}
                        placeholder={selectedBrand ? `Selected: ${selectedBrand}` : "Type a brand name… e.g. Rectron, Hongfa, Silergy"}
                        onChange={(e) => { setBrandQuery(e.target.value); setBrandListOpen(true); }}
                        onFocus={() => setBrandListOpen(true)}
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-emerald-200 rounded-lg text-xs font-semibold text-slate-700 placeholder-slate-300 outline-none focus:border-emerald-500"
                      />
                      {selectedBrand && !brandQuery && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                          {selectedBrand}
                        </span>
                      )}
                    </div>
                    {brandListOpen && filteredBrands.length > 0 && (
                      <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-emerald-200 rounded-lg shadow-lg">
                        {filteredBrands.map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => {
                              setSelectedBrand(b);
                              setBrandQuery("");
                              setBrandListOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 ${selectedBrand === b ? "bg-emerald-50 text-emerald-800 font-bold" : "text-slate-700"}`}>
                            {b}
                          </button>
                        ))}
                      </div>
                    )}
                    {brandListOpen && filteredBrands.length === 0 && (
                      <div className="absolute z-20 mt-1 w-full bg-white border border-emerald-200 rounded-lg shadow p-3 text-xs text-slate-400">
                        No brand matches &quot;{brandQuery}&quot;
                      </div>
                    )}
                  </div>

                  {/* MPN multi-select */}
                  {requirements.length > 0 && (
                    <div className="bg-white border border-emerald-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Which MPNs to search</label>
                        <button onClick={toggleAllReqs}
                          className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 hover:text-emerald-900">
                          <input
                            type="checkbox"
                            readOnly
                            checked={selectedReqIds.size === requirements.length}
                            className="accent-emerald-600"
                          />
                          All MPNs ({selectedReqIds.size}/{requirements.length})
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
                        {requirements.map((r) => {
                          const checked = selectedReqIds.has(r.id);
                          return (
                            <label key={r.id}
                              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer text-xs border transition-colors ${
                                checked ? "bg-emerald-50 border-emerald-300 text-emerald-900" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                              }`}>
                              <input type="checkbox" checked={checked} onChange={() => toggleReq(r.id)} className="accent-emerald-600" />
                              <span className="font-bold truncate">{r.referenceMPN || "—"}</span>
                              <span className="text-[10px] text-slate-400 truncate">{r.referenceCompany}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Scope + search/stop */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex rounded-lg border border-emerald-200 bg-white overflow-hidden">
                      <button onClick={() => setGranularity("all")}
                        className={`px-3 py-2 text-[11px] font-bold ${granularity === "all" ? "bg-emerald-600 text-white" : "text-emerald-700 hover:bg-emerald-50"}`}>
                        Batch together
                      </button>
                      <button onClick={() => setGranularity("each")}
                        className={`px-3 py-2 text-[11px] font-bold border-l border-emerald-200 ${granularity === "each" ? "bg-emerald-600 text-white" : "text-emerald-700 hover:bg-emerald-50"}`}>
                        One by one
                      </button>
                    </div>

                    {catalogLoading ? (
                      <button onClick={stopSearch}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 shadow shadow-red-500/20">
                        <XCircle className="w-4 h-4" />
                        Stop Analysis
                      </button>
                    ) : (
                      <button onClick={fetchCatalogMatches}
                        disabled={requirements.length === 0 || !selectedBrand || selectedReqIds.size === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 shadow shadow-emerald-500/20">
                        <Search className="w-4 h-4" />
                        {catalogFetched ? "Refresh Search" : `Search ${selectedBrand || "—"} for ${selectedReqIds.size} MPN${selectedReqIds.size !== 1 ? "s" : ""}`}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* AI-mode controls */}
              {searchMode === "ai" && (
                <div className="space-y-3">
                  {/* MPN multi-select for AI too */}
                  {requirements.length > 0 && (
                    <div className="bg-white border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Which MPNs to scan</label>
                        <button onClick={toggleAllReqs}
                          className="flex items-center gap-1.5 text-[10px] font-bold text-blue-700 hover:text-blue-900">
                          <input
                            type="checkbox"
                            readOnly
                            checked={selectedReqIds.size === requirements.length}
                            className="accent-blue-600"
                          />
                          All MPNs ({selectedReqIds.size}/{requirements.length})
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
                        {requirements.map((r) => {
                          const checked = selectedReqIds.has(r.id);
                          return (
                            <label key={r.id}
                              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer text-xs border transition-colors ${
                                checked ? "bg-blue-50 border-blue-300 text-blue-900" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                              }`}>
                              <input type="checkbox" checked={checked} onChange={() => toggleReq(r.id)} className="accent-blue-600" />
                              <span className="font-bold truncate">{r.referenceMPN || "—"}</span>
                              <span className="text-[10px] text-slate-400 truncate">{r.referenceCompany}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between bg-white border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-700">LLM scans all 54 dealer brands for the selected MPNs.</p>
                    {catalogLoading ? (
                      <button onClick={stopSearch}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 shadow shadow-red-500/20">
                        <XCircle className="w-4 h-4" />
                        Stop Analysis
                      </button>
                    ) : (
                      <button onClick={fetchCatalogMatches}
                        disabled={requirements.length === 0 || selectedReqIds.size === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 shadow shadow-blue-500/20">
                        <Star className="w-4 h-4" />
                        {catalogFetched ? "Refresh AI Search" : `Run AI Search — ${selectedReqIds.size} MPN${selectedReqIds.size !== 1 ? "s" : ""}`}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Loading State */}
            {catalogLoading && (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
                <h3 className="text-lg font-bold text-slate-800 mb-1">Researching Company A Brand Product Lines</h3>
                <p className="text-sm text-slate-400">Researching all 54 Company A authorized dealer brands across diodes, MOSFETs, MCUs, memory, sensors, displays, relays, connectors, passives & more...</p>
              </div>
            )}

            {/* No requirements */}
            {!catalogLoading && requirements.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No requirements extracted yet. Go back to Step 2.</p>
              </div>
            )}

            {/* Not yet searched */}
            {!catalogLoading && !catalogFetched && requirements.length > 0 && (
              <div className="bg-white rounded-2xl border-2 border-dashed border-emerald-200 p-12 text-center">
                <Search className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-600 mb-1">
                  {searchMode === "brand"
                    ? `Ready to search ${selectedBrand}`
                    : "Ready to AI-scan all 54 Company A brands"}
                </h3>
                <p className="text-sm text-slate-400">
                  {searchMode === "brand"
                    ? `${requirements.length} requirement(s) · ${granularity === "all" ? "processed in one batch" : "processed individually"}`
                    : `${requirements.length} requirement(s) across every dealer`}
                </p>
              </div>
            )}

            {/* Results */}
            {!catalogLoading && catalogFetched && requirements.length > 0 && (
              <>
                {requirements.map((req) => {
                  const allMatches = catalogMatches[req.id] || [];
                  const perfect = allMatches.filter((m) => (m.matchScore || 0) >= 100);
                  const partial = allMatches.filter((m) => (m.matchScore || 0) < 100);
                  const noMatchMsg = catalogNoMatch[req.id];

                  return (
                    <div key={req.id} className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-6 bg-emerald-500 rounded-full" />
                        <h3 className="text-sm font-extrabold text-slate-800">
                          Matches for: <span className="text-blue-600">{req.referenceCompany} {req.referenceMPN}</span>
                        </h3>
                        <span className="text-xs text-slate-400">({req.type})</span>
                        {searchMode === "brand" && (
                          <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                            searched in {selectedBrand}
                          </span>
                        )}
                      </div>

                      {/* 100% perfect match hero — tick only, no comparison */}
                      {perfect.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-emerald-600" />
                            <p className="text-xs font-extrabold text-emerald-700 uppercase tracking-wider">
                              100% Match — Fulfils customer on-demand ({perfect.length})
                            </p>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {perfect.map((rec) => (
                              <PerfectMatchCard
                                key={`p-${rec.company}-${rec.model}`}
                                rec={rec}
                                isSelected={product.model === rec.model && product.company === rec.company}
                                onSelect={() => selectFromRec(rec, req.id)}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Alternatives (<100%) — Mouser-style per-MPN comparison table */}
                      {partial.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <GitCompareArrows className="w-4 h-4 text-amber-600" />
                            <p className="text-xs font-extrabold text-amber-700 uppercase tracking-wider">
                              Close Alternatives — side-by-side comparison ({partial.length})
                            </p>
                          </div>
                          <MpnComparisonTable
                            req={req}
                            matches={partial}
                            selectedKey={`${product.company}-${product.model}`}
                            onSelect={(rec) => selectFromRec(rec, req.id)}
                          />
                        </div>
                      )}

                      {/* No match */}
                      {allMatches.length === 0 && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
                          <XCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-sm font-bold text-slate-600">Not Matched</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {noMatchMsg || (searchMode === "brand"
                              ? `${selectedBrand} does not carry a product meeting this requirement.`
                              : "No matching products found across the 54 Company A brands.")}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-2">Try a different make, switch to AI search, or use Manual Entry.</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* Selected product summary + Continue — appears once any match is picked */}
            {product.company && product.model && (
              <div className="border-t border-slate-200 pt-6 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Selected for draft</p>
                    <p className="text-sm font-extrabold text-slate-800">{product.company} {product.model}</p>
                  </div>
                  {compareLoading && <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />}
                </div>
                <button onClick={handleNext} disabled={compareLoading || !comparison}
                  className="flex items-center gap-3 px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold text-sm hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50">
                  {compareLoading ? "Preparing draft…" : "Continue to Email Draft"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* ──── TAB 2: MANUAL ENTRY ──── */}
        {activeTab === "manual" && (
          <motion.div key="manual" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                <div className="flex items-center gap-2 mb-1"><Building2 className="w-4 h-4 text-blue-600" /><h3 className="text-sm font-bold text-slate-700">Company & Product</h3></div>
                {([["company","Brand / Company","e.g. Rectron"],["model","Model Number","e.g. RS1M"],["series","Product Series","e.g. RS series"]] as const).map(([key,label,ph]) => (
                  <div key={key}><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">{label}</label>
                  <input type="text" value={product[key]} onChange={(e) => update(key, e.target.value)} placeholder={ph}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none" /></div>
                ))}
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                <div className="flex items-center gap-2 mb-1"><Cpu className="w-4 h-4 text-purple-600" /><h3 className="text-sm font-bold text-slate-700">Technical Specs</h3></div>
                {([["sensing","Key Spec / Rating","e.g. 1A 50V"],["ipRating","Package / Rating","e.g. DO-214AC, SMA"],["tempRange","Temperature","e.g. -55C to +150C"],["output","Output / Config","e.g. Ultra-fast recovery"],["voltage","Voltage Rating","e.g. 50V - 1000V"]] as const).map(([key,label,ph]) => (
                  <div key={key}><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">{label}</label>
                  <input type="text" value={product[key]} onChange={(e) => update(key, e.target.value)} placeholder={ph}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-300 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 outline-none" /></div>
                ))}
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                <div className="flex items-center gap-2 mb-1"><Banknote className="w-4 h-4 text-emerald-600" /><h3 className="text-sm font-bold text-slate-700">Commercial</h3></div>
                <div><label className="text-[10px] font-bold text-slate-400 uppercase">Price (Rs.)</label>
                  <input type="number" value={product.price || ""} onChange={(e) => update("price", parseFloat(e.target.value) || 0)} placeholder="50" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-400" /></div>
                <div><label className="text-[10px] font-bold text-slate-400 uppercase">MOQ</label>
                  <input type="number" value={product.moq || ""} onChange={(e) => update("moq", parseInt(e.target.value) || 0)} placeholder="100" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-400" /></div>
                <div><label className="text-[10px] font-bold text-slate-400 uppercase">Warranty</label>
                  <input type="text" value={product.warranty} onChange={(e) => update("warranty", e.target.value)} placeholder="12 months" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-400" /></div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-2"><Award className="w-4 h-4 text-blue-600" /><h3 className="text-sm font-bold text-slate-700">Key Advantages</h3></div>
              <textarea value={product.advantages} onChange={(e) => update("advantages", e.target.value)} placeholder="Key selling points..." className="w-full h-20 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none outline-none focus:border-blue-400" />
            </div>

            {/* Build Comparison Button */}
            <button onClick={buildComparison} disabled={compareLoading || !product.company || !product.model}
              className="flex items-center gap-3 px-8 py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold text-sm hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50">
              {compareLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Building Comparison...</>
              ) : (
                <><GitCompareArrows className="w-4 h-4" /> Build Mouser-style Comparison</>
              )}
            </button>

            {/* Comparison Results */}
            {comparison && (
              <>
                <ComparisonSection comparison={comparison} product={product} extractedSpecs={state.extractedSpecs} />
                <button onClick={handleNext}
                  className="flex items-center gap-3 px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold text-sm hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/25">
                  Continue to Email Draft <ArrowRight className="w-4 h-4" />
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
