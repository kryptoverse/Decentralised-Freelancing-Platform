"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { getContract, prepareContractCall, sendTransaction } from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { useIPFSUpload } from "@/hooks/useIPFSUpload";

interface PostJobFormProps {
  onJobPosted?: (jobId: number) => void;
  onCancel?: () => void;
}

export function PostJobForm({ onJobPosted, onCancel }: PostJobFormProps) {
  const account = useActiveAccount();
  const { uploadMetadata, uploading, progress } = useIPFSUpload();

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    budgetUSDC: "",
    tags: "",
    expiresInDays: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) {
      setMsg("⚠️ Please connect your wallet first.");
      return;
    }

    try {
      setLoading(true);
      setMsg("🚀 Uploading job description to IPFS...");

      // 1️⃣ Upload job description to IPFS
      const descriptionData = {
        description: form.description,
        requirements: "",
        deliverables: "",
      };
      
      const walletPrefix = account.address.replace('0x', '').toLowerCase().slice(0, 10);
      const metadataName = `${walletPrefix}_job-description`;
      const descriptionURI = await uploadMetadata(descriptionData, { name: metadataName });

      setMsg("📝 Posting job to blockchain...");

      // 2️⃣ Convert tags string to bytes32 array
      const tagsArray = form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
        .slice(0, 5) // Max 5 tags
        .map((tag) => {
          // Convert string to bytes32 (exactly 32 bytes, right-padded with zeros)
          const encoder = new TextEncoder();
          const bytes = encoder.encode(tag);
          if (bytes.length > 32) {
            // Truncate if longer than 32 bytes
            const truncated = bytes.slice(0, 32);
            return `0x${Array.from(truncated)
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("")
              .padEnd(64, "0")}` as `0x${string}`;
          }
          // Pad to exactly 64 hex characters (32 bytes)
          const hex = Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
            .padEnd(64, "0");
          return `0x${hex}` as `0x${string}`;
        });

      // 3️⃣ Calculate expiry timestamp
      const expiresInDays = form.expiresInDays ? parseInt(form.expiresInDays) : 0;
      const expiresAt = expiresInDays > 0 
        ? BigInt(Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60)
        : 0n;

      // 4️⃣ Convert budget to USDC (6 decimals for USDT/USDC)
      const budgetUSDC = BigInt(Math.floor(parseFloat(form.budgetUSDC) * 1e6));

      // 5️⃣ Call JobBoard.postJob()
      const jobBoard = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.JobBoard,
      });

      const tx = await prepareContractCall({
        contract: jobBoard,
        method: "function postJob(string,string,uint256,bytes32[],uint64) returns (uint256)",
        params: [
          form.title,
          descriptionURI,
          budgetUSDC,
          tagsArray.length > 0 ? tagsArray : [],
          expiresAt,
        ],
      });

      const receipt = await sendTransaction({ account, transaction: tx });
      
      // Extract jobId from events (if available) or use a workaround
      setMsg("✅ Job posted successfully! Waiting for confirmation...");
      
      // Wait a bit for the transaction to be mined
      setTimeout(() => {
        setMsg("✅ Job posted successfully!");
        onJobPosted?.(0); // Job ID will be available from events
      }, 2000);
    } catch (err: any) {
      console.error("❌ Failed to post job:", err);
      setMsg(`❌ Failed to post job: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <form onSubmit={handleSubmit} className="space-y-6 p-6 rounded-2xl glass-effect border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-primary">Post a New Job</h2>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-foreground-secondary hover:text-foreground"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Job Title */}
        <div>
          <label className="block text-sm mb-1 font-medium">Job Title</label>
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            required
            placeholder="e.g. Senior Web3 Developer Needed"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Job Description */}
        <div>
          <label className="block text-sm mb-1 font-medium">Job Description</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            required
            rows={6}
            placeholder="Describe the project, requirements, deliverables, and timeline..."
            className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>

        {/* Budget */}
        <div>
          <label className="block text-sm mb-1 font-medium">Budget (USDT)</label>
          <input
            name="budgetUSDC"
            type="number"
            step="0.01"
            min="0"
            value={form.budgetUSDC}
            onChange={handleChange}
            required
            placeholder="e.g. 500"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-foreground-secondary mt-1">
            Amount in USDT that will be locked in escrow when freelancer is hired
          </p>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm mb-1 font-medium">Tags (comma-separated, max 5)</label>
          <input
            name="tags"
            value={form.tags}
            onChange={handleChange}
            placeholder="e.g. React, Solidity, Web3, Frontend"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-foreground-secondary mt-1">
            Help freelancers find your job (optional)
          </p>
        </div>

        {/* Expiry */}
        <div>
          <label className="block text-sm mb-1 font-medium">Expires In (days, optional)</label>
          <input
            name="expiresInDays"
            type="number"
            min="0"
            value={form.expiresInDays}
            onChange={handleChange}
            placeholder="e.g. 30 (leave empty for no expiry)"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-foreground-secondary mt-1">
            Job will automatically close after this many days (optional)
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || uploading}
          className="w-full px-5 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading || uploading ? progress || "Posting Job..." : "Post Job"}
        </button>

        {msg && (
          <p className={`text-sm ${msg.startsWith("✅") ? "text-green-400" : msg.startsWith("❌") ? "text-red-400" : "text-foreground-secondary"}`}>
            {msg}
          </p>
        )}
      </form>
    </motion.div>
  );
}

