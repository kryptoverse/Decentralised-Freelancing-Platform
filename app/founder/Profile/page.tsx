"use client";

import { useEffect, useState, useCallback } from "react";
import { useActiveAccount, useActiveWallet } from "thirdweb/react";
import { getContract, readContract } from "thirdweb";
import { motion, Variants } from "framer-motion";
import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import Link from "next/link";
import { 
  Copy, Check, Info, Briefcase, User, Coins, Landmark,
  Shield, Rocket, ExternalLink, Users, Building2, RefreshCw, Loader2,
  ChevronRight, Twitter, Globe, Link as LinkIcon, ArrowUpRight
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
  productsList?: { name: string; link: string }[];
  image?: string;
  tokenImage?: string;
}

interface CompanyProfile {
  id: bigint;
  token: string;
  vault: string;
  sector: string;
  owner: string;
  meta: CompanyMeta;
}

// Animation variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};

export default function FounderProfilePage() {
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notFound, setNotFound] = useState(false);
  
  const [imgError, setImgError] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchProfile = useCallback(async (isManual = false) => {
    if (!account) return;
    if (isManual) setRefreshing(true);
    else setLoading(true);
    
    setNotFound(false);
    setImgError(false); // Reset image error state on refresh
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
    <div className="flex h-full items-center justify-center min-h-[60vh]">
      <div className="text-center p-8 bg-surface border border-border rounded-3xl backdrop-blur-xl shadow-sm">
        <Shield className="w-12 h-12 text-primary/50 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">Authentication Required</h3>
        <p className="text-muted-foreground">Please connect your wallet to view your corporate profile.</p>
      </div>
    </div>
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-24">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
        <Loader2 className="w-12 h-12 text-primary animate-spin relative z-10" />
      </div>
      <p className="mt-6 text-muted-foreground font-medium animate-pulse tracking-widest uppercase text-sm">Synchronizing On-Chain Profile...</p>
    </div>
  );

  if (notFound || !company) return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center min-h-[60vh] py-24 text-center px-4">
      <div className="w-24 h-24 bg-gradient-to-br from-surface to-background border border-border rounded-[2rem] flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(0,0,0,0.05)]">
        <Building2 className="w-10 h-10 text-muted-foreground/30" />
      </div>
      <h2 className="text-3xl font-black mb-3 text-foreground">No Entity Found</h2>
      <p className="text-muted-foreground max-w-md mb-8">You haven't incorporated on-chain yet, or your active wallet is not registered as an entity owner.</p>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <Link href="/founder" className="px-8 py-3.5 bg-primary text-primary-foreground rounded-xl font-black uppercase tracking-widest text-sm hover:opacity-90 active:scale-95 transition-all shadow-sm">
          Go to Dashboard
        </Link>
        <button onClick={() => fetchProfile(true)} className="px-8 py-3.5 bg-surface border border-border text-foreground rounded-xl font-bold tracking-wider text-sm flex items-center justify-center gap-2 hover:bg-surface-secondary active:scale-95 transition-all">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh Verification
        </button>
      </div>
    </motion.div>
  );

  const avatarUrl = getGatewayUrl(company.meta?.image);

  return (
    <motion.div 
      variants={containerVariants} 
      initial="hidden" 
      animate="visible"
      className="max-w-6xl mx-auto space-y-8 pb-24 px-4 mt-8"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-surface p-6 rounded-[2rem] border border-border backdrop-blur-md">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">Corporate Registry Profile</h1>
          <p className="text-muted-foreground mt-2 text-sm font-medium">Verify and manage your on-chain corporate presence and public visibility.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
           <button 
             onClick={() => fetchProfile(true)}
             disabled={refreshing}
             className="flex-1 md:flex-none flex justify-center items-center gap-2 px-5 py-2.5 bg-surface-secondary border border-border rounded-xl hover:bg-surface transition-all text-sm font-bold text-foreground disabled:opacity-50 group"
           >
             <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`} />
             Refresh
           </button>
           <Link href={`/founder/Company/${company.id.toString()}`}
             className="flex-1 md:flex-none flex justify-center items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-black uppercase tracking-widest text-xs transition-all hover:opacity-90 active:scale-95 shadow-sm"
           >
             Public View <ArrowUpRight className="w-4 h-4" />
           </Link>
        </div>
      </motion.div>

      {/* Main Hero Card */}
      <motion.div variants={itemVariants} className="bg-surface backdrop-blur-xl rounded-[2.5rem] border border-border overflow-hidden shadow-sm relative">
        {/* Cover Pattern & Gradients */}
        <div className="h-40 w-full bg-surface-secondary relative overflow-hidden">
             {/* Dynamic Mesh Gradient Background */}
             <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-blue-600/10 to-purple-600/20"></div>
             {/* Grid Overlay */}
             <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-20"></div>
             <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent"></div>
        </div>

        <div className="px-6 md:px-10 pb-10 relative z-10">
            <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-end -mt-16">
              
              {/* Logo / Avatar */}
              <div className="w-32 h-32 rounded-[2rem] bg-background border border-border flex items-center justify-center p-1 shadow-sm overflow-hidden shrink-0 group relative cursor-default">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="w-full h-full rounded-[1.75rem] overflow-hidden bg-surface-secondary relative flex items-center justify-center">
                  {avatarUrl && !imgError ? (
                    <img 
                      src={avatarUrl} 
                      alt={company.meta?.name} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-surface-secondary to-background flex items-center justify-center text-foreground font-black text-4xl tracking-tighter">
                       {company.meta?.name ? company.meta.name.substring(0, 2).toUpperCase() : "CO"}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex-1 pb-2 w-full">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
                        {company.meta?.name || `Incorporation #${company.id.toString()}`}
                      </h2>
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
                        <Check className="w-3 h-3" /> On-Chain
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm text-foreground font-medium">
                    <span className="flex items-center gap-2 bg-surface-secondary px-3 py-1.5 border border-border rounded-lg">
                      <Rocket className="w-4 h-4 text-primary" /> {company.sector}
                    </span>
                    <span className="flex items-center gap-2 bg-surface-secondary px-3 py-1.5 border border-border rounded-lg">
                       <Shield className="w-4 h-4 text-purple-500" /> Decentralized Entity
                    </span>
                  </div>
              </div>
            </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        
        {/* Left Column (Details) */}
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          
          <motion.div variants={itemVariants} className="bg-surface backdrop-blur-xl rounded-[2rem] border border-border p-6 md:p-8 hover:border-primary/30 transition-colors shadow-sm">
             <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2 mb-4">
                 <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                   <Building2 className="w-4 h-4" />
                 </div>
                 Corporate Charter
             </h3>
             <p className="text-foreground text-sm md:text-base leading-relaxed whitespace-pre-line font-medium">
                 {company.meta?.description || "No corporate charter provided. Update your entity metadata to declare your operational mission."}
             </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <motion.div variants={itemVariants} className="bg-surface backdrop-blur-xl rounded-[2rem] border border-border p-6 group hover:border-primary/30 transition-colors shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-surface-secondary border border-border rounded-xl flex items-center justify-center text-foreground group-hover:scale-110 transition-transform">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Executive Director</h4>
                    <p className="text-lg font-black text-foreground mt-0.5">{company.meta?.ceoName || "Not Declared"}</p>
                  </div>
                </div>
             </motion.div>

             <motion.div variants={itemVariants} className="bg-surface backdrop-blur-xl rounded-[2rem] border border-border p-6 group hover:border-primary/30 transition-colors shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-surface-secondary border border-border rounded-xl flex items-center justify-center text-foreground group-hover:scale-110 transition-transform">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Core Competency</h4>
                    <p className="text-lg font-black text-foreground mt-0.5">{company.meta?.services || "Not Declared"}</p>
                  </div>
                </div>
             </motion.div>
          </div>

          {/* Noteworthy Products */}
          {(company.meta?.productsList?.length ? true : (company.meta?.products || company.meta?.productLink)) && (
            <motion.div variants={itemVariants} className="bg-surface rounded-[2rem] border border-border p-6 md:p-8 space-y-6 shadow-sm">
               <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2 mb-2">
                 <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                   <Rocket className="w-4 h-4" />
                 </div>
                 Flagship Products
               </h3>

               {company.meta?.productsList && company.meta.productsList.length > 0 ? (
                 <div className="grid gap-4">
                   {company.meta.productsList.map((prod, idx) => (
                     <div key={idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-background p-5 rounded-[1.5rem] border border-border group hover:border-primary/30 transition-all">
                       <div>
                         <p className="text-xl font-black text-foreground">{prod.name}</p>
                         <p className="text-sm text-muted-foreground mt-1 font-medium">{company.sector} Market Initiative</p>
                       </div>
                       {prod.link && (
                         <a href={prod.link} target="_blank" rel="noopener noreferrer"
                            className="shrink-0 px-5 py-2.5 bg-surface border border-border text-foreground text-xs uppercase tracking-widest font-black rounded-xl hover:bg-surface-secondary active:scale-95 transition-all flex items-center gap-2"
                         >
                             Explore <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                         </a>
                       )}
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-background p-5 rounded-[1.5rem] border border-border group hover:border-primary/30 transition-all">
                     <div>
                         <p className="text-xl font-black text-foreground">{company.meta?.products || "Innovation Alpha"}</p>
                         <p className="text-sm text-muted-foreground mt-1 font-medium">Primary offering driving the {company.sector} market agenda.</p>
                     </div>
                     {company.meta?.productLink && (
                         <a href={company.meta.productLink} target="_blank" rel="noopener noreferrer"
                            className="shrink-0 px-5 py-2.5 bg-surface border border-border text-foreground text-xs uppercase tracking-widest font-black rounded-xl hover:bg-surface-secondary active:scale-95 transition-all flex items-center gap-2"
                         >
                             Explore Protocol <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                         </a>
                     )}
                 </div>
               )}
            </motion.div>
          )}
        </div>

        {/* Right Column (Sidebar) */}
        <div className="space-y-6 md:space-y-8">
          
          <motion.div variants={itemVariants} className="bg-surface backdrop-blur-xl rounded-[2rem] border border-border p-6 hover:border-primary/30 transition-colors shadow-sm">
             <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded border border-border flex items-center justify-center bg-surface-secondary">
                  <LinkIcon className="w-3 h-3 text-foreground" />
                </div>
                Connectivity
             </h3>
             <div className="space-y-3">
                {company.meta?.website ? (
                    <a href={company.meta.website} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 rounded-xl bg-background border border-border hover:border-primary/50 hover:bg-surface-secondary transition-all text-sm font-bold group">
                        <div className="flex items-center gap-3 text-foreground">
                            <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                              <Globe className="w-4 h-4" />
                            </div>
                            Official Portal
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                    </a>
                ) : (
                    <div className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground/50 bg-background rounded-xl border border-dashed border-border text-center">Portal Unverified</div>
                )}
                
                {company.meta?.twitter ? (
                    <a href={`https://twitter.com/${company.meta.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 rounded-xl bg-background border border-border hover:border-[#1DA1F2]/50 hover:bg-surface-secondary transition-all text-sm font-bold group">
                        <div className="flex items-center gap-3 text-foreground">
                            <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center group-hover:bg-[#1DA1F2]/10 group-hover:text-[#1DA1F2] transition-colors">
                              <Twitter className="w-4 h-4" />
                            </div>
                            X Dispatch
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-[#1DA1F2] group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                    </a>
                ) : (
                    <div className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground/50 bg-background rounded-xl border border-dashed border-border text-center">X Dispatch Unverified</div>
                )}
             </div>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-surface backdrop-blur-xl rounded-[2rem] border border-border p-6 hover:border-primary/30 transition-colors shadow-sm">
             <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded border border-border flex items-center justify-center bg-surface-secondary">
                  <Landmark className="w-3 h-3 text-foreground" />
                </div>
                Network Registry
             </h3>
             
             <div className="space-y-4">
                 {[
                   { label: "Entity Fingerprint", val: `#${company.id.toString()}`, id: "id" },
                   { label: "Equity Asset Token", val: company.token, id: "token" },
                   { label: "Treasury Vault Contract", val: company.vault, id: "vault" },
                 ].map(item => (
                   <div key={item.id} className="space-y-2 group">
                       <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/80">{item.label}</span>
                       <div className="flex items-center justify-between bg-background border border-border group-hover:border-primary/30 rounded-xl p-3 transition-colors">
                           <span className="text-xs font-mono text-foreground truncate mr-3">{item.val}</span>
                           <button onClick={() => handleCopy(item.val, item.id)} className="p-2 bg-surface hover:bg-surface-secondary rounded-lg text-foreground transition-colors shrink-0 group/btn shadow-sm border border-border">
                               {copiedId === item.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500 scale-110 transition-transform" />
                               ) : (
                                  <Copy className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
                               )}
                           </button>
                       </div>
                   </div>
                 ))}
             </div>
          </motion.div>
          
        </div>
      </div>
    </motion.div>
  );
}
