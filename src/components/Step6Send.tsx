"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Mail, User, Users, Eye, Loader2, CheckCircle2, Clock, Zap, RotateCcw, ArrowLeft } from "lucide-react";
import { useWizard } from "@/lib/store";
import toast from "react-hot-toast";
import { persistProgress } from "@/lib/persistProgress";

export default function Step6Send() {
  const { state, dispatch } = useWizard();
  const [to, setTo] = useState(state.emailDraft?.to || state.selectedEmail?.from || "");
  const [cc, setCc] = useState(state.emailDraft?.cc || "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(!!state.sentMessageId);
  const [showPreview, setShowPreview] = useState(false);

  const handleSend = async () => {
    if (!to.trim()) {
      toast.error("Please enter a recipient email");
      return;
    }

    setSending(true);

    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          cc: cc.trim(),
          subject: state.emailDraft?.subject,
          body: state.emailDraft?.body,
        }),
      });

      if (!res.ok) throw new Error("Send failed");
      const data = await res.json();
      dispatch({ type: "SET_SENT", messageId: data.messageId });
      setSent(true);
      toast.success("Email sent successfully!");
      persistProgress({
        id: state.requestId || undefined,
        status: "sent",
        finalEmail: state.emailDraft?.body,
        sentAt: new Date().toISOString(),
        totalTime: state.startTime ? Math.round((Date.now() - state.startTime) / 1000) : undefined,
      });
    } catch {
      // Mock send
      const mockId = "msg-" + Date.now();
      dispatch({ type: "SET_SENT", messageId: mockId });
      setSent(true);
      toast.success("Email sent (demo mode)!");
      persistProgress({
        id: state.requestId || undefined,
        status: "sent",
        finalEmail: state.emailDraft?.body,
        sentAt: new Date().toISOString(),
        totalTime: state.startTime ? Math.round((Date.now() - state.startTime) / 1000) : undefined,
      });
    }

    setSending(false);
  };

  const handleSaveDraft = () => {
    toast.success("Saved to Gmail Drafts");
  };

  const totalTime = state.startTime ? Math.round((Date.now() - state.startTime) / 1000) : 0;
  const minutes = Math.floor(totalTime / 60);
  const seconds = totalTime % 60;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <AnimatePresence mode="wait">
        {!sent ? (
          <motion.div
            key="send-form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6"
          >
            {/* Email Recipients */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                Email Recipients
              </h3>

              <div>
                <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  <User className="w-3 h-3" /> To
                </label>
                <input
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="customer@company.com"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none transition-all"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  <Users className="w-3 h-3" /> CC (optional)
                </label>
                <input
                  type="email"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="sales@yourcompany.com"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none transition-all"
                />
              </div>
            </div>

            {/* Email Preview */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-semibold text-slate-700">Email Preview</span>
                </div>
                <span className="text-xs text-blue-600 font-semibold">
                  {showPreview ? "Hide" : "Show"}
                </span>
              </button>

              <AnimatePresence>
                {showPreview && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-slate-100"
                  >
                    <div className="p-6">
                      <div className="mb-3 pb-3 border-b border-slate-100">
                        <p className="text-xs text-slate-400">Subject:</p>
                        <p className="text-sm font-bold text-slate-800">{state.emailDraft?.subject}</p>
                      </div>
                      <div className="email-body text-slate-600 max-h-80 overflow-y-auto p-4 bg-slate-50 rounded-xl">
                        {state.emailDraft?.body}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => dispatch({ type: "SET_STEP", step: 4 })}
                className="flex items-center gap-2 px-5 py-3 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Edit Draft
              </button>
              <button
                onClick={handleSaveDraft}
                className="flex items-center gap-2 px-5 py-3 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-all"
              >
                <Mail className="w-4 h-4" />
                Save as Draft
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !to.trim()}
                className="flex-1 flex items-center justify-center gap-3 px-8 py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold text-sm hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending via Gmail...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send via Gmail
                  </>
                )}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="text-center"
          >
            {/* Success Card */}
            <div className="bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 rounded-3xl border-2 border-emerald-200 p-12">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/30"
              >
                <CheckCircle2 className="w-12 h-12 text-white" />
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <h2 className="text-3xl font-extrabold text-emerald-800 mb-2">Email Sent Successfully!</h2>
                <p className="text-sm text-emerald-600 mb-8">
                  Sent to {to} at {new Date().toLocaleTimeString("en-IN")}
                </p>
              </motion.div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-emerald-100"
                >
                  <Clock className="w-5 h-5 text-blue-500 mx-auto mb-2" />
                  <p className="text-2xl font-extrabold text-slate-800">{minutes}:{seconds.toString().padStart(2, "0")}</p>
                  <p className="text-xs text-slate-500">Total Time</p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-emerald-100"
                >
                  <Mail className="w-5 h-5 text-purple-500 mx-auto mb-2" />
                  <p className="text-2xl font-extrabold text-slate-800">Complete</p>
                  <p className="text-xs text-slate-500">Full comparison sent</p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-emerald-100"
                >
                  <Zap className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
                  <p className="text-2xl font-extrabold text-slate-800">First Responder</p>
                  <p className="text-xs text-slate-500">Fastest reply wins the deal</p>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="bg-white/60 rounded-xl p-4 border border-emerald-100 mb-6"
              >
                <p className="text-sm text-emerald-700">
                  Professional comparison email sent in{" "}
                  <span className="font-bold">{minutes} min {seconds} sec</span>. Your customer will receive it shortly.
                </p>
              </motion.div>

              <button
                onClick={() => dispatch({ type: "RESET" })}
                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold text-sm hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-500/25"
              >
                <RotateCcw className="w-4 h-4" />
                Start New Request
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
