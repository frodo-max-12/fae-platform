"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ScanSearch, Sparkles, ArrowRight, Loader2, User, Building2,
  Package, Cpu, Shield, Thermometer, Zap, Hash, Banknote, Clock,
  Wrench, FileText, ChevronDown, ChevronUp, Edit3, Check, AlertCircle
} from "lucide-react";
import { useWizard } from "@/lib/store";
import type { ExtractionResult, RequirementItem, ExtractedSpecs } from "@/types";
import toast from "react-hot-toast";
import { persistProgress } from "@/lib/persistProgress";

const requirementFields: { key: keyof RequirementItem; label: string; icon: typeof Package }[] = [
  { key: "type", label: "Product Type", icon: Package },
  { key: "sensingDistance", label: "Sensing Distance", icon: Cpu },
  { key: "ipRating", label: "IP Protection", icon: Shield },
  { key: "tempRange", label: "Temperature Range", icon: Thermometer },
  { key: "outputType", label: "Output Type", icon: Zap },
  { key: "supplyVoltage", label: "Supply Voltage", icon: Zap },
  { key: "quantity", label: "Quantity", icon: Hash },
  { key: "targetPrice", label: "Target Price", icon: Banknote },
  { key: "deliveryTimeline", label: "Delivery Timeline", icon: Clock },
  { key: "applicationContext", label: "Application", icon: Wrench },
  { key: "additionalNotes", label: "Additional Notes", icon: FileText },
];

export default function Step2Extract() {
  const { state, dispatch } = useWizard();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [fileUploads, setFileUploads] = useState<Array<{ filename: string; mimeType: string; base64Data: string }>>([]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    const next: typeof fileUploads = [];
    for (const file of Array.from(files)) {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      next.push({ filename: file.name, mimeType: file.type || "application/octet-stream", base64Data: btoa(binary) });
    }
    setFileUploads((prev) => [...prev, ...next]);
    toast.success(`${next.length} file(s) attached for extraction`);
  };

  const extractSpecs = async () => {
    setLoading(true);
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 6, 90));
    }, 300);

    try {
      const emailBody = state.selectedEmail?.body || state.manualInput;

      // Download Gmail attachments (if any) so PDF/XLSX/CSV are parsed server-side
      const attachments: Array<{ filename: string; mimeType: string; base64Data: string }> = [];
      const gmailAttachments = state.selectedEmail?.attachments || [];
      const msgId = state.selectedEmail?.id;
      if (msgId && gmailAttachments.length > 0 && !msgId.startsWith("manual-")) {
        for (const att of gmailAttachments) {
          try {
            const ar = await fetch("/api/gmail/attachment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ messageId: msgId, attachmentId: att.attachmentId }),
            });
            if (ar.ok) {
              const { base64Data } = await ar.json();
              if (base64Data) attachments.push({ filename: att.filename, mimeType: att.mimeType, base64Data });
            }
          } catch (e) {
            console.warn(`[extract] failed to fetch attachment ${att.filename}:`, e);
          }
        }
      }

      // Manually uploaded files from the UI (see fileUploads state)
      for (const f of fileUploads) attachments.push(f);

      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailBody, attachments }),
      });

      if (!res.ok) throw new Error("Extraction failed");

      const data = await res.json();
      const extraction = data.extraction as ExtractionResult;
      dispatch({ type: "SET_EXTRACTION", extraction });

      // Also set legacy extractedSpecs from first requirement for downstream compatibility
      if (extraction.requirements.length > 0) {
        const first = extraction.requirements[0];
        dispatch({
          type: "SET_EXTRACTED_SPECS",
          specs: {
            type: first.type,
            sensingDistance: first.sensingDistance,
            ipRating: first.ipRating,
            tempRange: first.tempRange,
            outputType: first.outputType,
            supplyVoltage: first.supplyVoltage,
            quantity: first.quantity,
            targetPrice: first.targetPrice,
            deliveryTimeline: first.deliveryTimeline,
            referenceProduct: first.referenceMPN,
            customerName: extraction.customerName,
            customerCompany: extraction.customerCompany,
            applicationContext: first.applicationContext,
          },
        });
      }

      // Expand all cards by default
      setExpandedCards(new Set(extraction.requirements.map((r) => r.id)));
      toast.success(`${extraction.requirements.length} requirement(s) extracted!`);

      // Persist progress → status "extracted"
      persistProgress({
        id: state.requestId || undefined,
        status: "extracted",
        extractedSpecs: extraction,
        customerName: extraction.customerName,
        customerEmail: extraction.customerEmail,
        customerCompany: extraction.customerCompany,
      }).then((id) => {
        if (id && !state.requestId) dispatch({ type: "SET_REQUEST_ID", requestId: id });
      });
    } catch {
      // Mock extraction with multiple MPNs
      const mockExtraction: ExtractionResult = {
        customerName: state.selectedEmail?.from.split("@")[0].replace(/\./g, " ") || "Customer",
        customerCompany: state.selectedEmail?.from.split("@")[1]?.split(".")[0] || "Company",
        customerEmail: state.selectedEmail?.from || "",
        summary: "Customer requires inductive proximity sensors for automated packaging line installation at local facility. Looking for compatible alternative to SICK IM08-08BPS-ZC1.",
        requirements: [
          {
            id: "req-1",
            referenceMPN: "SICK IM08-08BPS-ZC1",
            referenceCompany: "SICK",
            type: "Inductive proximity sensor",
            sensingDistance: "minimum 10 mm",
            ipRating: "IP67 or higher",
            tempRange: "-20C to +85C",
            outputType: "PNP, NO",
            supplyVoltage: "10-30 VDC",
            quantity: "500 units",
            targetPrice: "under Rs.850 per unit",
            deliveryTimeline: "within 4 weeks",
            applicationContext: "Automated packaging line, local facility — dusty and wet environment",
            additionalNotes: "Need full technical comparison. Compatible or better alternative required.",
          },
        ],
      };

      dispatch({ type: "SET_EXTRACTION", extraction: mockExtraction });
      dispatch({
        type: "SET_EXTRACTED_SPECS",
        specs: {
          type: mockExtraction.requirements[0].type,
          sensingDistance: mockExtraction.requirements[0].sensingDistance,
          ipRating: mockExtraction.requirements[0].ipRating,
          tempRange: mockExtraction.requirements[0].tempRange,
          outputType: mockExtraction.requirements[0].outputType,
          supplyVoltage: mockExtraction.requirements[0].supplyVoltage,
          quantity: mockExtraction.requirements[0].quantity,
          targetPrice: mockExtraction.requirements[0].targetPrice,
          deliveryTimeline: mockExtraction.requirements[0].deliveryTimeline,
          referenceProduct: mockExtraction.requirements[0].referenceMPN,
          customerName: mockExtraction.customerName,
          customerCompany: mockExtraction.customerCompany,
          applicationContext: mockExtraction.requirements[0].applicationContext,
        },
      });
      setExpandedCards(new Set(["req-1"]));
      toast.success("Requirements extracted (demo mode)!");
    }

    clearInterval(interval);
    setProgress(100);
    setLoading(false);
  };

  useEffect(() => {
    if (state.extraction) {
      setExpandedCards(new Set(state.extraction.requirements.map((r) => r.id)));
    }
  }, []);

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const extraction = state.extraction;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Not yet extracted — show extract button + attachment uploader */}
      {!loading && !extraction && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-blue-200 p-12 flex flex-col items-center">
          <ScanSearch className="w-16 h-16 text-blue-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-600 mb-2">Ready to Analyse</h3>
          <p className="text-sm text-slate-400 mb-6 text-center max-w-md">
            We&apos;ll read the email body, any Gmail attachments (PDF / Excel / CSV), and files you upload below — then extract every requirement with 100% fidelity.
          </p>

          {/* Attachment summary */}
          {(state.selectedEmail?.attachments?.length || 0) > 0 && (
            <div className="w-full max-w-md mb-4 bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-xs font-bold text-blue-700 mb-1">Gmail attachments detected ({state.selectedEmail?.attachments?.length}):</p>
              <ul className="text-xs text-blue-600">
                {state.selectedEmail?.attachments?.map((a) => (
                  <li key={a.attachmentId}>• {a.filename} <span className="text-blue-400">({Math.round(a.size / 1024)} KB)</span></li>
                ))}
              </ul>
            </div>
          )}

          {/* Manual file upload */}
          <label className="w-full max-w-md mb-4 flex flex-col items-center px-4 py-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-100">
            <FileText className="w-5 h-5 text-slate-400 mb-1" />
            <span className="text-xs font-semibold text-slate-600">Attach PDF, Excel, or CSV files</span>
            <span className="text-[10px] text-slate-400">(datasheets, BOMs, RFQ sheets)</span>
            <input
              type="file"
              multiple
              accept=".pdf,.xlsx,.xls,.xlsm,.csv,.txt,.md"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
          </label>

          {fileUploads.length > 0 && (
            <div className="w-full max-w-md mb-4 text-xs text-slate-600">
              <p className="font-bold mb-1">Uploaded files:</p>
              <ul>
                {fileUploads.map((f, i) => (
                  <li key={i} className="flex items-center justify-between py-0.5">
                    <span>• {f.filename}</span>
                    <button onClick={() => setFileUploads((prev) => prev.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700">remove</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button onClick={extractSpecs}
            className="flex items-center gap-3 px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold text-sm hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25">
            <Sparkles className="w-5 h-5" />
            Extract Requirements
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && !extraction && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center">
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
              <ScanSearch className="w-10 h-10 text-blue-600" />
            </div>
            <motion.div
              className="absolute inset-0 rounded-full border-4 border-blue-400 border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Deep Analysis in Progress</h3>
          <p className="text-sm text-slate-400 mb-1">Reading customer email and extracting every product requirement...</p>
          <p className="text-xs text-slate-300 mb-4">Detecting all MPNs, specifications, and commercial requirements</p>
          <div className="w-72 h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
            />
          </div>
          <p className="text-xs text-slate-400 mt-2">{progress}% complete</p>
        </div>
      )}

      {/* Extraction Results */}
      {extraction && (
        <>
          {/* ── Customer Info Header ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-xl font-bold">
                  {extraction.customerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-extrabold">{extraction.customerName}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Building2 className="w-3 h-3" />
                      {extraction.customerCompany}
                    </span>
                    {extraction.customerEmail && (
                      <span className="flex items-center gap-1.5 text-xs text-slate-400">
                        <User className="w-3 h-3" />
                        {extraction.customerEmail}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 bg-blue-500/20 border border-blue-400/30 rounded-lg text-xs font-bold text-blue-300">
                  {extraction.requirements.length} MPN{extraction.requirements.length > 1 ? "s" : ""} detected
                </span>
                <span className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-400/30 rounded-lg text-xs font-bold text-emerald-300">
                  Analysed
                </span>
              </div>
            </div>

            {/* Summary */}
            <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Request Summary</p>
              <p className="text-sm text-slate-300 leading-relaxed">{extraction.summary}</p>
            </div>
          </motion.div>

          {/* ── Requirement Cards (one per MPN) ── */}
          <div className="space-y-4">
            {extraction.requirements.map((req, index) => {
              const isExpanded = expandedCards.has(req.id);
              const filledSpecs = requirementFields.filter((f) => req[f.key] && req[f.key] !== "");

              return (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden hover:border-blue-200 transition-colors"
                >
                  {/* Card Header */}
                  <button
                    onClick={() => toggleCard(req.id)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                        #{index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-extrabold text-slate-800">{req.referenceMPN}</h3>
                          {req.referenceCompany && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold uppercase">
                              {req.referenceCompany}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{req.type} — {req.quantity || "Qty not specified"}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-400">
                        {filledSpecs.length} specs
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      className="border-t border-slate-100"
                    >
                      {/* Reference Product Highlight */}
                      <div className="mx-5 mt-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                          <span className="text-xs font-bold text-amber-800 uppercase">Reference Product</span>
                        </div>
                        <p className="text-sm font-bold text-amber-900">
                          {req.referenceCompany} {req.referenceMPN}
                        </p>
                        <p className="text-xs text-amber-700 mt-1">
                          Customer is looking for compatible or better alternative to this product
                        </p>
                      </div>

                      {/* Specification Grid */}
                      <div className="p-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {requirementFields.map((field) => {
                            const value = req[field.key];
                            if (!value || field.key === "id" || field.key === "referenceMPN" || field.key === "referenceCompany") return null;
                            const Icon = field.icon;
                            return (
                              <div
                                key={field.key}
                                className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100"
                              >
                                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                                  <Icon className="w-4 h-4 text-blue-500" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    {field.label}
                                  </p>
                                  <p className="text-sm font-semibold text-slate-800 mt-0.5 break-words">
                                    {value}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* ── Action Buttons ── */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={extractSpecs}
              className="flex items-center gap-2 px-5 py-3 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-all"
            >
              <ScanSearch className="w-4 h-4" />
              Re-analyse
            </button>
            <button
              onClick={() => dispatch({ type: "SET_STEP", step: 3 })}
              className="flex-1 flex items-center justify-center gap-3 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold text-sm hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-500/25"
            >
              <Package className="w-4 h-4" />
              Find Matching Products
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}
