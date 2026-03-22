"use client";

import { useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { getContract, readContract, prepareContractCall, sendTransaction } from "thirdweb";
import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { ipfsToHttp } from "@/utils/ipfs";
import { useIPFSUpload } from "@/hooks/useIPFSUpload";
import { Loader2, User as UserIcon, Edit2, Copy, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export default function InvestorProfilePage() {
  const account = useActiveAccount();
  const { uploadMetadata } = useIPFSUpload();

  const [loading, setLoading] = useState(true);
  const [profileExists, setProfileExists] = useState(false);
  const [profileData, setProfileData] = useState<{ name: string; bio: string; ipfsUri: string } | null>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [form, setForm] = useState({ name: "", bio: "" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!account) {
      setLoading(false);
      return;
    }

    async function loadProfile() {
      if (!account?.address) return;
      try {
        setLoading(true);
        const reg = getContract({
          client, chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.InvestorRegistry as `0x${string}`
        });

        const [uri, exists] = await readContract({
          contract: reg, 
          method: "function profiles(address) view returns (string,bool)",
          params: [account.address as `0x${string}`]
        }) as [string, boolean];

        setProfileExists(exists);
        if (exists && uri) {
          try {
             // Fetch from IPFS
             const res = await fetch(ipfsToHttp(uri));
             const metadata = await res.json();
             setProfileData({
                name: metadata.name || "",
                bio: metadata.bio || "",
                ipfsUri: uri
             });
             setForm({
                name: metadata.name || "",
                bio: metadata.bio || ""
             });
          } catch(e) {
             console.error("Failed to parse IPFS metadata:", e);
          }
        }
      } catch (e) {
        console.error("❌ Load investor profile error:", e);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [account]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!account || !form.name) return;
    setSavingProfile(true);
    try {
      const uri = await uploadMetadata({ name: form.name, bio: form.bio }, { name: `investor_${account.address}` });
      const reg = getContract({ client, chain: CHAIN, address: DEPLOYED_CONTRACTS.addresses.InvestorRegistry as `0x${string}` });
      const tx = prepareContractCall({ contract: reg, method: "function registerProfile(string)", params: [uri] });
      await sendTransaction({ transaction: tx, account });
      
      setProfileData({ name: form.name, bio: form.bio, ipfsUri: uri });
      setProfileExists(true);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save profile. See console.");
    } finally {
      setSavingProfile(false);
    }
  }

  function copyAddress() {
    if (!account) return;
    navigator.clipboard.writeText(account.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!account) {
    return (
      <section className="p-4 md:p-6 lg:p-8 space-y-6 max-w-3xl w-full mx-auto">
        <h1 className="text-3xl font-bold gradient-text">My Profile</h1>
        <p className="text-muted-foreground">Please connect your wallet.</p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="p-4 md:p-6 lg:p-8 flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </section>
    );
  }

  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 md:p-6 lg:p-8 space-y-6 max-w-3xl w-full mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
        <div>
           <h1 className="text-3xl font-bold gradient-text">Investor Profile</h1>
           <p className="text-muted-foreground text-sm mt-1">Manage your public investment identity</p>
        </div>
        {profileExists && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-4 py-2 gradient-primary text-white text-sm font-medium rounded-xl w-full sm:w-auto hover:opacity-90 transition-opacity"
          >
            <Edit2 className="w-4 h-4" /> Edit Profile
          </button>
        )}
      </div>

      {(!profileExists || isEditing) ? (
        <div className="glass-effect rounded-2xl p-6 border border-border">
          <h2 className="text-xl font-bold mb-4">{profileExists ? "Edit Profile" : "Create Profile"}</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Your public profile will be visible to founders and freelancers on the platform. Stored immutably on IPFS.
          </p>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Display Name *</label>
              <input required type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all"
                placeholder="E.g. Web3 Capital" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Short Bio (Optional)</label>
              <textarea rows={4} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })}
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all resize-none"
                placeholder="Tell others about your investment thesis..." />
            </div>
            <div className="flex gap-3 pt-2">
                <button type="submit" disabled={savingProfile || !form.name}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center gap-2">
                  {savingProfile ? <><Loader2 className="w-4 h-4 animate-spin" /> {profileExists ? "Updating..." : "Creating..."}</> : (profileExists ? "Save Changes" : "Create Profile")}
                </button>
                {profileExists && (
                   <button type="button" onClick={() => { setIsEditing(false); setForm({ name: profileData?.name || "", bio: profileData?.bio || "" }); }}
                     className="px-6 py-3 rounded-xl border border-border bg-surface hover:bg-surface-secondary text-sm font-semibold transition-colors">
                     Cancel
                   </button>
                )}
            </div>
          </form>
        </div>
      ) : (
        <div className="glass-effect rounded-2xl p-6 border border-border space-y-6">
           <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-surface-secondary border border-border flex items-center justify-center shrink-0">
                 <UserIcon className="w-8 h-8 text-primary" />
              </div>
              <div className="pt-1">
                 <h2 className="text-2xl font-bold">{profileData?.name}</h2>
                 <button onClick={copyAddress} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mt-1 font-mono">
                    {account.address.slice(0, 8)}...{account.address.slice(-6)}
                    {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                 </button>
              </div>
           </div>
           
           <div className="bg-surface rounded-xl p-4 border border-border/50">
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                 {profileData?.bio || "No bio provided."}
              </p>
           </div>
           
           <div className="text-xs text-muted-foreground border-t border-border pt-4 break-all">
              <span className="font-semibold">IPFS Profile Hash:</span> <br/><a href={ipfsToHttp(profileData?.ipfsUri || "")} target="_blank" rel="noreferrer" className="text-primary hover:underline">{profileData?.ipfsUri}</a>
           </div>
        </div>
      )}
    </motion.section>
  );
}
