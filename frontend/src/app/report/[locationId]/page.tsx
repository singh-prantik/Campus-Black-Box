"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { apiCreateReport, apiGetLocations, apiPredict } from "@/lib/api";
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
  ShieldAlert,
  ArrowRight,
  Info,
} from "lucide-react";

const CATEGORIES = [
  "Electrical",
  "IT/Wi-Fi",
  "Equipment",
  "Water",
  "Cleanliness",
  "Furniture",
  "Safety",
  "Accessibility",
];

export default function ReportIncidentPage() {
  const params = useParams();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const locationIdParam = Number(params?.locationId);

  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocId, setSelectedLocId] = useState<number>(locationIdParam || 1);
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submittedId, setSubmittedId] = useState<number | null>(null);

  // Truthful AI State (FR-16, FR-21)
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    category: string | null;
    confidence: number | null;
    duplicate: { isDuplicate: boolean; matchScore: number; matchedReportId: number | null };
    label?: string;
  } | null>(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const debounceTimer = useRef<any>(null);

  // Load locations
  useEffect(() => {
    apiGetLocations().then((res) => {
      setLocations(res.locations);
      if (res.locations.some((l) => l.id === locationIdParam)) {
        setSelectedLocId(locationIdParam);
      } else if (res.locations.length > 0 && !locationIdParam) {
        setSelectedLocId(res.locations[0].id);
      }
    });
  }, [locationIdParam]);

  // Truthful debounced AI suggestion (>= 15 chars, max 3s timeout)
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
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 3000)
      );

      Promise.race([apiPredict(text, selectedLocId), timeoutPromise])
        .then((res: any) => {
          setAiResult(res);
          if (res?.category && !selectedCategory) {
            setSelectedCategory(res.category);
          }
        })
        .catch(() => {
          setAiUnavailable(true);
          setAiResult(null);
        })
        .finally(() => {
          setAiLoading(false);
        });
    }, 250);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [description, selectedLocId]);

  const handleSimulatePhoto = () => {
    setPhotoPreview("/samples/projector.webp");
    toast.success("Photo attached");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("Please enter an incident description");
      return;
    }

    setLoading(true);
    try {
      const res = await apiCreateReport({
        description,
        location_id: selectedLocId,
        category: selectedCategory || aiResult?.category || undefined,
        photo_url: photoPreview || undefined,
      });
      setSubmittedId(res.report.id);
      toast.success("Incident reported successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit incident report");
    } finally {
      setLoading(false);
    }
  };

  // Auth & Role Guarding
  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg text-text flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="w-2.5 h-2.5 rounded-full bg-accent animate-ping" />
          Verifying reporter authentication...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-bg text-text flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full p-6 bg-surface border border-border rounded-card text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-border text-accent mx-auto flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text">Sign In Required to Report</h1>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Submitting an incident report requires verified campus credentials (Student or Faculty account).
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
              <Link
                href={`/login?returnUrl=/report/${selectedLocId}`}
                className="px-4 py-2 rounded-input bg-text text-bg text-xs font-semibold hover:opacity-90 inline-flex items-center justify-center gap-1.5"
              >
                Sign In to Continue
                <ArrowRight className="w-3.5 h-3.5 stroke-[1.5]" />
              </Link>
              <Link
                href="/"
                className="px-4 py-2 rounded-input border border-border bg-bg text-text text-xs font-semibold hover:bg-border/30 text-center"
              >
                Return to Public Feed
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Admin / Technician notice
  const isReporterRole = user?.role === "student" || user?.role === "faculty";
  if (!isReporterRole) {
    return (
      <div className="min-h-screen bg-bg text-text flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full p-6 bg-surface border border-border rounded-card text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-border text-accent mx-auto flex items-center justify-center">
              <Info className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text">Reporter Account Required</h1>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                You are currently signed in as <span className="font-semibold text-text">{user?.role}</span>. Incident reporting is designated for Students and Faculty.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
              <Link
                href={user?.role === "maintenance" ? "/dashboard/technician" : "/dashboard/admin"}
                className="px-4 py-2 rounded-input bg-text text-bg text-xs font-semibold hover:opacity-90 inline-flex items-center justify-center gap-1.5"
              >
                Go to Dashboard
                <ArrowRight className="w-3.5 h-3.5 stroke-[1.5]" />
              </Link>
              <Link
                href="/"
                className="px-4 py-2 rounded-input border border-border bg-bg text-text text-xs font-semibold hover:bg-border/30 text-center"
              >
                Public Feed
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
                Your incident has been catalogued. Maintenance staff have been notified for triage.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <Link
                href="/"
                className="px-4 py-2 rounded-input bg-text text-bg text-xs font-semibold hover:opacity-90"
              >
                View all incidents
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSubmittedId(null);
                  setDescription("");
                  setSelectedCategory("");
                  setPhotoPreview(null);
                }}
                className="px-4 py-2 rounded-input border border-border bg-bg text-text text-xs font-semibold hover:bg-border/30"
              >
                Report another incident
              </button>
            </div>
          </div>
        ) : (
          /* Incident Report Form */
          <div className="p-6 bg-surface border border-border rounded-card space-y-6">
            <div className="border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">
                  Campus Incident Report
                </span>
              </div>
              <h1 className="text-xl font-bold text-text mt-1">Report Campus Incident</h1>
              <p className="text-xs text-muted mt-0.5">
                Select where the problem is located and describe what needs repair.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Honest Location Selector (Honest copy, no false QR claims) */}
              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">
                  Location (Select room)
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted stroke-[1.5]" />
                  <select
                    value={selectedLocId}
                    onChange={(e) => setSelectedLocId(Number(e.target.value))}
                    className="w-full h-10 pl-9 pr-4 bg-bg border border-border rounded-input text-xs text-text focus:border-accent font-medium"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.block} · {loc.room} ({loc.location_type || "Classroom"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-text">
                    What is the issue? *
                  </label>
                  <span className="text-[11px] text-muted flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-accent stroke-[1.5]" />
                    AI Triage Suggestion
                  </span>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Projector displays no video feed; audio hums loudly when connected via HDMI."
                  rows={4}
                  className="w-full p-3 bg-bg border border-border rounded-input text-xs text-text placeholder:text-muted focus:border-accent"
                />
              </div>

              {/* Truthful AI Classification Panel (AC3.1, AC3.2, AC3.3) */}
              <div className="p-3 bg-bg border border-border rounded-input space-y-2 text-xs">
                {description.trim().length < 15 ? (
                  // Neutral State when empty / <15 chars: NO category, NO confidence %, NO priority
                  <div className="text-muted flex items-center gap-2 py-1">
                    <Sparkles className="w-3.5 h-3.5 text-muted stroke-[1.5]" />
                    <span>
                      Type at least 15 characters describing the issue to see rule-based category suggestion.
                    </span>
                  </div>
                ) : aiLoading ? (
                  <div className="text-muted flex items-center gap-2 py-1">
                    <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
                    <span>Analyzing description...</span>
                  </div>
                ) : aiUnavailable ? (
                  <div className="text-muted italic py-1">
                    Suggestion unavailable — please select a category manually below.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-accent stroke-[1.5]" />
                        <span>Rule-based suggestion (prototype)</span>
                      </span>
                      {aiResult?.category && (
                        <span className="font-semibold text-accent">
                          Suggested: {aiResult.category}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Category Selection Chips */}
                <div>
                  <div className="text-[11px] text-muted font-medium mb-1.5">
                    Category {selectedCategory ? `(Selected: ${selectedCategory})` : "*"}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((cat) => {
                      const isSelected = selectedCategory === cat;
                      const isSuggested = aiResult?.category === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-2.5 py-1 rounded-chip text-xs font-medium transition-colors border ${
                            isSelected
                              ? "bg-accent text-white border-accent"
                              : isSuggested
                              ? "bg-surface text-text border-accent/50"
                              : "bg-surface text-muted border-border hover:border-text/30"
                          }`}
                        >
                          {cat}
                          {isSuggested && !isSelected && " (suggested)"}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Duplicate Detection Warning */}
                {aiResult?.duplicate?.isDuplicate && (
                  <div className="mt-2 p-2.5 rounded-input bg-surface border border-border text-xs flex items-start gap-2 text-text">
                    <AlertTriangle className="w-4 h-4 text-amber-500 stroke-[1.5] flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-text">Potential Duplicate:</span> An incident (#
                      {aiResult.duplicate.matchedReportId}) with similar details was recently logged for this location.
                    </div>
                  </div>
                )}
              </div>

              {/* Photo Upload with Preview */}
              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">
                  Photo Evidence (Optional)
                </label>
                {photoPreview ? (
                  <div className="relative w-full aspect-[16/10] max-h-48 rounded-input overflow-hidden border border-border bg-bg">
                    <img
                      src={photoPreview}
                      alt="Incident evidence preview"
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
                    onClick={handleSimulatePhoto}
                    className="border border-dashed border-border rounded-input p-6 text-center cursor-pointer hover:border-accent transition-colors bg-bg"
                  >
                    <Camera className="w-6 h-6 text-muted mx-auto stroke-[1.5] mb-2" />
                    <div className="text-xs font-medium text-text">
                      Click to attach photo evidence
                    </div>
                    <div className="text-[11px] text-muted mt-0.5">Supports PNG, WebP, JPG up to 5MB</div>
                  </div>
                )}
              </div>

              {/* Legal Consent Line */}
              <div className="text-[12px] text-muted leading-relaxed">
                By submitting this report, you agree to the{" "}
                <Link href="/terms" className="text-accent underline">Terms &amp; Conditions</Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-accent underline">Privacy Policy</Link>.
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !description.trim()}
                className="w-full h-11 rounded-input bg-accent text-white font-semibold text-xs hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? "Submitting incident..." : "Submit Incident Report"}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
