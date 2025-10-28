"use client";

import { useState } from "react";
import {
  getContract,
  prepareContractCall,
  sendTransaction,
} from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";

interface ProfileEditProps {
  profileAddress: string;
  initialProfile: {
    name: string;
    bio: string;
    profileURI: string;
  };
  onUpdated(updated: { name: string; bio: string; profileURI: string }): void;
}

/**
 * ✅ ProfileEdit Component
 * Matches FreelancerProfile.sol's updateProfile(string name, string bio, string profileURI)
 * Works with Smart Accounts + sponsored gas setup.
 */
export function ProfileEdit({
  profileAddress,
  initialProfile,
  onUpdated,
}: ProfileEditProps) {
  const account = useActiveAccount();

  const [form, setForm] = useState({
    name: initialProfile.name,
    bio: initialProfile.bio,
    profileURI: initialProfile.profileURI,
  });

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!account) {
      setMsg("⚠️ Please connect your wallet first.");
      return;
    }

    try {
      setLoading(true);
      setMsg("📝 Saving changes on-chain...");

      const profileContract = getContract({
        client,
        chain: CHAIN,
        address: profileAddress as `0x${string}`,
      });

      // ✅ Match ABI: updateProfile(string,string,string)
      const tx = await prepareContractCall({
        contract: profileContract,
        method:
          "function updateProfile(string _name, string _bio, string _profileURI)",
        params: [form.name, form.bio, form.profileURI],
      });

      await sendTransaction({
        account,
        transaction: tx,
      });

      setMsg("✅ Profile updated successfully!");
      onUpdated({ ...form });
    } catch (err: any) {
      console.error("❌ Update profile failed:", err);
      setMsg("❌ Transaction reverted — check console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-6 rounded-2xl glass-effect border border-border shadow-md space-y-4"
    >
      <div className="text-sm text-foreground-secondary">
        Editing profile contract:
        <span className="font-mono text-primary block break-all">
          {profileAddress}
        </span>
      </div>

      <div>
        <label className="block text-sm mb-1 font-medium">Name</label>
        <input
          name="name"
          required
          value={form.name}
          onChange={handleChange}
          placeholder="Your display name"
          className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm mb-1 font-medium">Bio</label>
        <textarea
          name="bio"
          required
          rows={4}
          value={form.bio}
          onChange={handleChange}
          placeholder="Tell clients who you are and what you do."
          className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none resize-none"
        />
      </div>

      <div>
        <label className="block text-sm mb-1 font-medium">
          Profile Metadata URI (optional)
        </label>
        <input
          name="profileURI"
          value={form.profileURI}
          onChange={handleChange}
          placeholder="ipfs:// or https:// link to profile metadata"
          className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none"
        />
      </div>

      <button
        disabled={loading}
        type="submit"
        className="px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition w-full font-medium"
      >
        {loading ? "Saving..." : "Save Changes"}
      </button>

      {msg && (
        <p
          className={`text-sm mt-2 ${
            msg.includes("❌")
              ? "text-red-500"
              : msg.includes("✅")
              ? "text-green-500"
              : "text-foreground-secondary"
          }`}
        >
          {msg}
        </p>
      )}
    </form>
  );
}
