"use client";

import { motion } from "framer-motion";
import {
  Clock, Mail, TrendingUp, Target, ArrowRight, Plus,
  IndianRupee, Package, CheckCircle2, AlertCircle, Timer,
  FileText, Send,
} from "lucide-react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";

const stats = [
  { label: "Inquiries Today", value: "12", change: "+3 new", icon: Mail, color: "from-blue-500 to-blue-600" },
  { label: "Avg Response Time", value: "2.5 min", change: "vs 45min manual", icon: Clock, color: "from-emerald-500 to-emerald-600" },
  { label: "Quotes Sent", value: "9", change: "75% response rate", icon: Send, color: "from-purple-500 to-purple-600" },
  { label: "Revenue Pipeline", value: "Rs.4.2L", change: "This week", icon: IndianRupee, color: "from-amber-500 to-amber-600" },
];

const recentInquiries = [
  {
    customer: "Priya Sharma",
    company: "Automation Corp India",
    subject: "Inductive proximity sensor — 500 units",
    status: "sent",
    time: "9:18 AM",
    saving: "Rs.35,000",
  },
  {
    customer: "Amit Patel",
    company: "Precision Manufacturing",
    subject: "Photoelectric sensor — 200 units",
    status: "draft",
    time: "10:45 AM",
    saving: "Rs.18,000",
  },
  {
    customer: "Deepak Verma",
    company: "SteelWorks India",
    subject: "K-type thermocouple — 50 units",
    status: "pending",
    time: "11:30 AM",
    saving: "—",
  },
  {
    customer: "Neha Gupta",
    company: "PharmaPack Solutions",
    subject: "Capacitive sensor — 300 units",
    status: "sent",
    time: "Yesterday",
    saving: "Rs.22,500",
  },
  {
    customer: "Rajesh Kumar",
    company: "AutoLine Systems",
    subject: "Fiber optic sensor — 100 units",
    status: "sent",
    time: "Yesterday",
    saving: "Rs.12,000",
  },
];

const statusConfig: Record<string, { label: string; bg: string; text: string; icon: typeof CheckCircle2 }> = {
  sent: { label: "Sent", bg: "bg-emerald-100", text: "text-emerald-700", icon: CheckCircle2 },
  draft: { label: "Draft Ready", bg: "bg-blue-100", text: "text-blue-700", icon: FileText },
  pending: { label: "In Progress", bg: "bg-amber-100", text: "text-amber-700", icon: Timer },
};

const topProducts = [
  { name: "Autonics PR18-8DP", category: "Proximity Sensor", quoted: 14, stock: 680, warehouse: "the city" },
  { name: "Pepperl+Fuchs NBB8-18GM50", category: "Proximity Sensor", quoted: 8, stock: 450, warehouse: "Mumbai" },
  { name: "IFM Electronic IF5250", category: "Proximity Sensor", quoted: 6, stock: 200, warehouse: "Delhi" },
  { name: "Autonics BEN5M-MFR", category: "Photoelectric", quoted: 5, stock: 320, warehouse: "Chennai" },
];

export default function Dashboard() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-sm text-slate-400 font-medium mb-1">Good morning, Rohit</p>
            <h1 className="text-3xl font-extrabold text-slate-900 mb-1">
              Your Inquiry Dashboard
            </h1>
            <p className="text-slate-500 text-sm">
              You have <span className="font-semibold text-blue-600">3 new customer emails</span> waiting for response.
            </p>

            <Link
              href="/wizard"
              className="inline-flex items-center gap-2 mt-5 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-bold text-sm hover:from-blue-700 hover:to-blue-800 transition-all shadow-xl shadow-blue-500/20 group"
            >
              <Plus className="w-5 h-5" />
              Handle New Inquiry
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>

        {/* Stats Grid */}
        <div className="px-8 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * i }}
                className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg hover:border-slate-300 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-sm`}>
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {stat.change}
                  </span>
                </div>
                <p className="text-2xl font-extrabold text-slate-800">{stat.value}</p>
                <p className="text-xs text-slate-400 font-medium mt-0.5">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="px-8 py-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Inquiries - takes 2 columns */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-800">Recent Inquiries</h2>
              <Link href="/history" className="text-xs text-blue-600 font-semibold hover:underline">
                View All
              </Link>
            </div>

            <div className="space-y-3">
              {recentInquiries.map((inquiry, i) => {
                const status = statusConfig[inquiry.status];
                const StatusIcon = status.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 + i * 0.05 }}
                    className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all cursor-pointer group"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {inquiry.customer.split(" ").map((n) => n[0]).join("")}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-700 truncate">{inquiry.customer}</p>
                        <span className="text-xs text-slate-400">— {inquiry.company}</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{inquiry.subject}</p>
                    </div>

                    {/* Saving */}
                    {inquiry.saving !== "—" && (
                      <div className="text-right shrink-0 hidden sm:block">
                        <p className="text-xs font-bold text-emerald-600">{inquiry.saving}</p>
                        <p className="text-[10px] text-slate-400">saved</p>
                      </div>
                    )}

                    {/* Status */}
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${status.bg} shrink-0`}>
                      <StatusIcon className={`w-3.5 h-3.5 ${status.text}`} />
                      <span className={`text-[11px] font-bold ${status.text}`}>{status.label}</span>
                    </div>

                    {/* Time */}
                    <span className="text-xs text-slate-400 shrink-0 w-16 text-right">{inquiry.time}</span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Top Quoted Products */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-2xl border border-slate-200 p-6"
            >
              <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                Most Quoted Products
              </h2>
              <div className="space-y-3">
                {topProducts.map((product, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{product.name}</p>
                      <p className="text-[10px] text-slate-400">{product.category} &middot; {product.warehouse}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-700">{product.quoted}x</p>
                      <p className="text-[10px] text-slate-400">{product.stock} in stock</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Quick Performance */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white"
            >
              <h2 className="text-sm font-bold mb-4">This Week&apos;s Performance</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">Inquiries Handled</span>
                  <span className="text-sm font-bold">48</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full w-[80%] bg-gradient-to-r from-blue-500 to-blue-400 rounded-full" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">Quotes Converted</span>
                  <span className="text-sm font-bold text-emerald-400">38%</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full w-[38%] bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">Total Savings Offered</span>
                  <span className="text-sm font-bold text-amber-400">Rs.2.8L</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full w-[65%] bg-gradient-to-r from-amber-500 to-amber-400 rounded-full" />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
