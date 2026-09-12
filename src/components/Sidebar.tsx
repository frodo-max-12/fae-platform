"use client";

import { useState, useEffect } from "react";
import { LayoutDashboard, Plus, History, Settings, BookOpen, HelpCircle, ChevronRight, Activity, LogIn, LogOut, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import toast from "react-hot-toast";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/wizard", icon: Plus, label: "New Inquiry" },
  { href: "/history", icon: History, label: "Past Inquiries" },
  { href: "/settings", icon: Settings, label: "Settings" },
  { href: "/help", icon: HelpCircle, label: "Help" },
];

function getGmailUser(): { id?: string; email: string; name: string; picture?: string } | null {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie.split("; ").find((c) => c.startsWith("gmail_user="));
  if (!cookie) return null;
  try {
    return JSON.parse(decodeURIComponent(cookie.split("=").slice(1).join("=")));
  } catch {
    return null;
  }
}

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ id?: string; email: string; name: string; picture?: string } | null>(null);

  useEffect(() => {
    setUser(getGmailUser());
  }, []);

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      document.cookie = "gmail_user=; Max-Age=0; path=/";
      document.cookie = "gmail_tokens=; Max-Age=0; path=/";
      setUser(null);
      toast.success("Signed out");
      window.location.href = "/";
    } catch {
      toast.error("Sign out failed");
    }
  };

  return (
    <aside className="w-[260px] bg-slate-900 text-white flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight">FAE Desk</h1>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Smart Inquiry Manager</p>
          </div>
        </div>
      </div>

      {/* New Inquiry Button */}
      <div className="px-4 mb-4">
        <Link
          href="/wizard"
          className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl text-sm font-bold hover:from-blue-500 hover:to-blue-600 transition-all shadow-lg shadow-blue-900/30"
        >
          <Plus className="w-4 h-4" />
          New Customer Inquiry
        </Link>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"}`} />
              {item.label}
              {isActive && <ChevronRight className="w-4 h-4 text-blue-400 ml-auto" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom - User Profile */}
      <div className="p-3">
        {user ? (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                {user.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{user.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 py-2 bg-slate-700/50 hover:bg-red-500/20 text-slate-400 hover:text-red-300 rounded-lg text-xs font-semibold transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        ) : (
          <Link
            href="/api/auth/google"
            className="flex items-center justify-center gap-2 w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-semibold text-slate-400 hover:text-white border border-slate-700/50 transition-all"
          >
            <LogIn className="w-4 h-4" />
            Sign in with Google
          </Link>
        )}
      </div>
    </aside>
  );
}
