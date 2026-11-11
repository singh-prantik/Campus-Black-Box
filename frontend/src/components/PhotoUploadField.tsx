"use client";

import React, { useRef, useState } from "react";
import { Upload, X, AlertCircle, Image as ImageIcon } from "lucide-react";
import toast from "react-hot-toast";

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

interface PhotoUploadFieldProps {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  label?: string;
}

function inferAllowedMimeType(file: File): string | null {
  const mime = (file.type || "").toLowerCase();
  if (mime === "image/jpg") return "image/jpeg";
  if (ALLOWED_MIME_TYPES.has(mime)) return mime;
  if (!mime) {
    const lowerName = (file.name || "").toLowerCase();
    if (lowerName.endsWith(".png")) return "image/png";
    if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
    if (lowerName.endsWith(".webp")) return "image/webp";
  }
  return null;
}

async function verifyImageDecodable(file: File, dataUrl: string): Promise<boolean> {
  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file);
      bitmap.close?.();
      return true;
    }
  } catch {
    return false;
  }

  return await new Promise<boolean>((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(img.naturalWidth > 0 && img.naturalHeight > 0);
    img.onerror = () => resolve(false);
    img.src = dataUrl;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read file data"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function PhotoUploadField({
  value,
  onChange,
  disabled = false,
  label = "Photo Evidence (Optional)",
}: PhotoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number; mime: string } | null>(null);
  const [reading, setReading] = useState(false);

  const resetInput = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleRemove = () => {
    resetInput();
    setFileInfo(null);
    setErrorMsg(null);
    onChange(null);
  };

  const processFile = async (file: File) => {
    setErrorMsg(null);

    const allowedMime = inferAllowedMimeType(file);
    if (!allowedMime) {
      const msg = "Unsupported file type. Please choose a PNG, JPEG, or WebP image.";
      setErrorMsg(msg);
      toast.error(msg);
      resetInput();
      return;
    }

    if (file.size <= 0) {
      const msg = "The selected image file is empty.";
      setErrorMsg(msg);
      toast.error(msg);
      resetInput();
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      const msg = `Photo exceeds the 5 MB maximum limit (${formatBytes(file.size)} selected).`;
      setErrorMsg(msg);
      toast.error(msg);
      resetInput();
      return;
    }

    setReading(true);
    try {
      let dataUrl = await readFileAsDataUrl(file);
      if (!dataUrl.startsWith(`data:${allowedMime};base64,`)) {
        const commaIdx = dataUrl.indexOf(",");
        if (commaIdx !== -1) {
          dataUrl = `data:${allowedMime};base64,${dataUrl.slice(commaIdx + 1)}`;
        }
      }

      const validImage = await verifyImageDecodable(file, dataUrl);
      if (!validImage) {
        const msg = "Could not decode image. Please select a valid PNG, JPEG, or WebP file.";
        setErrorMsg(msg);
        toast.error(msg);
        resetInput();
        return;
      }

      // Preserve original bytes verbatim without re-encoding or flattening alpha to black
      setFileInfo({ name: file.name, size: file.size, mime: allowedMime });
      onChange(dataUrl);
      toast.success("Photo attached");
    } catch (err: any) {
      const msg = err?.message || "Failed to read selected photo";
      setErrorMsg(msg);
      toast.error(msg);
      resetInput();
    } finally {
      setReading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const openFilePicker = () => {
    if (!disabled && !reading) {
      inputRef.current?.click();
    }
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-text mb-1.5">
        {label}
      </label>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleInputChange}
        disabled={disabled || reading}
        className="sr-only"
        aria-label="Choose incident photo"
        data-testid="photo-file-input"
      />

      {value ? (
        <div className="rounded-input overflow-hidden border border-border bg-surface shadow-sm">
          {/* White backdrop ensures PNG images with alpha transparency never render black */}
          <div className="relative bg-white flex items-center justify-center p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Attached incident evidence preview"
              data-testid="photo-preview-img"
              className="max-h-52 w-full object-contain rounded"
            />
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              aria-label="Remove attached photo"
              data-testid="photo-remove-btn"
              className="absolute top-2.5 right-2.5 px-2.5 py-1.5 rounded-lg bg-slate-900/85 hover:bg-slate-900 text-white text-xs font-medium flex items-center gap-1 shadow transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Remove
            </button>
          </div>
          {fileInfo && (
            <div className="px-3 py-2 border-t border-border flex items-center justify-between text-xs text-muted bg-bg">
              <span className="flex items-center gap-1.5 truncate font-medium text-text">
                <ImageIcon className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="truncate">{fileInfo.name}</span>
              </span>
              <span className="shrink-0 ml-2 font-mono">{formatBytes(fileInfo.size)}</span>
            </div>
          )}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={openFilePicker}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openFilePicker();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled) setDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled) setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);
            if (disabled || reading) return;
            const dropped = e.dataTransfer?.files?.[0];
            if (dropped) {
              void processFile(dropped);
            }
          }}
          data-testid="photo-dropzone"
          className={`border border-dashed rounded-input p-6 text-center cursor-pointer transition-colors ${
            dragActive
              ? "border-accent bg-accent/5"
              : "border-border hover:border-accent bg-bg"
          } ${disabled || reading ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <Upload className="w-6 h-6 text-muted mx-auto stroke-[1.5] mb-2" />
          <p className="text-xs font-medium text-text">
            {reading ? "Reading photo..." : "Click to attach photo evidence or drag & drop"}
          </p>
          <p className="text-[11px] text-muted mt-0.5">
            Supports PNG, JPEG, WebP up to 5 MB (camera or gallery)
          </p>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="mt-2 flex items-start gap-2 rounded-input border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
