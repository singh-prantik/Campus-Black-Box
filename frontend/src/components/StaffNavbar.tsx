"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, LogOut, Map, ClipboardList, Wrench } from "lucide-react";
import { useStaffSession } from "@/lib/staffApi";

export default function StaffNavbar() {
  const pathname = usePathname();
  const { user, isAdmin, logout } = useStaffSession();

  const navItems = isAdmin
    ? [
        { href: "/staff/admin", label: "Admin Triage", icon: ClipboardList },
        { href: "/heatmap", label: "Campus Heat Map", icon: Map },
        { href: "/staff/work-orders", label: "Work Orders", icon: Wrench },
      ]
    : [
        { href: "/staff/work-orders", label: "Work Orders", icon: Wrench },
      ];

  return (
    <header className="sticky top-0 z-40 w-full bg-surface border-b border-border">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link
            href={isAdmin ? "/staff/admin" : "/staff/work-orders"}
            className="flex items-center gap-2 font-bold text-sm text-text"
          >
            <div className="w-7 h-7 rounded-input bg-text text-bg flex items-center justify-center">
              <Shield className="w-4 h-4 stroke-[1.75]" />
            </div>
            <span>Staff Operations</span>
          </Link>

          {user && (
            <nav className="hidden sm:flex items-center gap-1 text-xs font-medium">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 rounded-input inline-flex items-center gap-1.5 transition-colors ${
                      active
                        ? "bg-text text-bg font-semibold"
                        : "text-muted hover:text-text hover:bg-bg"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs">
          {user ? (
            <>
              <div
                data-testid="staff-header-profile"
                className="px-3 py-1.5 rounded-input border border-border bg-bg flex items-center gap-2"
              >
                <span className="font-semibold text-text">{user.name || user.email}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-chip bg-amber-500/15 text-amber-500 font-semibold uppercase">
                  {user.role}
                </span>
              </div>
              <button
                type="button"
                onClick={logout}
                className="px-3 py-1.5 rounded-input border border-border bg-bg text-muted hover:text-text hover:border-text/30 inline-flex items-center gap-1.5 font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </>
          ) : (
            <Link
              href="/staff/login"
              className="px-3 py-1.5 rounded-input bg-accent text-white font-semibold hover:bg-accent-hover"
            >
              Staff Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

