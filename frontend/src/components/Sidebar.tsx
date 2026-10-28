"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Map,
  MapPin,
  ChevronLeft,
} from "lucide-react";

const allLinks = [
  { href: "/dashboard/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/admin", label: "Incidents", icon: FileText },
  { href: "/heatmap", label: "Heat Map", icon: Map },
  { href: "/report/1", label: "Report Incident", icon: MapPin },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => pathname === href;

  return (
    <aside
      className={`border-r border-border bg-surface flex flex-col transition-all duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      <div className="flex items-center justify-between p-4 border-b border-border">
        {!collapsed && (
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">
            Menu
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded text-muted hover:text-text hover:bg-bg"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft
            className={`w-4 h-4 stroke-[1.5] transition-transform ${
              collapsed ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      <nav className="p-2 space-y-1">
        {allLinks.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-input text-xs font-medium transition-colors ${
                active
                  ? "bg-text text-bg font-semibold"
                  : "text-muted hover:text-text hover:bg-bg"
              }`}
            >
              <Icon className="w-4 h-4 stroke-[1.5] flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
