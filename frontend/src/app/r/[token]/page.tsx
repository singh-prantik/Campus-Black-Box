"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { apiGetLocationByQr, apiCreateReport, apiPredict } from "@/lib/api";
import { Location } from "@/types";
import { useAuth } from "@/lib/auth";
import toast from "react-hot-toast";
import {
  MapPin,
  X,
  Camera,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  QrCode,
  Lock,
} from "lucide-react";

export default function QrReportPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const token = String(params?.token || "");

  const [location, setLocation] = useState<Location | null>(null);
  const [locLoading, setLocLoading] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Form State
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<number | null>(null);

  // Truthful AI State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    category: string | null;
    confidence: number | null;
    duplicate: { isDuplicate: boolean; matchScore: number; matchedReportId: number | null };
    label?: string;
  } | null>(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const debounceTimer = useRef<any>(null);

  // 1. Resolve QR Token to Location
  useEffect(() => {
    if (!token) {
      setTokenError("Missing QR token");
      setLocLoading(false);
      return;
    }

    setLocLoading(true);
    setTokenError(null);

    apiGetLocationByQr(token)
      .then((res) => {
        if (res?.location) {
          setLocation(res.location);
        } else {
          setTokenError("Invalid or inactive QR code");
        }
      })
      .catch((err) => {
        setTokenError(err.message || "Invalid or inactive QR code");
      })
      .finally(() => setLocLoading(false));
  }, [token]);

  // 2. Truthful AI Categorization (Debounced, >= 15 chars, max 3s timeout)
  useEffect(() => {
    const text = description.trim();

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (text.length < 15) {
      setAiResult(null);
      setAiLoading(false);
      setAiUnavailable(false);
      return;
    }

    setAiLoading(true);
    setAiUnavailable(false);

    debounceTimer.current = setTimeout(() => {
      // 3-second timeout protection
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 3000)
      );

      Promise.race([apiPredict(text, location?.id || 1), timeoutPromise])
        .then((res: any) => {
          setAiResult(res);
          if (res?.category && !selectedCategory) {
            setSelectedCategory(res.category);
          }
          setAiUnavailable(false);
        })
        .catch(() => {
          setAiUnavailable(true);
          setAiResult(null);
        })
        .finally(() => setAiLoading(false));
    }, 500);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [description, location?.id, selectedCategory]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("Please enter a description of the problem");
      return;
    }
    if (!location) {
      toast.error("Valid location is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiCreateReport({
        description,
        location_id: location.id,
        category: selectedCategory || undefined,
        photo_url: photoPreview || undefined,
      });
      setSubmittedId(res.report.id);
      toast.success(`Incident #${res.report.id} catalogued`);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit incident report");
    } finally {
      setSubmitting(false);
    }
  };

  // Loading Screen
  if (locLoading || authLoading) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-surface rounded w-48 mx-auto" />
            <div className="h-4 bg-surface rounded w-64 mx-auto" />
          </div>
        </main>
      </div>
    );
  }

  // Error State: Invalid or Inactive QR Token (AC4.2 - No form rendered)
  if (tokenError || !location) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <Navbar />
        <main className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="p-8 bg-surface border border-border rounded-card space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text">Invalid QR Code</h1>
              <p className="text-xs text-muted mt-1.5 leading-relaxed">
                The scanned QR token &ldquo;{token}&rdquo; does not match any registered campus location, or this door placard has been retired.
              </p>
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/report"
                className="w-full py-2 rounded-input bg-text text-bg text-xs font-semibold hover:opacity-90"
              >
                Select location manually
              </Link>
              <Link
                href="/"
                className="w-full py-2 rounded-input border border-border bg-bg text-text text-xs font-semibold hover:bg-border/30"
              >
                Return to public feed
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Not Logged In: Prompt to Login with returnUrl (AC4.3)
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <Navbar />
        <main className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="p-8 bg-surface border border-border rounded-card space-y-4">
            <div className="w-12 h-12 rounded-full bg-accent/10 text-accent mx-auto flex items-center justify-center">
              <Lock className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">
                Authentication Required
              </span>
              <h1 className="text-lg font-bold text-text mt-1">Sign In to Report</h1>
              <p className="text-xs text-muted mt-1.5 leading-relaxed">
                You scanned the door QR code for <strong className="text-text">{location.block} · {location.room}</strong>. Please sign in with your student or faculty account to file this incident.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href={`/login?returnUrl=/r/${token}`}
                className="inline-block w-full py-2.5 rounded-input bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors"
              >
                Sign in with campus account
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Unauthorized Role Notice: Only Student and Faculty can report (Decision)
  const isReporterRole = user.role === "student" || user.role === "faculty";
  if (!isReporterRole) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <Navbar />
        <main className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="p-8 bg-surface border border-border rounded-card space-y-4">
            <div className="w-12 h-12 rounded-full bg-border text-muted mx-auto flex items-center justify-center">
              <QrCode className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">
                Reporter Role Restriction
              </span>
              <h1 className="text-lg font-bold text-text mt-1">Reporting Unavailable for {user.role}</h1>
              <p className="text-xs text-muted mt-1.5 leading-relaxed">
                Incident reporting is reserved for Student and Faculty accounts. Your current authenticated role is <strong className="text-text capitalize">{user.role}</strong>.
              </p>
            </div>
            <div className="pt-2 flex flex-col gap-2">
              {user.role === "admin" || user.role === "super_admin" ? (
                <Link
                  href="/dashboard/admin"
                  className="w-full py-2 rounded-input bg-text text-bg text-xs font-semibold hover:opacity-90"
                >
                  Go to Admin Triage
                </Link>
              ) : (
                <Link
                  href="/dashboard/technician"
                  className="w-full py-2 rounded-input bg-text text-bg text-xs font-semibold hover:opacity-90"
                >
                  Go to Assigned Work Orders
                </Link>
              )}
              <Link
                href="/"
                className="w-full py-2 rounded-input border border-border bg-bg text-text text-xs font-semibold hover:bg-border/30"
              >
                Public incident feed
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text mb-6 transition-colors font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5 stroke-[1.5]" />
          Back to incidents
        </Link>

        {submittedId ? (
          /* Submission Success State */
          <div className="p-8 bg-surface border border-border rounded-card text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-border text-accent mx-auto flex items-center justify-center">
              <CheckCircle className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text">Incident #{submittedId} Reported</h1>
              <p className="text-xs text-muted mt-1 max-w-md mx-auto">
                Your incident has been catalogued for {location.block} · {location.room}. Maintenance staff have been notified.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <Link
                href="/dashboard"
                className="px-4 py-2 rounded-input bg-text text-bg text-xs font-semibold hover:opacity-90"
              >
                View my incidents
              </Link>
              <Link
                href="/"
                className="px-4 py-2 rounded-input border border-border bg-bg text-text text-xs font-semibold hover:bg-border/30"
              >
                Public feed
              </Link>
            </div>
          </div>
        ) : (
          /* QR Report Form (AC4.1 - Read-only location, Truthful AI) */
          <div className="p-6 bg-surface border border-border rounded-card space-y-6">
            <div className="border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-accent uppercase tracking-wider flex items-center gap-1">
                  <QrCode className="w-3.5 h-3.5 stroke-[1.5]" />
                  QR Deep-Link Report
                </span>
                <span className="text-[11px] px-1.5 py-0.5 rounded-chip bg-border text-muted font-medium">
                  Sample data
                </span>
              </div>
              <h1 className="text-xl font-bold text-text mt-1">Report Campus Incident</h1>
              <p className="text-xs text-muted mt-0.5">
                Location verified and locked from scanned door placard.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* READ-ONLY Location Block (AC4.1) */}
              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">
                  Location (Verified via QR)
                </label>
                <div className="flex items-center gap-2 p-3 bg-bg border border-border rounded-input text-xs">
                  <MapPin className="w-4 h-4 text-accent stroke-[1.5] flex-shrink-0" />
                  <div className="flex-1">
                    <span className="font-bold text-text">
                      {location.block} · {location.room}
                    </span>
                    <span className="text-muted ml-2 text-[11px] capitalize">
                      ({location.location_type || "Classroom"})
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-chip bg-surface border border-border text-muted font-mono">
                    {location.qr_token}
                  </span>
                </div>
              </div>

              {/* Description Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-text">
                    What is the problem? *
                  </label>
                  <span className="text-[11px] text-muted">
                    {description.length < 15 ? `${15 - description.length} more characters for AI suggestion` : "AI suggestion active"}
                  </span>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue in detail (e.g. Projector lamp flickers and shuts off 5 minutes into lecture)..."
                  rows={4}
                  className="w-full p-3 bg-bg border border-border rounded-input text-xs text-text placeholder:text-muted focus:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  required
                />
              </div>

              {/* Truthful AI Suggestion Panel (AC3.1, AC3.2, AC3.3) */}
              <div className="p-3 bg-bg border border-border rounded-input text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-accent stroke-[1.5]" />
                    <span>AI Categorization</span>
                  </span>
                  {aiLoading && (
                    <span className="text-[11px] text-muted animate-pulse">
                      Analyzing description...
                    </span>
                  )}
                </div>

                {description.trim().length < 15 ? (
                  /* Neutral State (AC3.1): NO category, NO confidence, NO priority */
                  <p className="text-muted text-[11px] italic">
                    Suggestion appears after you describe the problem (enter at least 15 characters).
                  </p>
                ) : aiUnavailable ? (
                  /* Fallback State (AC3.3): Suggestion unavailable, submission still succeeds */
                  <div className="text-[11px] text-muted">
                    Suggestion unavailable (form can still be submitted).
                  </div>
                ) : aiResult ? (
                  /* Real Result State (AC3.2): Honest rule-based suggestion */
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-muted">Suggested category:</span>
                      <span className="font-semibold px-2 py-0.5 rounded-chip bg-surface border border-border text-text">
                        {aiResult.category || "General"}
                      </span>
                      <span className="text-[10px] text-muted px-1.5 py-0.5 rounded bg-border">
                        Rule-based suggestion (prototype)
                      </span>
                    </div>

                    {/* Duplicate Detection Warning (if triggered) */}
                    {aiResult.duplicate?.isDuplicate && (
                      <div className="p-2.5 rounded bg-surface border border-border flex items-start gap-2 text-[11px] text-text">
                        <AlertTriangle className="w-3.5 h-3.5 text-accent stroke-[1.5] flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">Potential duplicate work order:</span> An open ticket (#
                          {aiResult.duplicate.matchedReportId}) already exists for this room.
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Optional Category Override Selector */}
                <div className="pt-1 flex items-center gap-2">
                  <label className="text-[11px] text-muted">Category:</label>
                  <select
                    value={selectedCategory || (aiResult?.category || "Equipment")}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="h-7 px-2 bg-surface border border-border rounded text-[11px] text-text"
                  >
                    <option value="Equipment">Equipment</option>
                    <option value="Electrical">Electrical</option>
                    <option value="IT/Wi-Fi">IT/Wi-Fi</option>
                    <option value="Water">Water</option>
                    <option value="Cleanliness">Cleanliness</option>
                    <option value="Furniture">Furniture</option>
                    <option value="Safety">Safety</option>
                    <option value="Accessibility">Accessibility</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Photo Evidence Preview */}
              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">
                  Photo Evidence (Optional)
                </label>
                {photoPreview ? (
                  <div className="relative w-full aspect-[16/10] max-h-48 rounded-input overflow-hidden border border-border bg-bg">
                    <img
                      src={photoPreview}
                      alt="Attached evidence preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotoPreview(null)}
                      className="absolute top-2 right-2 p-1 rounded-full bg-surface border border-border text-text hover:bg-bg"
                    >
                      <X className="w-4 h-4 stroke-[1.5]" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      setPhotoPreview("/samples/projector.webp");
                      toast.success("Sample photo attached");
                    }}
                    className="border border-dashed border-border rounded-input p-5 text-center cursor-pointer hover:border-accent transition-colors bg-bg"
                  >
                    <Camera className="w-5 h-5 text-muted mx-auto stroke-[1.5] mb-1" />
                    <div className="text-xs font-medium text-text">
                      Attach photo evidence (optional)
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-input bg-accent text-white font-semibold text-xs hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? "Submitting incident..." : "Submit Incident Report"}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

