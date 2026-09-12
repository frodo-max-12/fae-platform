"use client";

import { useState, useEffect } from "react";
import { Settings, User, Mail, Shield, Bell, LogOut, LogIn, Check } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import toast from "react-hot-toast";

function getGmailUser() {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie.split("; ").find((c) => c.startsWith("gmail_user="));
  if (!cookie) return null;
  try { return JSON.parse(decodeURIComponent(cookie.split("=").slice(1).join("="))); } catch { return null; }
}

export default function SettingsPage() {
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);

  useEffect(() => { setUser(getGmailUser()); }, []);

  const handleSignOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    document.cookie = "gmail_user=; Max-Age=0; path=/";
    document.cookie = "gmail_tokens=; Max-Age=0; path=/";
    toast.success("Signed out successfully");
    window.location.href = "/";
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-slate-50">
        <div className="px-8 py-6">
          <h1 className="text-xl font-extrabold text-slate-800 mb-1">Settings</h1>
          <p className="text-sm text-slate-400 mb-8">Manage your account and preferences</p>

          <div className="max-w-2xl space-y-6">
            {/* Profile Section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-5">
                <User className="w-5 h-5 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Profile</h2>
              </div>

              {user ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold">
                      {user.name?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <div>
                      <p className="text-base font-bold text-slate-800">{user.name}</p>
                      <p className="text-sm text-slate-500">{user.email}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-xs text-emerald-600 font-semibold">Connected</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-5 py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-semibold hover:bg-red-100 transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="p-8 bg-slate-50 rounded-xl text-center">
                  <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 mb-4">Not signed in</p>
                  <a
                    href="/api/auth/google"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all"
                  >
                    <LogIn className="w-4 h-4" />
                    Sign in with Google
                  </a>
                </div>
              )}
            </div>

            {/* Gmail Integration */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="w-5 h-5 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Gmail Integration</h2>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Gmail API Access</p>
                  <p className="text-xs text-slate-400">Read inbox and send emails on your behalf</p>
                </div>
                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${user ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                  {user ? <><Check className="w-3 h-3" /> Active</> : "Inactive"}
                </span>
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-5 h-5 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Notifications</h2>
              </div>
              <div className="space-y-3">
                {["Email sent confirmations", "New customer inquiry alerts", "Weekly performance summary"].map((item) => (
                  <div key={item} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <span className="text-sm text-slate-600">{item}</span>
                    <div className="w-10 h-6 bg-blue-600 rounded-full flex items-center justify-end p-0.5 cursor-pointer">
                      <div className="w-5 h-5 bg-white rounded-full shadow-sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Security */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Security</h2>
              </div>
              <p className="text-xs text-slate-500">
                Authentication is handled securely via Google OAuth 2.0. Your Gmail tokens are stored in encrypted HTTP-only cookies and are never exposed to the browser.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
