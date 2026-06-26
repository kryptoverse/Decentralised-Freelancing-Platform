"use client";

import { Upload } from "lucide-react";

interface FileUploadButtonProps {
  /** Accept attribute for the underlying input (e.g. "image/*") */
  accept?: string;
  /** Change handler — receives the native file input event */
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Button label, e.g. "Upload Image" / "Choose File" */
  label?: string;
  /** Shown when a file already exists, e.g. "Change Image" */
  replaceLabel?: string;
  /** Whether a file has already been selected/uploaded */
  hasFile?: boolean;
  /** Disable the button (e.g. while uploading) */
  disabled?: boolean;
  /** Optional extra classes for the button */
  className?: string;
}

/**
 * A clearly-labelled, styled upload button that wraps a hidden file input.
 * Use this instead of a bare <input type="file"> so users immediately
 * understand they can click to select a file.
 */
export function FileUploadButton({
  accept,
  onChange,
  label = "Upload File",
  replaceLabel,
  hasFile = false,
  disabled = false,
  className = "",
}: FileUploadButtonProps) {
  const text = hasFile ? replaceLabel ?? `Change ${label.replace(/^Upload\s+/i, "")}` : label;

  return (
    <label
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
        bg-primary text-primary-foreground text-sm font-medium cursor-pointer
        hover:opacity-90 active:scale-95 transition-all shadow-sm
        ${disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}
        ${className}`}
    >
      <Upload className="w-4 h-4" />
      <span>{text}</span>
      <input
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={onChange}
      />
    </label>
  );
}
