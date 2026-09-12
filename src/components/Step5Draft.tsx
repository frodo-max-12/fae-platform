"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FileEdit, Sparkles, RefreshCw, ArrowRight, Copy, Check,
  Building2, User, Mail, Phone, Globe, Award, TrendingDown,
  Package, Clock, Shield, ChevronRight, Pencil, Eye,
  CheckCircle2, AlertTriangle, XCircle
} from "lucide-react";
import { useWizard } from "@/lib/store";
import { VERDICT_COLORS } from "@/lib/constants";
import type { Verdict } from "@/types";
import toast from "react-hot-toast";
import { persistProgress } from "@/lib/persistProgress";

const verdictIcons: Record<string, typeof CheckCircle2> = {
  MEETS: CheckCircle2,
  EXCEEDS: CheckCircle2,
  COMPATIBLE: CheckCircle2,
  GAP: XCircle,
  CLOSE: AlertTriangle,
  "APP-SAFE": AlertTriangle,
};

export default function Step5Draft() {
  const { state, dispatch } = useWizard();
  const [loading, setLoading] = useState(false);
  const [editableBody, setEditableBody] = useState(state.emailDraft?.body || "");
  const [editableSubject, setEditableSubject] = useState(state.emailDraft?.subject || "");
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");

  const product = state.productDetails;
  const specs = state.extractedSpecs;
  const comparison = state.comparison;
  const saving = comparison?.totalSaving || 0;
  const customerName = specs?.customerName || "Customer";

  const generateDraft = async () => {
    setLoading(true);

    await new Promise((r) => setTimeout(r, 3000));

    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comparison: state.comparison,
          product: state.productDetails,
          advantages: state.productDetails?.advantages,
          customerSpecs: state.extractedSpecs,
        }),
      });

      if (!res.ok) throw new Error("Draft generation failed");
      const data = await res.json();
      setEditableSubject(data.emailDraft.subject);
      setEditableBody(data.emailDraft.body);
      dispatch({ type: "SET_EMAIL_DRAFT", draft: data.emailDraft });
    } catch {
      const subject = `Technical Comparison & Proposal — ${product?.company} ${product?.model} vs ${specs?.referenceProduct || "Reference"} | ${specs?.customerCompany || ""}`;

      const body = `Dear ${customerName.includes(" ") ? `Ms./Mr. ${customerName.split(" ").pop()}` : customerName},

Thank you for sharing your detailed ${specs?.type?.toLowerCase() || "sensor"} requirement for your ${specs?.applicationContext || "facility"}. We appreciate the opportunity to support your project.

After a thorough technical evaluation, we are pleased to present the ${product?.company} ${product?.model} (${product?.series}) as a fully compatible and technically superior alternative to the ${specs?.referenceProduct || "reference product"}.

TECHNICAL COMPARISON — ${product?.company} ${product?.model} vs ${specs?.referenceProduct || "Reference"}

  Specification       | Your Requirement         | Our Offering (${product?.company} ${product?.model})
  ─────────────────── | ──────────────────────── | ────────────────────────────────────
  Sensing Distance    | ${specs?.sensingDistance || "N/A"}                   | ${product?.sensing || "N/A"}
  IP Protection       | ${specs?.ipRating || "N/A"}                        | ${product?.ipRating || "N/A"}
  Temperature Range   | ${specs?.tempRange || "N/A"}              | ${product?.tempRange || "N/A"}
  Output Type         | ${specs?.outputType || "N/A"}                     | ${product?.output || "N/A"}
  Supply Voltage      | ${specs?.supplyVoltage || "N/A"}                  | ${product?.voltage || "N/A"}
  Unit Price          | ${specs?.targetPrice || "N/A"}                | Rs.${product?.price || "N/A"}
  Warranty            | Standard                 | ${product?.warranty || "N/A"}

WHY ${(product?.company || "OUR PRODUCT").toUpperCase()} ${(product?.model || "").toUpperCase()} IS THE RIGHT CHOICE

  1. Cost Advantage — Rs.${saving.toLocaleString()} total saving across ${specs?.quantity || "your order"} units
  2. ${product?.advantages || "Competitive specifications meeting all critical requirements"}

COMMERCIAL PROPOSAL

  Product     :  ${product?.company} ${product?.model} (${product?.series})
  Quantity    :  ${specs?.quantity || "As requested"} units
  Unit Price  :  Rs.${product?.price || "N/A"} per unit
  Total Value :  Rs.${((product?.price || 0) * parseInt(specs?.quantity || "0")).toLocaleString() || "On request"}
  Total Saving:  Rs.${saving.toLocaleString()} vs budget
  Warranty    :  ${product?.warranty || "Standard"} with local RMA handling
  MOQ         :  ${product?.moq || "N/A"} units

NEXT STEPS

We would be happy to arrange 5 sample units for hands-on evaluation at no additional cost. This will allow your engineering team to validate compatibility before proceeding with the full order.

Shall I go ahead and dispatch the evaluation samples?

Looking forward to your response. Please do not hesitate to reach out if you need any additional technical details or documentation.

Warm regards,
[Your Name]
Field Application Engineer
[Your Company Name]
[Phone] | [Email]`;

      setEditableSubject(subject);
      setEditableBody(body);
      dispatch({
        type: "SET_EMAIL_DRAFT",
        draft: {
          subject,
          body,
          to: state.selectedEmail?.from || "",
          cc: "",
        },
      });
      toast.success("Email draft generated (demo mode)");
    }

    setLoading(false);
  };

  useEffect(() => {
    if (state.emailDraft?.body) {
      // Draft already generated in Step 4 (combined call) — use it directly
      setEditableSubject(state.emailDraft.subject);
      setEditableBody(state.emailDraft.body);
    } else {
      generateDraft();
    }
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(`Subject: ${editableSubject}\n\n${editableBody}`);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApprove = () => {
    const draft = {
      subject: editableSubject,
      body: editableBody,
      to: state.selectedEmail?.from || "",
      cc: "",
    };
    dispatch({ type: "SET_EMAIL_DRAFT", draft });
    persistProgress({
      id: state.requestId || undefined,
      status: "draft",
      emailDraft: draft,
    });
    dispatch({ type: "SET_STEP", step: 5 });
  };

  const meetsCount = comparison?.rows.filter((r) => ["MEETS", "EXCEEDS", "COMPATIBLE"].includes(r.verdict)).length || 0;
  const totalRows = comparison?.rows.length || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center">
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
              <FileEdit className="w-10 h-10 text-purple-600" />
            </div>
            <motion.div
              className="absolute inset-0 rounded-full border-4 border-purple-400 border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Composing Professional Email</h3>
          <p className="text-sm text-slate-400 mb-1">Crafting a detailed technical comparison with formatted tables...</p>
          <p className="text-xs text-slate-300">This will only take a moment</p>
          <div className="flex gap-1.5 mt-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                className="w-2.5 h-2.5 rounded-full bg-purple-500"
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Email Draft */}
      {!loading && editableBody && (
        <>
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Email Draft Ready</h3>
                <p className="text-xs text-slate-400">Review the professional email below</p>
              </div>
            </div>
            <div className="flex gap-2">
              {/* View Toggle */}
              <div className="bg-slate-100 rounded-lg p-0.5 flex">
                <button
                  onClick={() => setViewMode("preview")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    viewMode === "preview"
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Preview
                </button>
                <button
                  onClick={() => setViewMode("edit")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    viewMode === "edit"
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={generateDraft}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 rounded-lg text-xs font-semibold text-purple-700 hover:bg-purple-200 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerate
              </button>
            </div>
          </div>

          {viewMode === "edit" ? (
            /* ──── RAW TEXT EDITOR ──── */
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-3 border-b border-slate-100 bg-slate-50">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subject</label>
                <input
                  type="text"
                  value={editableSubject}
                  onChange={(e) => setEditableSubject(e.target.value)}
                  className="w-full mt-1 text-sm font-semibold text-slate-800 bg-transparent outline-none"
                />
              </div>
              <div className="p-6">
                <textarea
                  value={editableBody}
                  onChange={(e) => setEditableBody(e.target.value)}
                  className="w-full min-h-[600px] p-4 bg-slate-50 rounded-xl border border-slate-200 email-body text-slate-700 resize-y focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none transition-all"
                />
              </div>
            </div>
          ) : (
            /* ──── RICH VISUAL PREVIEW ──── */
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xl shadow-slate-200/50">

              {/* Email Header Banner */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-8 py-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-white font-bold text-base">[Your Company Name]</h2>
                      <p className="text-slate-400 text-xs">Field Application Engineering</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-4 text-slate-400 text-xs">
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> [Phone]</span>
                      <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> [Website]</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subject Line */}
              <div className="px-8 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-500" />
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Subject</span>
                </div>
                <p className="text-sm font-bold text-slate-800 mt-1">{editableSubject}</p>
              </div>

              {/* Recipients Bar */}
              <div className="px-8 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-6 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <User className="w-3 h-3" />
                  <span className="font-semibold text-slate-600">To:</span> {state.selectedEmail?.from || specs?.customerName || "customer@company.com"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>

              {/* Email Body */}
              <div className="px-8 py-8 space-y-8">

                {/* Greeting */}
                <div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    Dear {customerName.includes(" ") ? `Ms./Mr. ${customerName.split(" ").pop()}` : customerName},
                  </p>
                  <p className="text-sm text-slate-600 leading-relaxed mt-3">
                    Thank you for sharing your detailed <span className="font-semibold text-slate-700">{specs?.type?.toLowerCase() || "sensor"}</span> requirement
                    for your {specs?.applicationContext || "facility"}. We appreciate the opportunity to support your project.
                  </p>
                  <p className="text-sm text-slate-600 leading-relaxed mt-3">
                    After a thorough technical evaluation, we are pleased to present the{" "}
                    <span className="font-bold text-blue-700">{product?.company} {product?.model}</span>{" "}
                    ({product?.series}) as a fully compatible and technically superior alternative to
                    the {specs?.referenceProduct || "reference product"}.
                  </p>
                </div>

                {/* ── TECHNICAL COMPARISON TABLE ── */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-blue-600 rounded-full" />
                    <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">
                      Technical Comparison
                    </h3>
                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      {product?.company} {product?.model} vs {specs?.referenceProduct || "Reference"}
                    </span>
                  </div>

                  <div className="rounded-xl overflow-hidden border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-800 text-white">
                          <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider">Specification</th>
                          <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider">Your Requirement</th>
                          <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider">Our Offering</th>
                          <th className="px-5 py-3 text-center text-[11px] font-bold uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparison?.rows.map((row, i) => {
                          const colors = VERDICT_COLORS[row.verdict] || VERDICT_COLORS.MEETS;
                          const VIcon = verdictIcons[row.verdict] || CheckCircle2;
                          return (
                            <tr
                              key={i}
                              className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}
                            >
                              <td className="px-5 py-3.5">
                                <span className="font-semibold text-slate-700">{row.spec}</span>
                              </td>
                              <td className="px-5 py-3.5 text-slate-600">{row.customerNeed}</td>
                              <td className="px-5 py-3.5">
                                <span className="font-semibold text-slate-800">{row.ourValue}</span>
                              </td>
                              <td className="px-5 py-3.5 text-center">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${colors.bg} ${colors.text}`}>
                                  <VIcon className="w-3 h-3" />
                                  {row.verdict}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Table Footer — Score */}
                    <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-xs text-slate-500">
                        {meetsCount} of {totalRows} specifications meet or exceed requirements
                      </span>
                      <span className="text-sm font-extrabold text-blue-700">
                        {comparison?.overallScore || 0}% Overall Match
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── WHY THIS PRODUCT ── */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                    <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">
                      Why {product?.company} {product?.model} Is the Right Choice
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                        <TrendingDown className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-emerald-800">Cost Advantage</p>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          Rs.{saving.toLocaleString()} total saving across {specs?.quantity || "your order"} units
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                        <Award className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-blue-800">Key Strengths</p>
                        <p className="text-xs text-blue-700 mt-0.5">
                          {product?.advantages?.split(".")[0] || "Competitive specifications"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── COMMERCIAL PROPOSAL ── */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-amber-500 rounded-full" />
                    <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">
                      Commercial Proposal
                    </h3>
                  </div>

                  <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl p-6 text-white">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Product</p>
                        <p className="text-sm font-bold">{product?.company} {product?.model}</p>
                        <p className="text-xs text-slate-400">{product?.series}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Quantity</p>
                        <p className="text-sm font-bold">{specs?.quantity || "As requested"} units</p>
                        <p className="text-xs text-slate-400">MOQ: {product?.moq || "N/A"} units</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Unit Price</p>
                        <p className="text-sm font-bold text-emerald-400">Rs.{product?.price || "N/A"}</p>
                        <p className="text-xs text-slate-400">per unit</p>
                      </div>
                    </div>

                    <div className="border-t border-slate-700 pt-4 flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Value</p>
                          <p className="text-lg font-extrabold">
                            Rs.{((product?.price || 0) * parseInt(specs?.quantity || "0")).toLocaleString() || "On request"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Warranty</p>
                          <p className="text-sm font-bold flex items-center gap-1">
                            <Shield className="w-3.5 h-3.5 text-emerald-400" />
                            {product?.warranty || "Standard"}
                          </p>
                        </div>
                      </div>
                      {saving > 0 && (
                        <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-lg px-4 py-2 text-right">
                          <p className="text-[10px] font-bold text-emerald-300 uppercase">You Save</p>
                          <p className="text-xl font-extrabold text-emerald-400">Rs.{saving.toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── NEXT STEPS ── */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <ChevronRight className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-bold text-blue-800">Next Steps</h3>
                  </div>
                  <p className="text-sm text-blue-700 leading-relaxed">
                    We would be happy to arrange <span className="font-bold">5 sample units</span> for hands-on evaluation
                    at no additional cost. This will allow your engineering team to validate compatibility
                    before proceeding with the full order.
                  </p>
                  <p className="text-sm text-blue-600 mt-2 font-medium">
                    Shall I go ahead and dispatch the evaluation samples?
                  </p>
                </div>

                {/* Sign-off */}
                <div className="border-t border-slate-200 pt-6">
                  <p className="text-sm text-slate-600">Looking forward to your response.</p>
                  <div className="mt-4">
                    <p className="text-sm font-bold text-slate-800">Warm regards,</p>
                    <p className="text-sm font-bold text-slate-700 mt-1">[Your Name]</p>
                    <p className="text-xs text-slate-500">Field Application Engineer</p>
                    <p className="text-xs text-slate-500">[Your Company Name]</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" />[Phone]</span>
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" />[Email]</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer watermark */}
              <div className="bg-slate-50 px-8 py-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-[11px] text-slate-400">Generated by FAE Intelligence Platform</span>
                </div>
                <span className="text-[11px] text-slate-400">
                  {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={generateDraft}
              className="flex items-center gap-2 px-5 py-3 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Regenerate Draft
            </button>
            <button
              onClick={handleApprove}
              className="flex items-center gap-3 px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold text-sm hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/25"
            >
              <Check className="w-5 h-5" />
              Approve & Send
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}
