"use client";

import {
  HelpCircle, Mail, Package, ScanSearch, GitCompareArrows, FileEdit, Send,
  BookOpen, Sparkles, ArrowRight, ChevronDown, ChevronUp
} from "lucide-react";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";

const steps = [
  { icon: Mail, title: "1. Customer Email Intake", color: "blue",
    description: "Load customer inquiry emails directly from your Gmail inbox or paste/type the requirement manually. The system supports loading up to 15 recent emails at once." },
  { icon: ScanSearch, title: "2. AI Requirement Analysis", color: "indigo",
    description: "Our AI deeply analyses the customer email and extracts every product requirement mentioned. If the email contains multiple MPNs/products, each one gets its own requirement card with exact specifications preserved." },
  { icon: Package, title: "3. Product Selection (3 Options)", color: "purple",
    description: "Three ways to find the best product: (a) Manual Entry — type product details yourself, (b) FAE Catalog Match — AI searches your saved product catalog and finds the best match for each MPN, (c) AI Research — Claude researches the global market regardless of your catalog." },
  { icon: GitCompareArrows, title: "4. Spec-by-Spec Comparison", color: "amber",
    description: "AI generates a detailed comparison table scoring each specification (Sensing, IP, Temp, Output, Voltage, Price, Delivery, Warranty) with verdicts: MEETS, EXCEEDS, GAP, CLOSE, COMPATIBLE, or APP-SAFE." },
  { icon: FileEdit, title: "5. Professional Email Draft", color: "emerald",
    description: "AI composes a professional technical comparison email with formatted tables, advantage highlights, commercial proposal, and next steps. Toggle between rich Preview and raw Edit mode." },
  { icon: Send, title: "6. Send via Gmail", color: "rose",
    description: "Review recipients, preview the final email, and send directly via your connected Gmail account. Or save as draft for later." },
];

const faqs = [
  { q: "How do I add products to my catalog?", a: "Go to Product Catalog in the sidebar. You can add products manually or use AI Research — search by company name, MPN, or product type and the AI will fetch product specifications. Click 'Save' to add any researched product to your catalog." },
  { q: "What if the customer email mentions multiple products?", a: "The AI extraction automatically detects every MPN/product mentioned and creates a separate requirement card for each. In the Product Selection step, you can find matches for every requirement individually." },
  { q: "How does FAE Catalog Match differ from AI Research?", a: "FAE Catalog Match searches ONLY your saved product database — products you've manually added or saved from AI Research. AI Research searches the broader market using Claude AI, regardless of what's in your catalog." },
  { q: "Is my Gmail data secure?", a: "Yes. Gmail tokens are stored in encrypted HTTP-only cookies and are never exposed to client-side JavaScript. We only request the minimum required permissions: read inbox, compose, and send." },
  { q: "Can multiple FAEs use this platform?", a: "Yes. Each FAE signs in with their own Google account. Their product catalog and inquiry history are associated with their account." },
  { q: "What happens if the AI extraction is wrong?", a: "You can click 'Re-analyse' on the requirement step to run extraction again. The system also falls back to mock data if the API is unavailable, so you can always proceed with the workflow." },
];

export default function HelpPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-slate-50">
        <div className="px-8 py-6 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <HelpCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-800">Help & Documentation</h1>
              <p className="text-sm text-slate-400">Learn how to use FAE Desk effectively</p>
            </div>
          </div>

          {/* Workflow Steps */}
          <div className="mb-10">
            <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide mb-4 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              How the Wizard Works
            </h2>
            <div className="space-y-3">
              {steps.map((step, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg bg-${step.color}-100 flex items-center justify-center shrink-0`}>
                    <step.icon className={`w-5 h-5 text-${step.color}-600`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 mb-1">{step.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Product Catalog Guide */}
          <div className="mb-10">
            <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              Product Catalog
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                The Product Catalog is your team's product database. The more products you add, the better the AI can match customer requirements to your offerings.
              </p>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-600"><span className="font-bold">Manual Add:</span> Enter product specs one by one via the form.</p>
                </div>
                <div className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-600"><span className="font-bold">AI Research:</span> Search by company (e.g., &quot;Autonics&quot;), MPN (e.g., &quot;PR18-8DP&quot;), or make (e.g., &quot;Inductive proximity sensor&quot;) and the AI will fetch product data. Click Save to add to your catalog.</p>
                </div>
              </div>
            </div>
          </div>

          {/* FAQs */}
          <div>
            <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide mb-4 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-amber-600" />
              Frequently Asked Questions
            </h2>
            <div className="space-y-2">
              {faqs.map((faq, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
                  >
                    <span className="text-sm font-semibold text-slate-700">{faq.q}</span>
                    {openFaq === i ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                  {openFaq === i && (
                    <div className="px-4 pb-4">
                      <p className="text-sm text-slate-600 leading-relaxed">{faq.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
