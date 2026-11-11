"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { apiGetNotifications, apiMarkNotificationsRead, apiGetMyReports } from "@/lib/api";
import { NotificationItem, Report } from "@/types";
import {
  Shield,
  Search,
  Sun,
  Moon,
  Laptop,
  Bell,
  User,
  Plus,
  X,
  Clock,
  Check,
} from "lucide-react";

interface NavbarProps {
  onSearchChange?: (val: string) => void;
  searchValue?: string;
}

export default function Navbar({ onSearchChange, searchValue = "" }: NavbarProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();

  const [query, setQuery] = useState(searchValue);
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [myReports, setMyReports] = useState<Report[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);

  const isReporterUser = !!user && (user.role === "student" || user.role === "faculty");

  useEffect(() => {
    if (!isReporterUser) {
      setNotifications([]);
      setUnreadCount(0);
      setMyReports([]);
      return;
    }
    let active = true;
    apiGetNotifications()
      .then((res) => {
        if (!active) return;
        setNotifications(res.notifications || []);
        setUnreadCount(res.unread_count || 0);
      })
      .catch(() => {});
    apiGetMyReports()
      .then((res) => {
        if (!active) return;
        setMyReports(res.reports || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isReporterUser]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  // Sync prop changes
  useEffect(() => {
    setQuery(searchValue);
  }, [searchValue]);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cbb_recent_searches");
      if (saved) setRecentSearches(JSON.parse(saved).slice(0, 4));
    } catch {
      // ignore
    }
  }, []);

  // Global Keyboard shortcuts: '/' or 'Ctrl+K' / 'Cmd+K' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filter live suggestions after 2 characters (250ms debounce)
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);
    return () => clearTimeout(handler);
  }, [query]);

  const suggestions = useMemo(() => {
    if (!isReporterUser || debouncedQuery.length < 2) return [];
    const q = debouncedQuery.toLowerCase();
    return myReports
      .filter(
        (inc) =>
          inc.title?.toLowerCase().includes(q) ||
          inc.description.toLowerCase().includes(q) ||
          (inc.room || inc.location?.room || "").toLowerCase().includes(q) ||
          (inc.block || inc.location?.block || "").toLowerCase().includes(q) ||
          `#${inc.id}`.includes(q) ||
          inc.category.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [isReporterUser, myReports, debouncedQuery]);

  const saveRecentSearch = (term: string) => {
    if (!term.trim()) return;
    const updated = [term, ...recentSearches.filter((s) => s !== term)].slice(0, 4);
    setRecentSearches(updated);
    try {
      localStorage.setItem("cbb_recent_searches", JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handleSelectSuggestion = (text: string) => {
    setQuery(text);
    saveRecentSearch(text);
    onSearchChange?.(text);
    setSearchFocused(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      handleSelectSuggestion(suggestions[selectedIndex].title || "");
    } else {
      saveRecentSearch(query);
      onSearchChange?.(query);
      setSearchFocused(false);
    }
  };

  const handleKeyDownInSearch = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Escape") {
      setSearchFocused(false);
      searchInputRef.current?.blur();
    }
  };

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchDropdownRef.current &&
        !searchDropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reporter navbar: shows only reporter's own role (Student or Faculty)
  const reporterRole = user?.role === "faculty" ? "Faculty" : "Student";

  return (
    <header className="sticky top-0 z-50 w-full bg-surface border-b border-border transition-colors">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
        {/* Main Header Row */}
        <div className="flex items-center justify-between h-14 sm:h-16 gap-3 sm:gap-4">
          {/* Logo & Site Name */}
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2.5 flex-shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-card p-1"
            >
              <div className="w-8 h-8 rounded-input bg-text text-bg flex items-center justify-center font-bold">
                <Shield className="w-4 h-4 stroke-[1.5]" />
              </div>
              <span className="font-semibold text-sm sm:text-base tracking-tight text-text">
                Campus Black Box
              </span>
            </Link>

            {/* Public Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1">
              <Link
                href="/report"
                className="px-3 py-1.5 rounded-input text-xs font-semibold text-muted hover:text-text hover:bg-border/30 transition-colors"
              >
                Report Incident
              </Link>
              <Link
                href="/my-reports"
                className="px-3 py-1.5 rounded-input text-xs font-semibold text-muted hover:text-text hover:bg-border/30 transition-colors"
              >
                My Reports
              </Link>
            </nav>
          </div>

          {/* Centered Search (Desktop & Tablet) */}
          <div className="hidden sm:flex flex-1 max-w-[560px] mx-auto relative">
            <form onSubmit={handleSearchSubmit} className="w-full relative" role="search">
              <label htmlFor="desktop-search" className="sr-only">
                Search incidents
              </label>
              <div className="relative flex items-center">
                <Search className="absolute left-3 w-4 h-4 text-muted stroke-[1.5] pointer-events-none" />
                <input
                  id="desktop-search"
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    onSearchChange?.(e.target.value);
                  }}
                  onFocus={() => setSearchFocused(true)}
                  onKeyDown={handleKeyDownInSearch}
                  placeholder="Search by room, issue or incident ID"
                  role="combobox"
                  aria-expanded={searchFocused && (suggestions.length > 0 || recentSearches.length > 0)}
                  aria-autocomplete="list"
                  className="w-full pl-9 pr-14 py-2 text-sm bg-bg border border-border rounded-input text-text placeholder:text-muted focus:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      onSearchChange?.("");
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-8 text-muted hover:text-text p-1"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5 stroke-[1.5]" />
                  </button>
                ) : (
                  <kbd className="absolute right-3 hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-muted bg-surface border border-border rounded">
                    /
                  </kbd>
                )}
              </div>
            </form>

            {/* Live Suggestions Dropdown */}
            {searchFocused && (
              <div
                ref={searchDropdownRef}
                className="animate-dropdown absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-input shadow-none overflow-hidden z-50 text-xs text-text"
              >
                {/* Suggestions List */}
                {suggestions.length > 0 ? (
                  <div className="py-1">
                    <div className="px-3 py-1.5 text-[11px] font-medium text-muted uppercase tracking-wider">
                      Matching Incidents
                    </div>
                    {suggestions.map((item, idx) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectSuggestion(item.title || item.description)}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-border/40 ${
                          selectedIndex === idx ? "bg-border/60" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-semibold text-accent">#{item.id}</span>
                          <span className="truncate">{item.title || item.description}</span>
                        </div>
                        <span className="text-[11px] text-muted flex-shrink-0 ml-2">
                          {item.block || item.location?.block} · {item.room || item.location?.room}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : debouncedQuery.length >= 2 ? (
                  <div className="p-4 text-center text-muted">
                    No matching incidents found for &ldquo;{debouncedQuery}&rdquo;.
                  </div>
                ) : recentSearches.length > 0 ? (
                  <div className="py-1">
                    <div className="px-3 py-1.5 text-[11px] font-medium text-muted uppercase tracking-wider">
                      Recent Searches
                    </div>
                    {recentSearches.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => handleSelectSuggestion(term)}
                        className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-border/40 text-muted hover:text-text"
                      >
                        <Clock className="w-3.5 h-3.5 stroke-[1.5]" />
                        <span>{term}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Right Controls: Theme Toggle, Notifications, Role Profile, Desktop Report Button */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Theme Toggle Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                aria-label={`Current theme: ${theme}. Click to change theme.`}
                className="w-10 h-10 rounded-input flex items-center justify-center border border-border bg-bg text-text hover:bg-border/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {resolvedTheme === "dark" ? (
                  <Moon className="w-4 h-4 stroke-[1.5] theme-icon-rotate" />
                ) : (
                  <Sun className="w-4 h-4 stroke-[1.5] theme-icon-rotate" />
                )}
              </button>

              {/* Theme Dropdown */}
              {themeMenuOpen && (
                <div className="animate-dropdown absolute right-0 mt-1 w-32 bg-surface border border-border rounded-input py-1 z-50 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setTheme("light");
                      setThemeMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-border/40 text-left"
                  >
                    <span className="flex items-center gap-2">
                      <Sun className="w-3.5 h-3.5 stroke-[1.5]" /> Light
                    </span>
                    {theme === "light" && <Check className="w-3 h-3 text-accent" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTheme("dark");
                      setThemeMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-border/40 text-left"
                  >
                    <span className="flex items-center gap-2">
                      <Moon className="w-3.5 h-3.5 stroke-[1.5]" /> Dark
                    </span>
                    {theme === "dark" && <Check className="w-3 h-3 text-accent" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTheme("system");
                      setThemeMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-border/40 text-left"
                  >
                    <span className="flex items-center gap-2">
                      <Laptop className="w-3.5 h-3.5 stroke-[1.5]" /> System
                    </span>
                    {theme === "system" && <Check className="w-3 h-3 text-accent" />}
                  </button>
                </div>
              )}
            </div>

            {/* Notifications Bell (Shown ONLY to authenticated Student/Faculty reporters) */}
            {isReporterUser && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  aria-label="Notifications"
                  className="w-10 h-10 rounded-input flex items-center justify-center border border-border bg-bg text-text hover:bg-border/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent relative"
                >
                  <Bell className="w-4 h-4 stroke-[1.5]" />
                  {unreadCount > 0 && (
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-red-500" />
                  )}
                </button>
                {notificationsOpen && (
                  <div className="animate-dropdown absolute right-0 mt-1 w-72 bg-surface border border-border rounded-input p-3 z-50 text-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-text">Notifications</span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            apiMarkNotificationsRead()
                              .then(() => {
                                setUnreadCount(0);
                                setNotifications((prev) =>
                                  prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
                                );
                              })
                              .catch(() => {});
                          }}
                          className="text-[11px] text-accent hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <p className="text-[11px] text-muted py-2">No new notifications yet.</p>
                    ) : (
                      <div className="space-y-2 text-muted max-h-60 overflow-y-auto">
                        {notifications.slice(0, 6).map((n) => (
                          <div key={n.id} className="p-2 bg-bg border border-border rounded">
                            <p className="text-text font-medium">{n.message}</p>
                            <p className="text-[10px] text-muted mt-0.5">
                              {new Date(n.created_at).toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Authenticated Reporter Menu (Shows Reporter's Own Name and Student/Faculty Role) or Sign In */}
            {isReporterUser && user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen(!profileOpen)}
                  data-testid="reporter-header-profile"
                  aria-label={`Logged in as ${user.name || user.email} (${reporterRole}). Click to view menu.`}
                  className="h-10 px-3 rounded-input flex items-center gap-2 border border-border bg-bg text-text hover:bg-border/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent text-xs font-medium"
                >
                  <User className="w-3.5 h-3.5 stroke-[1.5] text-accent" />
                  <span className="font-semibold text-text">{user.name || user.email}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-chip bg-border text-muted font-medium uppercase tracking-wider">
                    {reporterRole}
                  </span>
                </button>

                {profileOpen && (
                  <div className="animate-dropdown absolute right-0 mt-1 w-52 bg-surface border border-border rounded-input py-1 z-50 text-xs shadow-none">
                    <div className="px-3 py-2 border-b border-border">
                      <div className="font-semibold text-text">{user.name || user.email}</div>
                      <div className="text-[11px] text-muted truncate">{user.email}</div>
                      <div className="mt-1">
                        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-chip bg-border text-muted font-semibold uppercase">
                          Role: {reporterRole}
                        </span>
                      </div>
                    </div>

                    <div className="py-1">
                      <Link
                        href="/my-reports"
                        onClick={() => setProfileOpen(false)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-border/40 text-text"
                      >
                        My Reports
                      </Link>
                      <Link
                        href="/report"
                        onClick={() => setProfileOpen(false)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-border/40 text-text"
                      >
                        Report Incident
                      </Link>
                    </div>

                    <div className="border-t border-border pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-red-500 hover:bg-border/40 font-medium"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="h-10 px-3.5 rounded-input border border-border bg-bg text-text hover:bg-border/30 text-xs font-semibold flex items-center gap-1.5"
              >
                <User className="w-3.5 h-3.5 stroke-[1.5]" />
                <span>Sign in</span>
              </Link>
            )}

            {/* Desktop Report Incident Button (≥1024px) */}
            <Link
              href="/report"
              className="hidden lg:inline-flex items-center gap-1.5 h-10 px-4 rounded-input bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Plus className="w-4 h-4 stroke-[1.5]" />
              <span>Report incident</span>
            </Link>
          </div>
        </div>

        {/* Mobile Row 2: Search Input (Under 640px) */}
        <div className="sm:hidden pb-3">
          <form onSubmit={handleSearchSubmit} className="relative" role="search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted stroke-[1.5] pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                onSearchChange?.(e.target.value);
              }}
              placeholder="Search by room, issue or incident ID"
              className="w-full pl-9 pr-8 h-10 text-xs bg-bg border border-border rounded-input text-text placeholder:text-muted focus:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  onSearchChange?.("");
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted p-1"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5 stroke-[1.5]" />
              </button>
            )}
          </form>
        </div>
      </div>
    </header>
  );
}
