"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  GitCompareArrows, CheckCircle2, AlertTriangle, XCircle, TrendingDown,
  ArrowRight, Loader2, DollarSign, ExternalLink, ArrowUpRight, ArrowDownRight, Equal
} from "lucide-react";
import { useWizard } from "@/lib/store";
import type { ComparisonResult, ComparisonRow, Verdict } from "@/types";
import toast from "react-hot-toast";
import { persistProgress } from "@/lib/persistProgress";

const verdictConfig: Record<string, { icon: typeof CheckCircle2; bg: string; text: string; border: string; label: string }> = {
  MEETS:      { icon: CheckCircle2,   bg: "bg-emerald-50",  text: "text-emerald-700",  border: "border-emerald-200", label: "Meets" },
  EXCEEDS:    { icon: ArrowUpRight,   bg: "bg-blue-50",     text: "text-blue-700",     border: "border-blue-200",    label: "Exceeds" },
  COMPATIBLE: { icon: CheckCircle2,   bg: "bg-emerald-50",  text: "text-emerald-700",  border: "border-emerald-200", label: "Compatible" },
  GAP:        { icon: XCircle,        bg: "bg-red-50",      text: "text-red-700",      border: "border-red-200",     label: "Gap" },
  CLOSE:      { icon: AlertTriangle,  bg: "bg-amber-50",    text: "text-amber-700",    border: "border-amber-200",   label: "Close" },
  "APP-SAFE": { icon: AlertTriangle,  bg: "bg-amber-50",    text: "text-amber-700",    border: "border-amber-200",   label: "App-Safe" },
};

export default function Step4Compare() {
  const { state, dispatch } = useWizard();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const buildComparison = async () => {
    setLoading(true);
    setProgress(0);

    const steps = [10, 25, 45, 65, 80, 95, 100];
    for (const p of steps) {
      await new Promise((r) => setTimeout(r, 400));
      setProgress(p);
    }

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerSpecs: state.extractedSpecs,
          productSpecs: state.productDetails,
          generateDraft: true,
        }),
      });

      if (!res.ok) throw new Error("Comparison failed");
      const data = await res.json();

      // Store comparison
      const comparison = { rows: data.rows, totalSaving: data.totalSaving, overallScore: data.overallScore };
      dispatch({ type: "SET_COMPARISON", comparison });

      // Store draft if returned (saves a separate API call in Step 5)
      if (data.emailDraft) {
        dispatch({ type: "SET_EMAIL_DRAFT", draft: data.emailDraft });
      }

      // Persist progress → status "compared" (+ draft if present)
      persistProgress({
        id: state.requestId || undefined,
        status: data.emailDraft ? "draft" : "compared",
        comparison,
        ...(data.emailDraft ? { emailDraft: data.emailDraft } : {}),
      });
    } catch {
      const targetPrice = parseFloat(state.extractedSpecs?.targetPrice?.replace(/[^0-9.]/g, "") || "850");
      const ourPrice = state.productDetails?.price || 780;
      const qty = parseInt(state.extractedSpecs?.quantity || "500");
      const saving = (targetPrice - ourPrice) * qty;

      const mockComparison: ComparisonResult = {
        rows: [
          { spec: "Manufacturer", customerNeed: state.extractedSpecs?.referenceProduct || "—", ourValue: state.productDetails?.company || "Company A", verdict: "COMPATIBLE" as Verdict, note: "" },
          { spec: "Part Number", customerNeed: state.extractedSpecs?.referenceProduct || "—", ourValue: state.productDetails?.model || "—", verdict: "COMPATIBLE" as Verdict, note: "" },
          { spec: "Key Specification", customerNeed: state.extractedSpecs?.sensingDistance || "—", ourValue: state.productDetails?.sensing || "—", verdict: "MEETS" as Verdict, note: "" },
          { spec: "Package / Rating", customerNeed: state.extractedSpecs?.ipRating || "—", ourValue: state.productDetails?.ipRating || "—", verdict: "MEETS" as Verdict, note: "" },
          { spec: "Operating Temperature", customerNeed: state.extractedSpecs?.tempRange || "—", ourValue: state.productDetails?.tempRange || "—", verdict: "APP-SAFE" as Verdict, note: "" },
          { spec: "Output / Configuration", customerNeed: state.extractedSpecs?.outputType || "—", ourValue: state.productDetails?.output || "—", verdict: "MEETS" as Verdict, note: "" },
          { spec: "Voltage", customerNeed: state.extractedSpecs?.supplyVoltage || "—", ourValue: state.productDetails?.voltage || "—", verdict: "COMPATIBLE" as Verdict, note: "" },
          { spec: "Unit Price", customerNeed: state.extractedSpecs?.targetPrice || `Rs.${targetPrice}`, ourValue: `Rs.${ourPrice}`, verdict: saving >= 0 ? "EXCEEDS" as Verdict : "GAP" as Verdict, note: saving > 0 ? `Saves Rs.${(targetPrice - ourPrice).toFixed(0)}/unit` : "" },
          { spec: "Warranty", customerNeed: "Standard", ourValue: state.productDetails?.warranty || "12 months", verdict: "MEETS" as Verdict, note: "" },
        ],
        totalSaving: saving > 0 ? saving : 0,
        overallScore: 87,
      };
      dispatch({ type: "SET_COMPARISON", comparison: mockComparison });
      toast.success("Comparison built (demo mode)");
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!state.comparison) {
      buildComparison();
    }
  }, []);

  const comparison = state.comparison;
  const meetsCount = comparison?.rows.filter((r) => ["MEETS", "EXCEEDS", "COMPATIBLE"].includes(r.verdict)).length || 0;
  const totalRows = comparison?.rows.length || 1;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <GitCompareArrows className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Building Spec Comparison</h3>
              <p className="text-xs text-slate-400">Comparing specifications like Mouser...</p>
            </div>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div initial={{ width: "0%" }} animate={{ width: `${progress}%` }}
              className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full" />
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center">{progress}%</p>
        </div>
      )}

      {/* Mouser-style Comparison */}
      {!loading && comparison && (
        <>
          {/* ── Summary Cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Match Score</p>
              <p className="text-4xl font-extrabold">{comparison.overallScore}%</p>
              <p className="text-xs text-slate-400 mt-1">{meetsCount}/{totalRows} specs pass</p>
            </motion.div>
            {comparison.totalSaving > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-5 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-emerald-200" />
                  <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider">Total Saving</p>
                </div>
                <p className="text-4xl font-extrabold">Rs.{comparison.totalSaving.toLocaleString()}</p>
                <p className="text-xs text-emerald-200 mt-1">vs customer budget</p>
              </motion.div>
            )}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white">
              <p className="text-[10px] font-bold text-blue-200 uppercase tracking-wider mb-1">Our Product</p>
              <p className="text-lg font-extrabold">{state.productDetails?.company} {state.productDetails?.model}</p>
              <p className="text-xs text-blue-200 mt-1">vs {state.extractedSpecs?.referenceProduct || "customer requirement"}</p>
            </motion.div>
          </div>

          {/* ── Mouser-style Spec Comparison Table ── */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {/* Table Header — 3 columns like Mouser */}
            <div className="grid grid-cols-[220px_1fr_1fr_120px] bg-slate-900 text-white">
              <div className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider border-r border-slate-700">
                Specification
              </div>
              <div className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider border-r border-slate-700">
                <span className="text-amber-300">Customer Requirement</span>
              </div>
              <div className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider border-r border-slate-700">
                <span className="text-emerald-300">Company A Offering</span>
              </div>
              <div className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-center">
                Status
              </div>
            </div>

            {/* Table Body */}
            {comparison.rows.map((row, i) => {
              const config = verdictConfig[row.verdict] || verdictConfig.MEETS;
              const Icon = config.icon;
              const isEven = i % 2 === 0;

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`grid grid-cols-[220px_1fr_1fr_120px] border-b border-slate-100 ${isEven ? "bg-white" : "bg-slate-50/50"} hover:bg-blue-50/30 transition-colors`}
                >
                  {/* Spec name */}
                  <div className="px-5 py-4 border-r border-slate-100">
                    <span className="text-xs font-bold text-slate-700">{row.spec}</span>
                  </div>

                  {/* Customer need */}
                  <div className="px-5 py-4 border-r border-slate-100">
                    <span className="text-sm text-slate-600">{row.customerNeed || "—"}</span>
                  </div>

                  {/* Our value */}
                  <div className="px-5 py-4 border-r border-slate-100">
                    <span className="text-sm font-semibold text-slate-800">{row.ourValue || "—"}</span>
                    {row.note && (
                      <p className="text-[10px] text-emerald-600 mt-0.5">{row.note}</p>
                    )}
                  </div>

                  {/* Verdict badge */}
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

          {/* ── Verdict Summary Bar ── */}
          <div className="flex items-center gap-3 flex-wrap">
            {["MEETS", "EXCEEDS", "COMPATIBLE", "CLOSE", "APP-SAFE", "GAP"].map((v) => {
              const count = comparison.rows.filter((r) => r.verdict === v).length;
              if (count === 0) return null;
              const c = verdictConfig[v];
              const Icon = c.icon;
              return (
                <div key={v} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${c.bg} ${c.text} ${c.border}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {c.label}: {count}
                </div>
              );
            })}
          </div>

          {/* ── Cost Saving Callout ── */}
          {comparison.totalSaving > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}
              className="bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <TrendingDown className="w-6 h-6 text-emerald-600" />
                <div>
                  <p className="text-sm font-bold text-emerald-800">
                    Rs.{(state.productDetails?.price ? (parseFloat(state.extractedSpecs?.targetPrice?.replace(/[^0-9.]/g, "") || "850") - state.productDetails.price) : 70).toFixed(0)}/unit x {state.extractedSpecs?.quantity || "qty"} ={" "}
                    <span className="text-xl">Rs.{comparison.totalSaving.toLocaleString()} total saving</span>
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">vs customer&apos;s budget target</p>
                </div>
              </div>
            </motion.div>
          )}

          <button onClick={() => dispatch({ type: "SET_STEP", step: 5 })}
            className="flex items-center gap-3 px-8 py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold text-sm hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg shadow-purple-500/25">
            Prepare Email Response
            <ArrowRight className="w-4 h-4" />
          </button>
        </>
      )}
    </motion.div>
  );
}
