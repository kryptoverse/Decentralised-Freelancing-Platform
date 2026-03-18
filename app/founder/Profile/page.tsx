"use client";

import { useEffect, useState, useCallback } from "react";
import { useActiveAccount, useActiveWallet } from "thirdweb/react";
import { getContract, readContract } from "thirdweb";
import { motion } from "framer-motion";
import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import Link from "next/link";
import { 
  Copy, Check, Info, Briefcase, User, Coins, Landmark,
  Shield, Rocket, ExternalLink, Users, Building2, RefreshCw, Loader2,
  ChevronRight
} from "lucide-react";

function getGatewayUrl(uri: string | undefined) {
  if (!uri) return undefined;
  if (uri.startsWith("ipfs://")) {
    return `https://gateway.pinata.cloud/ipfs/${uri.replace("ipfs://", "")}`;
  }
  return uri;
}

interface CompanyMeta {
  name?: string;
  description?: string;
  website?: string;
  twitter?: string;
  ceoName?: string;
  services?: string;
  products?: string;
  productLink?: string;
  image?: string;
}

interface CompanyProfile {
  id: bigint;
  token: string;
  vault: string;
  sector: string;
  owner: string;
  meta: CompanyMeta;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

export default function FounderProfilePage() {
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const fetchProfile = useCallback(async (isManual = false) => {
    if (!account) return;
    if (isManual) setRefreshing(true);
    else setLoading(true);
    
    setNotFound(false);
    try {
      // Get EOA address as well in case ownership was via EOA
      let eoaAddress: string | undefined;
      try {
        const pa = (activeWallet as any).getAdminAccount?.();
        if (pa?.address) eoaAddress = pa.address.toLowerCase();
      } catch {}

      const swAddress = account.address.toLowerCase();
      const registry = getContract({ client, chain: CHAIN, address: DEPLOYED_CONTRACTS.addresses.CompanyRegistry as any });
      const total = await readContract({ contract: registry, method: "function totalCompanies() view returns (uint256)" }) as bigint;

      for (let i = total; i >= BigInt(1); i--) {
        const c = await readContract({
          contract: registry,
          method: "function getCompany(uint256) view returns ((address owner, address token, address sale, address vault, address distributor, string metadataURI, string sector, bool exists))",
          params: [i]
        }) as any;

        const ownerLower = c.owner.toLowerCase();
        if (c.exists && (ownerLower === swAddress || (eoaAddress && ownerLower === eoaAddress))) {
          let meta: CompanyMeta = {};
          if (c.metadataURI) {
            try {
              const r = await fetch(`https://gateway.pinata.cloud/ipfs/${c.metadataURI.replace("ipfs://", "")}`);
              meta = await r.json();
            } catch {}
          }
          setCompany({ id: i, token: c.token, vault: c.vault, sector: c.sector, owner: c.owner, meta });
          setNotFound(false);
          break;
        } else if (i === BigInt(1)) {
           setNotFound(true);
        }
      }
    } catch (err) {
      console.error(err);
      setNotFound(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [account, activeWallet]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  if (!account) return (
    <div className="flex h-full items-center justify-center">
      <p className="text-muted-foreground">Please connect your wallet.</p>
    </div>
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
      <p className="mt-4 text-muted-foreground">Loading your company profile...</p>
    </div>
  );

  if (notFound || !company) return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      <div className="w-20 h-20 bg-surface border border-border rounded-2xl flex items-center justify-center mb-6 shadow-xl">
        <Building2 className="w-10 h-10 text-muted-foreground/30" />
      </div>
      <h2 className="text-2xl font-bold mb-2">No Company Found</h2>
      <p className="text-muted-foreground max-w-md">You haven't launched a company yet, or your wallet isn't linked to one.</p>
      
      <div className="flex gap-4 mt-8">
        <Link href="/founder" className="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:opacity-90 transition-opacity">
          Go to Dashboard
        </Link>
        <button onClick={() => fetchProfile(true)} className="px-6 py-3 bg-surface border border-border rounded-xl font-semibold flex items-center gap-2 hover:bg-surface-secondary transition-colors">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 px-4 mt-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Company Profile</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage your on-chain corporate presence and visibility.</p>
        </div>
        
        <div className="flex items-center gap-3">
           <button 
             onClick={() => fetchProfile(true)}
             disabled={refreshing}
             className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-surface-secondary transition-colors text-sm font-medium disabled:opacity-50"
           >
             <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
             Refresh
           </button>
           <Link href={`/founder/Company/${company.id.toString()}`} target="_blank"
             className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium text-sm transition-opacity hover:opacity-90 shadow-sm"
           >
             Public View <ExternalLink className="w-4 h-4" />
           </Link>
        </div>
      </div>

      {/* Main Hero Card */}
      <div className="glass-effect rounded-2xl border border-border overflow-hidden">
        {/* Cover Pattern */}
        <div className="h-32 w-full bg-surface-secondary border-b border-border relative overflow-hidden">
             <div className="absolute inset-0 bg-grid-black/[0.02] dark:bg-grid-white/[0.02] bg-[size:20px_20px]"></div>
             <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-blue-500/10"></div>
        </div>

        <div className="px-8 pb-8">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-end -mt-12">
              <div className="w-24 h-24 rounded-xl bg-surface border-4 border-background flex items-center justify-center shadow-lg overflow-hidden shrink-0">
                {getGatewayUrl(company.meta?.image) ? (
                  <img src={getGatewayUrl(company.meta.image)} alt={company.meta.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-surface-secondary flex items-center justify-center text-foreground font-bold text-3xl">
                     {company.meta?.name ? company.meta.name.substring(0, 2).toUpperCase() : "CO"}
                  </div>
                )}
              </div>
              
              <div className="flex-1 pb-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-2xl font-bold text-foreground">
                      {company.meta?.name || `Company #${company.id.toString()}`}
                    </h2>
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wider">
                      <Shield className="w-3 h-3" /> Verified
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground font-medium">
                    <span className="flex items-center gap-1.5">
                      <Rocket className="w-4 h-4 text-primary w-4 h-4" /> {company.sector}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-border"></span>
                    <span className="flex items-center gap-1.5">
                       <Users className="w-4 h-4" /> Built on Thirdweb
                    </span>
                  </div>
              </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (Details) */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="glass-effect rounded-2xl border border-border p-6 space-y-4">
             <h3 className="font-semibold text-foreground flex items-center gap-2">
                 <Building2 className="w-5 h-5 text-primary" /> About Us
             </h3>
             <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
                 {company.meta?.description || "No description provided. Update your company metadata to add a description."}
             </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="glass-effect rounded-2xl border border-border p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-surface rounded-lg text-muted-foreground">
                    <User className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-medium text-muted-foreground">Executive Leadership</h4>
                </div>
                <p className="text-lg font-semibold text-foreground ml-11">{company.meta?.ceoName || "Not specified"}</p>
             </div>

             <div className="glass-effect rounded-2xl border border-border p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-surface rounded-lg text-muted-foreground">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-medium text-muted-foreground">Core Services</h4>
                </div>
                <p className="text-lg font-semibold text-foreground ml-11">{company.meta?.services || "Not specified"}</p>
             </div>
          </div>

          {/* Noteworthy Products */}
          {(company.meta?.products || company.meta?.productLink) && (
            <div className="glass-effect rounded-2xl border border-border p-6 group">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                        <h4 className="text-sm font-medium text-primary flex items-center gap-2 mb-2 uppercase tracking-wide">
                            <Rocket className="w-4 h-4" /> Flagship Product
                        </h4>
                        <p className="text-xl font-bold">{company.meta?.products || "Innovation Alpha"}</p>
                        <p className="text-sm text-muted-foreground">Our primary offering in the {company.sector} market.</p>
                    </div>
                    {company.meta?.productLink && (
                        <a href={company.meta.productLink} target="_blank" rel="noopener noreferrer"
                           className="shrink-0 px-5 py-2.5 bg-surface border border-border hover:bg-surface-secondary text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
                        >
                            View Product <ExternalLink className="w-4 h-4" />
                        </a>
                    )}
                </div>
            </div>
          )}
        </div>

        {/* Right Column (Sidebar) */}
        <div className="space-y-6">
          
          <div className="glass-effect rounded-2xl border border-border p-6 space-y-4">
             <h3 className="font-semibold text-foreground flex items-center gap-2 pb-2 border-b border-border">
                Links & Contacts
             </h3>
             <div className="space-y-3">
                {company.meta?.website ? (
                    <a href={company.meta.website} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-xl bg-surface hover:bg-surface-secondary border border-border transition-colors text-sm font-medium">
                        <div className="flex items-center gap-3 text-foreground">
                            <ExternalLink className="w-4 h-4 text-muted-foreground" /> Website
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-50" />
                    </a>
                ) : (
                    <div className="p-3 text-sm text-muted-foreground bg-surface/50 rounded-xl border border-transparent">No website added</div>
                )}
                
                {company.meta?.twitter ? (
                    <a href={`https://twitter.com/${company.meta.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-xl bg-surface hover:bg-surface-secondary border border-border transition-colors text-sm font-medium">
                        <div className="flex items-center gap-3 text-foreground">
                            <svg className="w-4 h-4 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> 
                            Twitter / X
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-50" />
                    </a>
                ) : (
                    <div className="p-3 text-sm text-muted-foreground bg-surface/50 rounded-xl border border-transparent">No Twitter added</div>
                )}
             </div>
          </div>

          <div className="glass-effect rounded-2xl border border-border p-6 space-y-5">
             <h3 className="font-semibold text-foreground flex items-center gap-2 pb-2 border-b border-border">
                On-Chain Details
             </h3>
             
             <div className="space-y-4">
                 {[
                   { label: "Company ID", val: `#${company.id.toString()}` },
                   { label: "Share Token", val: company.token },
                   { label: "Treasury Vault", val: company.vault },
                 ].map(item => (
                   <div key={item.label} className="space-y-1.5 focus-within:ring-1 focus-within:ring-primary/20 rounded-lg">
                       <div className="flex justify-between items-center">
                           <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                       </div>
                       <div className="flex items-center justify-between bg-surface border border-border rounded-lg p-2.5">
                           <span className="text-xs font-mono text-foreground truncate mr-3">{item.val}</span>
                           <button onClick={() => copyToClipboard(item.val)} className="p-1 hover:bg-surface-secondary rounded text-muted-foreground hover:text-foreground transition-colors shrink-0" title="Copy to clipboard">
                               <Copy className="w-3.5 h-3.5" />
                           </button>
                       </div>
                   </div>
                 ))}
             </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
