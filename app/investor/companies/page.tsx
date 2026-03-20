"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getContract,
  readContract,
  prepareContractCall,
  sendTransaction,
  waitForReceipt,
} from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  TrendingUp,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Search,
  ExternalLink,
  DollarSign,
  UserPlus
} from "lucide-react";

import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { ipfsToHttp } from "@/utils/ipfs";
import { useIPFSUpload } from "@/hooks/useIPFSUpload";
import { X, UserPlus as UserPlusIcon, Scale } from "lucide-react";
import { InvestModal } from "@/components/investor/InvestModal";
import { CompanyPreviewModal } from "@/components/investor/CompanyPreviewModal";
import { AIInvestmentHelper } from "@/components/investor/AIInvestmentHelper";

/* ============================================================
   TYPES
============================================================ */
interface CompanyDetails {
  id: bigint;
  owner: string;
  token: string;
  sale: string;
  vault: string;
  distributor: string;
  metadataURI: string;
  sector: string;
  exists: boolean;
  meta: any; // Fetched from IPFS
}

interface RoundInfo {
  roundId: bigint;
  pricePerShare: bigint;
  sharesRemaining: bigint;
  active: boolean;
}

interface CompanyWithRound extends CompanyDetails {
  round: RoundInfo;
}

function formatUSDT(raw: bigint) {
  return (Number(raw) / 1e6).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatShares(raw: bigint) {
  return (Number(raw) / 1e18).toLocaleString("en-US");
}

/* ============================================================
   EXPLORE PAGE
 ============================================================ */
export default function ExploreCompaniesPage() {
  const activeAccount = useActiveAccount();
  const { uploadMetadata } = useIPFSUpload();

  const [companies, setCompanies] = useState<CompanyWithRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [selectedCompany, setSelectedCompany] = useState<CompanyWithRound | null>(null);
  const [previewCompany, setPreviewCompany] = useState<CompanyWithRound | null>(null);
  const [selectedForAI, setSelectedForAI] = useState<CompanyWithRound[]>([]);

  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", bio: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const registry = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.CompanyRegistry as any,
      });

      const totalNum = (await readContract({
        contract: registry,
        method: "function totalCompanies() view returns (uint256)",
        params: [],
      })) as bigint;

      const results: CompanyWithRound[] = [];

      for (let i = 1n; i <= totalNum; i++) {
        const comp = (await readContract({
          contract: registry,
          method:
            "function getCompany(uint256) view returns ((address owner, address token, address sale, address vault, address distributor, string metadataURI, string sector, bool exists))",
          params: [i],
        })) as any;

        if (!comp.exists) continue;

        let meta = {};
        if (comp.metadataURI) {
          try {
            const r = await fetch(ipfsToHttp(comp.metadataURI));
            meta = await r.json();
          } catch (e) {}
        }

        const saleContract = getContract({
          client,
          chain: CHAIN,
          address: comp.sale as any,
        });

        const rInfo = (await readContract({
          contract: saleContract,
          method:
            "function getRoundInfo() view returns (uint256, uint256, uint256, bool)",
          params: [],
        })) as [bigint, bigint, bigint, boolean];

        results.push({
          id: i,
          owner: comp.owner,
          token: comp.token,
          sale: comp.sale,
          vault: comp.vault,
          distributor: comp.distributor,
          metadataURI: comp.metadataURI,
          sector: comp.sector,
          exists: comp.exists,
          meta,
          round: {
            roundId: rInfo[0],
            pricePerShare: rInfo[1],
            sharesRemaining: rInfo[2],
            active: rInfo[3],
          }
        });
      }

      setCompanies(results.reverse()); // Newest first

    } catch (err) {
      console.error("Failed to fetch companies:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!activeAccount) { setHasProfile(null); return; }
    try {
      const reg = getContract({
        client, chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.InvestorRegistry as `0x${string}`
      });
      const profile = await readContract({
        contract: reg, method: "function profiles(address) view returns (string,bool)",
        params: [activeAccount.address as `0x${string}`]
      }) as [string, boolean];

      setHasProfile(profile[1]);
      if (!profile[1]) setShowProfileSetup(true);
    } catch { setHasProfile(false); setShowProfileSetup(true); }
  }, [activeAccount]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  async function handleCreateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!activeAccount || !profileForm.name) return;
    setSavingProfile(true);
    try {
      const uri = await uploadMetadata({ name: profileForm.name, bio: profileForm.bio }, { name: `investor_${activeAccount.address}` });
      const reg = getContract({ client, chain: CHAIN, address: DEPLOYED_CONTRACTS.addresses.InvestorRegistry as `0x${string}` });
      const tx = prepareContractCall({ contract: reg, method: "function registerProfile(string)", params: [uri] });
      await sendTransaction({ transaction: tx, account: activeAccount });
      setHasProfile(true);
      setShowProfileSetup(false);
    } catch (err) {
      console.error(err);
      alert("Failed to create profile. See console.");
    } finally {
      setSavingProfile(false);
    }
  }

  const filtered = companies.filter(c => {
      const nameMatch = c.meta?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const sectorMatch = c.sector.toLowerCase().includes(searchQuery.toLowerCase());
      return nameMatch || sectorMatch;
  });

  const toggleComparison = (c: CompanyWithRound) => {
    setSelectedForAI(prev => {
      const exists = prev.find(item => String(item.id) === String(c.id));
      if (exists) return prev.filter(item => String(item.id) !== String(c.id));
      if (prev.length >= 4) {
          alert("Maximum 4 companies can be compared at once.");
          return prev;
      }
      return [...prev, c];
    });
  };

  return (
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
      <AIInvestmentHelper 
        selectedCompanies={selectedForAI} 
        onRemove={(id) => setSelectedForAI(prev => prev.filter(c => String(c.id) !== String(id)))} 
      />
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Explore Freelancer Companies</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1 sm:mt-2 max-w-2xl">
            Discover tokenized freelance businesses. Invest in talent by purchasing shares during active fundraising rounds, and earn dividends from their future revenues.
          </p>
        </div>
        <div className="relative w-full md:w-72">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
                type="text" 
                placeholder="Search by name or sector..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:border-primary transition-colors"
            />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col flex-1 items-center justify-center min-h-[40vh] space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Discovering companies...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-effect p-12 rounded-3xl border border-border flex flex-col items-center justify-center text-center">
            <Building2 className="w-16 h-16 text-muted-foreground opacity-50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Companies Found</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
                There are currently no active freelancer companies matching your search.
            </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filtered.map((c) => (
              <motion.div 
                key={c.id.toString()}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`glass-effect overflow-hidden rounded-2xl border transition-all group flex flex-col ${selectedForAI.find(item => String(item.id) === String(c.id)) ? 'border-primary ring-2 ring-primary/40 shadow-2xl scale-[1.02]' : 'border-border hover:border-primary/50'}`}
              >
                <div className="p-6 flex-1 flex flex-col space-y-4 relative">
                    <button 
                        onClick={(e) => { e.stopPropagation(); toggleComparison(c); }}
                        className={`absolute top-4 right-4 p-2.5 rounded-xl border transition-all z-20 ${selectedForAI.find(item => String(item.id) === String(c.id)) ? 'bg-primary text-white border-primary shadow-lg scale-110 opacity-100' : 'bg-surface/80 text-muted-foreground border-border hover:border-primary/50 opacity-100 sm:opacity-0 group-hover:opacity-100 hover:scale-110'}`}
                        title="Add to AI Comparison"
                    >
                        <Scale className="w-4 h-4" />
                    </button>
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="inline-block px-2.5 py-1 rounded-full bg-surface text-xs font-medium text-muted-foreground border border-border mb-3">
                                {c.sector}
                            </span>
                            <h3 className="text-lg sm:text-xl font-bold line-clamp-1">{c.meta?.name || `Company #${c.id.toString()}`}</h3>
                        </div>
                        {c.round.active && (
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-medium border border-emerald-500/20">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                Funding
                            </span>
                        )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground line-clamp-2 flex-grow min-h-[40px]">
                        {c.meta?.description || "No description provided."}
                    </p>

                    {c.round.active ? (
                        <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 space-y-2 mt-auto">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Share Price:</span>
                                <span className="font-semibold text-primary">{formatUSDT(c.round.pricePerShare)} USDT</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Available Shares:</span>
                                <span className="font-semibold">{formatShares(c.round.sharesRemaining)}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 bg-surface rounded-xl border border-border space-y-2 mt-auto">
                            <p className="text-sm text-center text-muted-foreground font-medium">No Active Fundraising Round</p>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-border bg-surface/50 grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setPreviewCompany(c)}
                        className="w-full py-2.5 bg-background text-foreground hover:bg-surface border border-border font-medium rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                        <ExternalLink className="w-4 h-4" /> View Details
                    </button>
                    <button 
                        onClick={() => setSelectedCompany(c)}
                        disabled={!c.round.active}
                        className="w-full py-2.5 bg-primary text-white hover:opacity-90 font-medium rounded-xl transition-opacity disabled:opacity-50 disabled:hover:opacity-50 flex items-center justify-center gap-2 text-sm"
                    >
                        {c.round.active ? <><DollarSign className="w-4 h-4" /> Invest</> : "Closed"}
                    </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Company Preview Modal */}
      <CompanyPreviewModal
        company={previewCompany}
        open={previewCompany !== null}
        onClose={() => setPreviewCompany(null)}
        onInvest={() => { setSelectedCompany(previewCompany); setPreviewCompany(null); }}
      />

      {/* Investment Modal Overlay */}
      <InvestModal 
         company={selectedCompany} 
         open={selectedCompany !== null} 
         onClose={() => setSelectedCompany(null)} 
         onSuccess={fetchCompanies} 
      />

      <AnimatePresence>
        {showProfileSetup && !hasProfile && activeAccount && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-surface-secondary border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl overflow-hidden relative">
              <button 
                onClick={() => setShowProfileSetup(false)} 
                className="absolute top-4 right-4 p-1 rounded-lg hover:bg-surface transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex flex-col items-center mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <UserPlusIcon className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Create Investor Profile</h2>
                <p className="text-sm text-muted-foreground text-center mt-2">
                  You need to set up a public profile before investing in freelancer companies.
                </p>
              </div>

              <form onSubmit={handleCreateProfile} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Display Name *</label>
                  <input required type="text" value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
                    placeholder="E.g. Venture Maven" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Short Bio (Optional)</label>
                  <textarea rows={3} value={profileForm.bio} onChange={e => setProfileForm({ ...profileForm, bio: e.target.value })}
                    className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary resize-none transition-colors"
                    placeholder="Briefly describe your investment interests..." />
                </div>
                <button type="submit" disabled={savingProfile || !profileForm.name}
                  className="w-full py-3 mt-2 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {savingProfile ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating Profile...</> : "Complete Setup"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
