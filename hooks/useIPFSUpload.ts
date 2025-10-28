"use client";

import { useState } from "react";
import { ThirdwebStorage } from "@thirdweb-dev/storage";

export function useIPFSUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string>("");

  // ✅ get client id from env
  const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

  // ✅ include clientId here
  const storage = new ThirdwebStorage({
    clientId,
  });

  const uploadFile = async (file: File): Promise<string> => {
    try {
      setUploading(true);
      setProgress(`Uploading ${file.name}...`);
      const uri = await storage.upload(file);
      return uri;
    } catch (err) {
      console.error("❌ IPFS file upload failed:", err);
      throw err;
    } finally {
      setUploading(false);
      setProgress("");
    }
  };

  const uploadMetadata = async (metadata: any): Promise<string> => {
    try {
      setUploading(true);
      setProgress("Uploading profile metadata to IPFS...");
      const uri = await storage.upload(metadata);
      return uri;
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
