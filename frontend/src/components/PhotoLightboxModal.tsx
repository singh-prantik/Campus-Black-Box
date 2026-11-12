"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Camera, AlertCircle } from "lucide-react";
import { apiFetchStaffReportPhoto } from "@/lib/staffApi";

interface PhotoLightboxModalProps {
  reportId: number;
  title?: string;
  onClose: () => void;
}

export default function PhotoLightboxModal({
  reportId,
  title,
  onClose,
}: PhotoLightboxModalProps) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (prevFocus && typeof prevFocus.focus === "function") {
        prevFocus.focus();
      }
    };
  }, [onClose]);

  useEffect(() => {
    let active = true;
    let currentUrl: string | null = null;
    setLoading(true);
    setErrorMsg(null);
    setBlobUrl(null);

    apiFetchStaffReportPhoto(reportId)
      .then((url) => {
        if (!active) {
          URL.revokeObjectURL(url);
          return;
        }
        currentUrl = url;
        setBlobUrl(url);
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setErrorMsg("Photo unavailable");
          setLoading(false);
        }
      });

    return () => {
      active = false;
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [reportId]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo proof for incident #${reportId}`}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-3xl bg-surface border border-border rounded-modal overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg">
          <div className="flex items-center gap-2 text-sm font-semibold text-text">
            <Camera className="w-4 h-4 text-accent stroke-[1.5]" />
            <span>
              Photo Proof — Incident #{reportId}
              {title ? `: ${title}` : ""}
            </span>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close photo lightbox"
            className="p-1.5 rounded-input text-muted hover:text-text hover:bg-surface border border-transparent hover:border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="w-5 h-5 stroke-[1.5]" />
          </button>
        </div>

        <div className="p-4 flex items-center justify-center min-h-[280px] max-h-[75vh] bg-bg">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-xs text-muted">
              <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <span>Loading photo proof...</span>
            </div>
          ) : errorMsg || !blobUrl ? (
            <div className="flex flex-col items-center gap-2 text-xs text-muted py-10">
              <AlertCircle className="w-7 h-7 stroke-[1.5]" />
              <span className="font-medium text-text">Photo unavailable</span>
              <span className="text-[11px] text-muted">
                Evidence file could not be loaded from storage.
              </span>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={blobUrl}
              alt={`Evidence photo for incident #${reportId}`}
              onLoad={(e) => {
                if (e.currentTarget.naturalWidth <= 1 && e.currentTarget.naturalHeight <= 1) {
                  setErrorMsg("Photo unavailable");
                }
              }}
              onError={() => setErrorMsg("Photo unavailable")}
              className="max-h-[68vh] w-auto max-w-full object-contain rounded"
            />
          )}
        </div>
      </div>
    </div>
  );
}

