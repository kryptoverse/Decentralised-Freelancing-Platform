"use client";

import { useState } from "react";

export function useIPFSUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string>("");

  // 🧩 Upload a File -> returns ipfs://CID
  const uploadFile = async (
    file: File,
    options?: { name?: string; previousCid?: string }
  ): Promise<string> => {
    try {
      setUploading(true);
      setProgress(`Uploading ${file.name}...`);

      const formData = new FormData();
      formData.append("file", file);
      if (options?.name) formData.append("name", options.name);
      if (options?.previousCid) formData.append("previousCid", options.previousCid);

      const res = await fetch("/api/files", { method: "POST", body: formData });
      const json = await res.json();

      if (!res.ok || !json.cid) throw new Error(json.error || "Upload failed");

      return `ipfs://${json.cid}`;
    } catch (err) {
      console.error("❌ File upload failed:", err);
      throw err;
    } finally {
      setUploading(false);
      setProgress("");
    }
  };

  // 🧩 Upload JSON Metadata -> returns ipfs://CID
  const uploadMetadata = async (
    metadata: any,
    options?: { name?: string; previousCid?: string }
  ): Promise<string> => {
    try {
      setUploading(true);
      setProgress("Uploading metadata...");

      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: metadata, name: options?.name, previousCid: options?.previousCid }),
      });

      const json = await res.json();
      if (!res.ok || !json.cid) throw new Error(json.error || "Upload failed");

      return `ipfs://${json.cid}`;
    } catch (err) {
      console.error("❌ Metadata upload failed:", err);
      throw err;
    } finally {
      setUploading(false);
      setProgress("");
    }
  };

  return { uploadFile, uploadMetadata, uploading, progress };
}
