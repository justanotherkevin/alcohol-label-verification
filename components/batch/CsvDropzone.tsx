"use client";

import { useRef, useState } from "react";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isCsvFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
}

interface CsvDropzoneProps {
  file: File | null;
  onFileSelected: (file: File | null) => void;
  disabled?: boolean;
}

export function CsvDropzone({ file, onFileSelected, disabled }: CsvDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rejected, setRejected] = useState(false);
  const dragDepth = useRef(0);

  function openPicker() {
    if (!disabled) inputRef.current?.click();
  }

  function handleFiles(fileList: FileList | null) {
    const picked = fileList?.[0];
    if (!picked) return;
    if (!isCsvFile(picked)) {
      setRejected(true);
      setTimeout(() => setRejected(false), 1600);
      return;
    }
    onFileSelected(picked);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          dragDepth.current += 1;
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragDepth.current = 0;
          setIsDragging(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        className={`relative overflow-hidden rounded-xl border-2 border-dashed px-8 py-12 flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer ${
          disabled ? "cursor-not-allowed opacity-60 border-outline bg-surface-dim"
          : rejected ? "border-bp-error bg-bp-error-surface"
          : isDragging ? "border-primary bg-primary/5 scale-[1.01] shadow-lg"
          : file ? "border-bp-success-border bg-bp-success-surface"
          : "border-outline bg-surface-card hover:border-primary/60 hover:bg-surface-dim"
        }`}>
        {/* Subtle top accent bar for a bit of visual polish */}
        <div
          className={`absolute top-0 left-0 right-0 h-1 transition-colors ${
            isDragging ? "bg-primary" : file ? "bg-bp-success" : "bg-outline"
          }`}
        />

        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-all duration-200 ${
            isDragging ? "bg-primary text-white scale-110"
            : file ? "bg-bp-success-surface text-bp-success border-2 border-bp-success-border"
            : "bg-surface-dim text-on-surface-muted"
          }`}>
          <span className="material-symbols-outlined text-[32px]">
            {file ? "check_circle" : "upload"}
          </span>
        </div>

        {file ?
          <>
            <p className="text-base font-semibold text-on-surface">{file.name}</p>
            <p className="text-sm text-on-surface-muted mt-1">{formatBytes(file.size)}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFileSelected(null);
              }}
              className="mt-4 text-sm font-semibold text-bp-error hover:underline cursor-pointer">
              Remove and choose a different file
            </button>
          </>
        : <>
            <p className="text-base font-semibold text-on-surface">
              {isDragging ? "Drop your CSV here" : "Drag and drop your CSV here"}
            </p>
            <p className="text-sm text-on-surface-muted mt-1">
              or <span className="text-primary font-semibold">click to browse</span>
            </p>
            <p className="text-sm text-on-surface-muted mt-4">.csv files only, up to 2MB</p>
          </>
        }

        {rejected && (
          <p className="absolute bottom-3 text-sm font-semibold text-bp-error">
            That doesn&apos;t look like a CSV file
          </p>
        )}
      </div>
    </div>
  );
}
