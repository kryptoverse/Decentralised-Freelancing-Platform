"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Rocket, Settings, Wallet, RefreshCw,
  TrendingUp, CircleDollarSign, Loader2, AlertCircle,
  CheckCircle2, X, ExternalLink, Users, BarChart3,
  PieChart, DollarSign, Coins, Activity, User, Copy, ChevronDown,
  Landmark, ArrowDownToLine, ArrowUpFromLine, Clock, Shield, Receipt, Info
} from "lucide-react";

import {
  getContract, readContract, prepareContractCall, sendTransaction, waitForReceipt,
  getContractEvents, prepareEvent
} from "thirdweb";
import { useActiveAccount, useActiveWallet } from "thirdweb/react";
import { getWalletBalance } from "thirdweb/wallets";
import { polygonAmoy } from "thirdweb/chains";

import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { useIPFSUpload } from "@/hooks/useIPFSUpload";
import { useChatContext } from "@/components/chat/ChatContext";

// --- Types ---

interface RoundInfo {
  roundId: bigint;
  pricePerShare: bigint;
  sharesRemaining: bigint;
  active: boolean;
}

interface VaultStatus {
  raisedTotal: bigint;
  raisedWithdrawn: bigint;
  totalRevenue: bigint;
  totalDistributed: bigint;
  periodRevenue: bigint;
  periodExpenses: bigint;
  totalExpenses: bigint;
  ownerWithdrawable: bigint;
  raisedWithdrawableAmt: bigint;
  lastSoloClaimTimestamp: bigint;
}

interface DistributorStatus {
  totalDeposited: bigint;
  totalClaimed: bigint;
  balance: bigint;
}

interface InvestorData {
  address: string;
  sharesHeld: bigint;
  totalInvested: bigint;
  totalPayouts: bigint;
  metadataURI?: string;
  meta?: any;
}

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
  meta: any;
  round: RoundInfo;
}

interface AnalyticsData {
  tokenSupply: bigint;
  sharesSold: bigint;
  vaultStatus: VaultStatus;
  distributorStatus: DistributorStatus;
  vaultBalance: bigint;
  investors: InvestorData[];
  jobBudgetSum: bigint; // Added for 60% rule
}

// --- Helpers ---

function fmtUSDT(raw: bigint | undefined) {
  if (!raw) return "0.00";
  return (Number(raw) / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtShares(raw: bigint | undefined) {
  if (!raw) return "0";
  return Math.round(Number(raw) / 1e18).toLocaleString("en-US");
}

function fmtPrice(raw: bigint | undefined) {
  if (!raw) return "0.00";
  return (Number(raw) / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function getGatewayUrl(uri: string | undefined) {
  if (!uri) return undefined;
  if (uri.startsWith("ipfs://")) {
    return `https://gateway.pinata.cloud/ipfs/${uri.replace("ipfs://", "")}`;
  }
  return uri;
}

function shortAddr(a: string) {
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

type TabId = "home" | "round" | "vault" | "investors";
// --- Modals ---

function StartRoundModal({
  company, onClose, onSuccess, buildExecAccount
}: {
  company: CompanyDetails; onClose: () => void; onSuccess: () => void;
  buildExecAccount: () => any;
}) {
  const account = useActiveAccount();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState("");

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;
    try {
      setLoading(true); setErrorMsg("");
      const s = parseInt(shares), p = parseFloat(price);
      if (isNaN(s) || s <= 0) throw new Error("Invalid shares");
      if (isNaN(p) || p <= 0) throw new Error("Invalid price");
      const sharesWei = BigInt(s) * BigInt(1e18);
      const priceWei = BigInt(Math.floor(p * 1e6));
      const execAccount = await buildExecAccount();
      const saleC = getContract({ client, chain: CHAIN, address: company.sale as any });
      const tx = prepareContractCall({
        contract: saleC, method: "function startRound(uint256,uint256)",
        params: [priceWei, sharesWei],
      });
      await sendTransaction({ transaction: tx, account: execAccount });
      onSuccess(); onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to start round.");
    } finally { setLoading(false); }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
          className="bg-surface/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative overflow-hidden">
          
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-blue-500"></div>
          
          <button onClick={onClose} className="absolute top-6 right-6 text-muted-foreground hover:text-white transition-colors bg-white/5 w-8 h-8 rounded-full flex items-center justify-center border border-white/10">
            <X className="w-4 h-4" />
          </button>
          
          <div className="mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30 text-primary mb-4 shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]">
               <Rocket className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-black text-white">Initialize Round</h2>
            <p className="text-sm text-muted-foreground mt-1">Configure parameters for capital injection.</p>
          </div>

          <form onSubmit={handleStart} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Equity Allocation (Shares)</label>
              <input type="number" required value={shares} onChange={e => setShares(e.target.value)}
                className="w-full bg-background/50 border border-white/10 rounded-xl px-4 py-3.5 outline-none focus:border-primary/50 focus:bg-background transition-all text-white font-mono" placeholder="e.g. 100000" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Valuation per Share (USDT)</label>
              <input type="number" step="0.000001" required value={price} onChange={e => setPrice(e.target.value)}
                className="w-full bg-background/50 border border-white/10 rounded-xl px-4 py-3.5 outline-none focus:border-primary/50 focus:bg-background transition-all text-white font-mono" placeholder="e.g. 0.05" />
            </div>
            
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20">
              <div className="flex justify-between items-center mb-1">
                 <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Target Capital Raise</span>
                 <CircleDollarSign className="w-4 h-4 text-primary" />
              </div>
              <p className="font-black text-2xl text-foreground font-mono">
                 {shares && price ? (parseFloat(shares) * parseFloat(price)).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0.00"} <span className="text-sm text-muted-foreground font-sans">USDT</span>
              </p>
            </div>
            
            {errorMsg && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-500 text-sm font-medium"><AlertCircle className="w-5 h-5 shrink-0" /><p>{errorMsg}</p></div>}
            
            <button type="submit" disabled={loading}
              className="w-full py-4 bg-primary text-white font-black text-sm uppercase tracking-[0.2em] rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex justify-center items-center gap-2 shadow-[0_0_30px_rgba(var(--primary-rgb),0.3)]">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> PROVISIONING...</> : "OPEN FOR PUBLIC FUNDING"}
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function InvestorPopup({ investor, onClose }: { investor: InvestorData; onClose: () => void }) {
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4" onClick={onClose}>
        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
          className="bg-surface/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 w-full max-w-sm shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
          
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Users className="w-32 h-32 text-primary" />
          </div>

          <button onClick={onClose} className="absolute top-6 right-6 text-muted-foreground hover:text-white transition-colors bg-white/5 w-8 h-8 rounded-full flex items-center justify-center border border-white/10 z-10">
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex flex-col items-center text-center gap-4 mb-8 relative z-10">
            <div className="w-20 h-20 rounded-[1.5rem] bg-gradient-to-br from-emerald-500/20 to-teal-600/20 flex items-center justify-center text-emerald-400 font-bold text-3xl border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
               {investor.meta?.name ? investor.meta.name.substring(0,2).toUpperCase() : <User className="w-8 h-8" />}
            </div>
            <div>
              <h3 className="font-black text-xl text-white mb-1">{investor.meta?.name || "Anonymous Entity"}</h3>
              <button onClick={() => copyToClipboard(investor.address)} className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2 group mx-auto bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                {shortAddr(investor.address)} <Copy className="w-3 h-3 group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </div>
          
          {investor.meta?.bio && (
            <div className="mb-6 bg-white/5 border border-white/5 rounded-2xl p-4 relative z-10">
              <p className="text-xs text-muted-foreground leading-relaxed text-center">{investor.meta.bio}</p>
            </div>
          )}
          
          <div className="space-y-3 relative z-10">
            <div className="flex justify-between items-center p-4 bg-background/50 rounded-2xl border border-white/5">
              <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-2"><PieChart className="w-3 h-3" /> Shares Held</span>
              <span className="font-bold font-mono text-white">{fmtShares(investor.sharesHeld)}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-500 flex items-center gap-2"><TrendingUp className="w-3 h-3" /> Total Invested</span>
              <span className="font-bold font-mono text-emerald-400">{fmtUSDT(investor.totalInvested)} <span className="text-[10px] font-sans">USDT</span></span>
            </div>
            <div className="flex justify-between items-center p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-500 flex items-center gap-2"><Coins className="w-3 h-3" /> Yield Generated</span>
              <span className="font-bold font-mono text-amber-400">{fmtUSDT(investor.totalPayouts)} <span className="text-[10px] font-sans">USDT</span></span>
            </div>
          </div>
          <a href={`https://amoy.polygonscan.com/address/${investor.address}`} target="_blank" rel="noopener noreferrer"
             className="mt-6 w-full flex items-center justify-center gap-2 text-[10px] uppercase font-bold tracking-widest text-primary hover:text-white transition-colors py-2 group">
             View on Block Explorer <ExternalLink className="w-3 h-3 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </a>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
// --- Create Company Form ---

function CreateCompanyForm({ account, onSuccess, buildExecAccount }: { account: any; onSuccess: () => void; buildExecAccount: () => any; }) {
  const { uploadMetadata, uploadFile } = useIPFSUpload();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [form, setForm] = useState({ 
    name: "", symbol: "", description: "", sector: "Technology", 
    website: "", twitter: "", ceoName: "", services: ""
  });
  const [productsList, setProductsList] = useState([{ name: "", link: "" }]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [tokenImageFile, setTokenImageFile] = useState<File | null>(null);

  const handleAddProduct = () => setProductsList([...productsList, { name: "", link: "" }]);
  const handleRemoveProduct = (i: number) => setProductsList(productsList.filter((_, idx) => idx !== i));
  const handleProductChange = (i: number, field: "name" | "link", val: string) => {
    const newP = [...productsList];
    newP[i][field] = val;
    setProductsList(newP);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;
    try {
      setLoading(true); setErrorMsg(""); setSuccessMsg("");
      
      if (!logoFile) throw new Error("Entity Symbol / Logo is required.");
      if (!tokenImageFile) throw new Error("Token Asset Logo is required.");
      if (form.description.length < 50) throw new Error("Corporate Charter must be at least 50 characters.");
      if (!productsList.some(p => p.name.trim() !== "")) throw new Error("At least one Flagship Product is required.");

      const execAccount = buildExecAccount();
      setSuccessMsg("Uploading entity visual assets to IPFS...");
      
      const logoUrl = await uploadFile(logoFile, { name: `${form.name} Logo` });
      setSuccessMsg("Uploading token visual assets to IPFS...");
      const tokenImageUrl = await uploadFile(tokenImageFile, { name: `${form.name} Token Logo` });

      setSuccessMsg("Generating and pinning corporate metadata...");
      const metadata = { 
        name: form.name, 
        description: form.description, 
        website: form.website, 
        twitter: form.twitter,
        ceoName: form.ceoName,
        services: form.services,
        productsList: productsList.filter(p => p.name.trim() !== ""),
        image: logoUrl,
        tokenImage: tokenImageUrl,
        createdVia: "WORQS_DApp" 
      };
      
      const uri = await uploadMetadata(metadata, { name: form.name });
      const registry = getContract({ client, chain: CHAIN, address: DEPLOYED_CONTRACTS.addresses.CompanyRegistry as any });
      const tx = prepareContractCall({
        contract: registry, method: "function createCompany(string,string,string,string,address)",
        params: [form.name, form.symbol, uri, form.sector, account.address], gas: BigInt(15000000),
      });
      setSuccessMsg("Deploying company contracts on-chain. Approving standard network fees...");
      const res = await sendTransaction({ transaction: tx, account: execAccount });
      await waitForReceipt({ client, chain: CHAIN, transactionHash: res.transactionHash });
      setSuccessMsg("Entity successfully incorporated on-chain! Loading dashboard...");
      onSuccess();
    } catch (err: any) { setErrorMsg(err.message || "Failed to incorporate entity."); } finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto bg-surface backdrop-blur-xl rounded-[2.5rem] p-8 md:p-12 border border-border shadow-2xl relative overflow-hidden">
      
      {/* Decorative gradient overlay */}
      <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-primary/10 via-transparent to-transparent pointer-events-none"></div>

      <div className="flex flex-col items-center text-center mb-10 relative z-10">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center border border-primary/30 shadow-sm mb-6">
          <Building2 className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-foreground mb-2">Incorporate Entity</h2>
        <p className="text-muted-foreground text-sm max-w-sm">Deploy an on-chain corporate structure to manage equity and distributed funding.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
        
        {/* Core Identity */}
        <div className="bg-surface-secondary rounded-[2rem] p-6 md:p-8 border border-border space-y-6">
           <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
             <span className="w-2 h-2 rounded-full bg-primary/50"></span> Brand Identity
           </h3>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2">
               <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Entity Name *</label>
               <input required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                 className="w-full bg-background border border-border rounded-xl px-4 py-3.5 text-sm focus:border-primary/50 outline-none transition-all text-foreground placeholder:text-muted-foreground/40" placeholder="e.g. Acme Innovations" />
             </div>
             <div className="space-y-2">
               <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Asset Ticker *</label>
               <input required type="text" value={form.symbol} onChange={e => setForm({...form, symbol: e.target.value})} maxLength={6}
                 className="w-full bg-background border border-border rounded-xl px-4 py-3.5 text-sm focus:border-primary/50 outline-none transition-all text-foreground uppercase placeholder:text-muted-foreground/40" placeholder="e.g. ACME" />
             </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Entity Symbol / Logo *</label>
                  <div className="relative border-2 border-dashed border-border rounded-[1.5rem] p-6 text-center hover:bg-surface hover:border-primary/30 transition-all group overflow-hidden bg-background">
                    <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={e => {
                      if (e.target.files && e.target.files[0]) setLogoFile(e.target.files[0]);
                    }} />
                    
                    {logoFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-bold truncate max-w-[200px]">{logoFile.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Click to change</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 opacity-70 group-hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 rounded-xl bg-surface-secondary flex items-center justify-center border border-border text-muted-foreground">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                           <p className="text-sm font-bold text-foreground mb-1">Select an image file</p>
                           <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">PNG, JPG (Max 5MB)</p>
                        </div>
                      </div>
                    )}
                  </div>
               </div>

               <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Token Asset Logo *</label>
                  <div className="relative border-2 border-dashed border-border rounded-[1.5rem] p-6 text-center hover:bg-surface hover:border-primary/30 transition-all group overflow-hidden bg-background">
                    <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={e => {
                      if (e.target.files && e.target.files[0]) setTokenImageFile(e.target.files[0]);
                    }} />
                    
                    {tokenImageFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-bold truncate max-w-[200px]">{tokenImageFile.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Click to change</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 opacity-70 group-hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 rounded-xl bg-surface-secondary flex items-center justify-center border border-border text-muted-foreground">
                          <CircleDollarSign className="w-5 h-5" />
                        </div>
                        <div>
                           <p className="text-sm font-bold text-foreground mb-1">Select an image file</p>
                           <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">PNG, JPG (Max 5MB)</p>
                        </div>
                      </div>
                    )}
                  </div>
               </div>
           </div>
        </div>

        {/* Operational Profile */}
        <div className="bg-surface-secondary rounded-[2rem] p-6 md:p-8 border border-border space-y-6">
           <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
             <span className="w-2 h-2 rounded-full bg-emerald-500/50"></span> Operational Profile
           </h3>
           
           <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Corporate Charter / Mission (Min 50 chars) *</label>
              <textarea required rows={3} minLength={50} value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                className="w-full bg-background border border-border rounded-xl px-4 py-3.5 text-sm focus:border-primary/50 outline-none transition-all text-foreground resize-none placeholder:text-muted-foreground/40" placeholder="Describe the operational mandate..." />
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
             <div className="space-y-2">
               <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Executive Director *</label>
               <input required type="text" value={form.ceoName} onChange={e => setForm({...form, ceoName: e.target.value})}
                 className="w-full bg-background border border-border rounded-xl px-4 py-3.5 text-sm focus:border-primary/50 outline-none transition-all text-foreground placeholder:text-muted-foreground/40" placeholder="e.g. Satoshi" />
             </div>
             <div className="space-y-2">
               <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Primary Sector *</label>
               <select required value={form.sector} onChange={e => setForm({...form, sector: e.target.value})}
                 className="w-full bg-background border border-border rounded-xl px-4 py-3.5 text-sm focus:border-primary/50 outline-none appearance-none transition-all text-foreground">
                 {['Technology','Design','Finance','Web3','Marketing','Writing','Consulting','Other'].map(s => <option key={s} value={s} className="text-foreground">{s}</option>)}
               </select>
             </div>
           </div>
           
           <div className="space-y-4 pt-4 border-t border-border">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Flagship Products * (At least 1 required)</label>
              
              {productsList.map((prod, i) => (
                 <div key={i} className="flex flex-col sm:flex-row gap-4 relative bg-background p-4 rounded-[1.5rem] border border-border">
                    <div className="flex-1 space-y-2">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Product Name</label>
                      <input type="text" value={prod.name} onChange={e => handleProductChange(i, "name", e.target.value)} required={i === 0}
                        className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm focus:border-primary/50 outline-none transition-all text-foreground placeholder:text-muted-foreground/40" placeholder="e.g. Decentralized Search" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Product Gateway (URL)</label>
                      <input type="url" value={prod.link} onChange={e => handleProductChange(i, "link", e.target.value)}
                        className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm focus:border-primary/50 outline-none transition-all text-foreground placeholder:text-muted-foreground/40" placeholder="https://..." />
                    </div>
                    
                    {productsList.length > 1 && (
                      <button type="button" onClick={() => handleRemoveProduct(i)} className="sm:mt-7 mx-auto shrink-0 w-8 h-8 flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors border border-red-500/20" title="Remove Product">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                 </div>
              ))}
              
              <button type="button" onClick={handleAddProduct} className="text-xs font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                 <RefreshCw className="w-3 h-3" /> Add Another Product
              </button>
           </div>
        </div>

        {/* System Warnings */}
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-5 flex gap-4">
           <Wallet className="w-5 h-5 text-primary shrink-0 mt-0.5" />
           <div>
             <p className="font-bold text-primary text-sm mb-1">Deployment Gas Required</p>
             <p className="text-foreground text-xs leading-relaxed">Incorporation executes multiple smart contracts onto the Polygon network. Standard fees will be deducted.</p>
           </div>
        </div>

        {errorMsg && <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl p-4 text-sm font-medium flex gap-3 items-center shadow-lg"><AlertCircle className="w-5 h-5 shrink-0" /><p>{errorMsg}</p></div>}
        {successMsg && <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl p-4 text-sm font-medium flex gap-3 items-center shadow-lg"><Loader2 className="w-5 h-5 shrink-0 animate-spin" /><p>{successMsg}</p></div>}
        
        <button type="submit" disabled={loading}
          className="w-full py-5 bg-primary text-primary-foreground font-black text-sm uppercase tracking-[0.2em] rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3 shadow-md mt-8">
          {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> EXECUTING PROTOCOL...</> : <><Rocket className="w-5 h-5" /> INITIALIZE CORPORATION</>}
        </button>
      </form>
    </motion.div>
  );
}
// --- Main Dashboard Component ---

export default function FounderDashboard() {
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const router = useRouter();

  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [selectedInvestor, setSelectedInvestor] = useState<InvestorData | null>(null);
  const [showStartRound, setShowStartRound] = useState(false);
  
  const { setChatContext } = useChatContext();

  useEffect(() => {
    if (!company) {
       setChatContext((prev) => {
         const base = prev.split('--- CURRENT USER CONTEXT ---')[0].trim();
         return base + '\n\n--- CURRENT USER CONTEXT ---\nRole: Founder\nStatus: Has not yet incorporated an entity on-chain.';
       });
       return;
    }
    const ctx = `--- CURRENT USER CONTEXT ---
Role: Founder
Company Name: ${company.meta?.name || "Unknown"}
Sector: ${company.sector}
Vault Balance: ${fmtUSDT(analytics?.vaultBalance) || "0.00"} USDT
Total Revenue: ${fmtUSDT(analytics?.vaultStatus?.totalRevenue) || "0.00"} USDT
Total Raised: ${fmtUSDT(analytics?.vaultStatus?.raisedTotal) || "0.00"} USDT
Total Expenses: ${fmtUSDT(analytics?.vaultStatus?.totalExpenses) || "0.00"} USDT
Owner Withdrawable (Profit): ${fmtUSDT(analytics?.vaultStatus?.ownerWithdrawable) || "0.00"} USDT
Shares Sold: ${fmtShares(analytics?.sharesSold) || "0"}`;

    setChatContext((prev) => {
      const base = prev.split('--- CURRENT USER CONTEXT ---')[0].trim();
      return base + '\n\n' + ctx;
    });
  }, [company, analytics, setChatContext]);

  const [maticBal, setMaticBal] = useState<{ displayValue: string; symbol: string } | null>(null);
  const [usdtBal, setUsdtBal] = useState<string | null>(null);
  const [eoaMaticBal, setEoaMaticBal] = useState<string | null>(null);
  const [eoaUsdtBal, setEoaUsdtBal] = useState<string | null>(null);
  const [eoaAddress, setEoaAddress] = useState<string | null>(null);
  const [isLinked, setIsLinked] = useState<boolean>(true);

  // Vault operations state
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [soloJobAmt, setSoloJobAmt] = useState("");
  const [expenseAmt, setExpenseAmt] = useState("");
  const [withdrawBusinessAmt, setWithdrawBusinessAmt] = useState("");
  const [claimLoading, setClaimLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [endRoundLoading, setEndRoundLoading] = useState(false);
  const [closePeriodLoading, setClosePeriodLoading] = useState(false);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [withdrawBusinessLoading, setWithdrawBusinessLoading] = useState(false);
  const [acceptOwnershipLoading, setAcceptOwnershipLoading] = useState(false);
  const [vaultOwnershipPending, setVaultOwnershipPending] = useState(false);

  // Transfer state
  const [transferAmt, setTransferAmt] = useState("");
  const [transferToken, setTransferToken] = useState<"MATIC" | "USDT">("MATIC");
  const [transferDirection, setTransferDirection] = useState<"EOA_TO_SW" | "SW_TO_EOA">("EOA_TO_SW");
  const [transferLoading, setTransferLoading] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useEffect(() => {
    if (!activeWallet) return;
    try {
      const pa = (activeWallet as any).getAdminAccount?.();
      if (pa?.address) setEoaAddress(pa.address);
    } catch {}
  }, [activeWallet]);

  const getExecutionAccount = () => {
    if (!activeWallet) throw new Error("Wallet not connected");
    const personalAccount = (activeWallet as any).getAdminAccount?.();
    if (!personalAccount) throw new Error("Could not access personal EOA.");
    return personalAccount;
  };

  const fetchBalances = async () => {
    if (!account) return;
    try {
      // 1. Smart Wallet Balances
      const swMatic = await getWalletBalance({ client, chain: polygonAmoy, address: account.address });
      setMaticBal(swMatic);

      const usdtC = getContract({ client, chain: CHAIN, address: DEPLOYED_CONTRACTS.addresses.MockUSDT as any });
      const swUsdt = await readContract({ contract: usdtC, method: "function balanceOf(address) view returns (uint256)", params: [account.address] }) as bigint;
      setUsdtBal(fmtUSDT(swUsdt));

      // 2. EOA Balances (Personal Account)
      if (activeWallet) {
        try {
          const pa = (activeWallet as any).getAdminAccount?.();
          if (pa?.address) {
            const eoaMatic = await getWalletBalance({ client, chain: polygonAmoy, address: pa.address });
            setEoaMaticBal(eoaMatic.displayValue);

            const eoaUsdt = await readContract({ contract: usdtC, method: "function balanceOf(address) view returns (uint256)", params: [pa.address] }) as bigint;
            setEoaUsdtBal(fmtUSDT(eoaUsdt));
          }
        } catch (e) { console.error("EOA balance fetch failed:", e); }
      }
    } catch (err) { console.error("Balance fetch error:", err); }
  };

  // Single batched fetch for company + analytics
  const fetchAll = useCallback(async () => {
    if (!account) return;
    try {
      const registry = getContract({ client, chain: CHAIN, address: DEPLOYED_CONTRACTS.addresses.CompanyRegistry as any });
      
      // Get EOA address directly if state hasn't updated yet
      let currentEoa = eoaAddress;
      if (!currentEoa && activeWallet) {
        try {
          const pa = (activeWallet as any).getAdminAccount?.();
          if (pa?.address) currentEoa = pa.address;
        } catch {}
      }

      // 1. Try to find company by Smart Wallet
      let companyId = await readContract({
        contract: registry,
        method: "function ownerToCompanyId(address) view returns (uint256)",
        params: [account.address]
      }) as bigint;

      // 2. If not found, try to find company by EOA
      if (companyId === BigInt(0) && currentEoa) {
        companyId = await readContract({
          contract: registry,
          method: "function ownerToCompanyId(address) view returns (uint256)",
          params: [currentEoa]
        }) as bigint;
      }

      if (companyId === BigInt(0)) {
        setCompany(null);
        setLoading(false);
        setRefreshing(false);
        setIsFirstLoad(false);
        return;
      }

      const c = await readContract({
        contract: registry,
        method: "function getCompany(uint256) view returns ((address owner, address token, address sale, address vault, address distributor, string metadataURI, string sector, bool exists))",
        params: [companyId]
      }) as any;

      if (!c.exists) {
        setCompany(null);
        setLoading(false);
        setRefreshing(false);
        setIsFirstLoad(false);
        return;
      }

      let meta = {};
      if (c.metadataURI) {
        try {
          const r = await fetch(`https://gateway.pinata.cloud/ipfs/${c.metadataURI.replace("ipfs://", "")}`);
          meta = await r.json();
        } catch {}
      }

      // Check link status
      let linked = true;
      let pAddr = "";
      try {
        const factory = getContract({ client, chain: CHAIN, address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory as any });
        pAddr = await readContract({ contract: factory, method: "function freelancerProfile(address) view returns (address)", params: [account.address] }) as string;
        if (pAddr && pAddr !== "0x0000000000000000000000000000000000000000") {
          const vaultC = getContract({ client, chain: CHAIN, address: c.vault as any });
          const vProfileAddr = await readContract({ contract: vaultC, method: "function profile() view returns (address)" }) as string;
          linked = vProfileAddr.toLowerCase() === pAddr.toLowerCase();
        }
      } catch { }
      setIsLinked(linked);

      // Fetch round info
      let roundInfo: RoundInfo = { roundId: BigInt(0), pricePerShare: BigInt(0), sharesRemaining: BigInt(0), active: false };
      try {
        const saleC = getContract({ client, chain: CHAIN, address: c.sale as any });
        const r = await readContract({ contract: saleC, method: "function getRoundInfo() view returns (uint256, uint256, uint256, bool)" }) as any;
        roundInfo = { roundId: r[0], pricePerShare: r[1], sharesRemaining: r[2], active: r[3] };
      } catch {}

      const found: CompanyDetails = { id: companyId, owner: c.owner, token: c.token, sale: c.sale, vault: c.vault, distributor: c.distributor, metadataURI: c.metadataURI, sector: c.sector, exists: c.exists, meta, round: roundInfo };

      setCompany(found);

      // Fetch analytics if company found (batched reads)
      if (found) {
        const tokenC = getContract({ client, chain: CHAIN, address: found.token as any });
        const vaultC = getContract({ client, chain: CHAIN, address: found.vault as any });
        const distC = getContract({ client, chain: CHAIN, address: found.distributor as any });
        const usdtC = getContract({ client, chain: CHAIN, address: DEPLOYED_CONTRACTS.addresses.MockUSDT as any });
        const saleC = getContract({ client, chain: CHAIN, address: found.sale as any });

        // Batch all reads
        const [totalSupply, saleBalance, vaultBalance, vaultStatus, distStatus, ownerWithdrawable, totalExpenses, raisedWithdrawableAmt, lastSoloClaim] = await Promise.all([
          readContract({ contract: tokenC, method: "function totalSupply() view returns (uint256)" }) as Promise<bigint>,
          readContract({ contract: tokenC, method: "function balanceOf(address) view returns (uint256)", params: [found.sale] }) as Promise<bigint>,
          readContract({ contract: usdtC, method: "function balanceOf(address) view returns (uint256)", params: [found.vault] }) as Promise<bigint>,
          readContract({ contract: vaultC, method: "function getVaultStatus() view returns (uint256, uint256, uint256, uint256, uint256, uint256)" }) as Promise<any>,
          readContract({ contract: distC, method: "function getDistributorStatus() view returns (uint256, uint256, uint256)" }) as Promise<any>,
          readContract({ contract: vaultC, method: "function ownerWithdrawable() view returns (uint256)" }) as Promise<bigint>,
          readContract({ contract: vaultC, method: "function totalExpenses() view returns (uint256)" }) as Promise<bigint>,
          readContract({ contract: vaultC, method: "function raisedWithdrawable() view returns (uint256)" }) as Promise<bigint>,
          readContract({ contract: vaultC, method: "function lastSoloClaimTimestamp() view returns (uint256)" }).catch(() => BigInt(0)) as Promise<bigint>,
        ]);

        // Check vault ownership (Ownable2Step - pendingOwner means needs acceptance)
        try {
          const [vaultOwner, pendingOwner] = await Promise.all([
            readContract({ contract: vaultC, method: "function owner() view returns (address)" }) as Promise<string>,
            readContract({ contract: vaultC, method: "function pendingOwner() view returns (address)" }) as Promise<string>,
          ]);
          const myEoa = currentEoa?.toLowerCase() || "";
          const isPending = pendingOwner.toLowerCase() === myEoa && vaultOwner.toLowerCase() !== myEoa;
          setVaultOwnershipPending(isPending);
          console.log("[VAULT] owner:", vaultOwner, "pendingOwner:", pendingOwner, "myEoa:", myEoa, "isPending:", isPending);
        } catch (e) { console.error("[VAULT] ownership check failed:", e); }

        const sharesSold = totalSupply - saleBalance;
        const vs: VaultStatus = {
          raisedTotal: vaultStatus[0], raisedWithdrawn: vaultStatus[1], totalRevenue: vaultStatus[2],
          totalDistributed: vaultStatus[3], periodRevenue: vaultStatus[4], periodExpenses: vaultStatus[5],
          totalExpenses, ownerWithdrawable, raisedWithdrawableAmt, lastSoloClaimTimestamp: lastSoloClaim,
        };
        const ds: DistributorStatus = { totalDeposited: distStatus[0], totalClaimed: distStatus[1], balance: distStatus[2] };

        // Fetch investors asynchronously later to not block rendering
        let investors: InvestorData[] = [];
        
        // Asynchronously fetch investor details in the background
        const fetchInvestors = async () => {
          try {
            const sharesBoughtEvent = prepareEvent({ signature: "event SharesBought(uint256 indexed roundId, address indexed buyer, uint256 usdtPaid, uint256 sharesReceived)" });
            
            // Try fetching events - Insight API requires fromBlock > 0
            let events: any[] = [];
            try {
              events = await getContractEvents({ contract: saleC, events: [sharesBoughtEvent], fromBlock: BigInt(1) });
              console.log("[INVESTORS] Found events:", events.length);
            } catch (evErr) {
              console.warn("[INVESTORS] Event query failed, trying without fromBlock:", evErr);
              try {
                events = await getContractEvents({ contract: saleC, events: [sharesBoughtEvent] });
                console.log("[INVESTORS] Found events (no fromBlock):", events.length);
              } catch (evErr2) {
                console.error("[INVESTORS] All event queries failed:", evErr2);
              }
            }

            const uniqueBuyers = new Map<string, boolean>();
            events.forEach((ev: any) => {
              const buyer = ev.args?.buyer;
              if (buyer) {
                uniqueBuyers.set(buyer.toLowerCase(), true);
              }
            });

            const invRegistryC = getContract({ client, chain: CHAIN, address: DEPLOYED_CONTRACTS.addresses.InvestorRegistry as any });
            const buyerAddresses = Array.from(uniqueBuyers.keys());

            // Batch fetch all investor data
            const investorPromises = buyerAddresses.map(async (addr) => {
              try {
                const [balance, stats, profileRaw] = await Promise.all([
                  readContract({ contract: tokenC, method: "function balanceOf(address) view returns (uint256)", params: [addr] }) as Promise<bigint>,
                  readContract({ contract: invRegistryC, method: "function getInvestmentStats(address, uint256) view returns (uint256, uint256)", params: [addr, found!.id] }) as Promise<any>,
                  readContract({ contract: invRegistryC, method: "function profiles(address) view returns (string, bool)", params: [addr] }).catch(() => null) as Promise<any>,
                ]);

                let meta = {};
                const metadataURI = profileRaw ? (profileRaw[0] || profileRaw?.metadataURI || "") : "";
                const profileExists = profileRaw ? (profileRaw[1] ?? profileRaw?.exists ?? false) : false;
                
                if (metadataURI && profileExists) {
                  try {
                    const ipfsUrl = metadataURI.startsWith("ipfs://") 
                      ? `https://gateway.pinata.cloud/ipfs/${metadataURI.replace("ipfs://", "")}`
                      : metadataURI;
                    const r = await fetch(ipfsUrl);
                    meta = await r.json();
                  } catch {}
                }

                return { address: addr, sharesHeld: balance || BigInt(0), totalInvested: stats?.[0] || BigInt(0), totalPayouts: stats?.[1] || BigInt(0), metadataURI, meta } as InvestorData;
              } catch (investorErr) {
                console.error("[INVESTORS] Failed to fetch data for", addr, investorErr);
                return { address: addr, sharesHeld: BigInt(0), totalInvested: BigInt(0), totalPayouts: BigInt(0), meta: {} } as InvestorData;
              }
            });

            const invData = await Promise.all(investorPromises);
            setAnalytics(prev => prev ? { ...prev, investors: invData } : null);
          } catch (e) {
            console.error("Failed to fetch investors in background:", e);
          }
        };

        // Fire and forget
        fetchInvestors();

        // Fetch Job Budgets for 60% rule
        let jobBudgetSum = BigInt(0);
        try {
          const jobBoard = getContract({ client, chain: CHAIN, address: DEPLOYED_CONTRACTS.addresses.JobBoard as any });
          
          // Identify all possible addresses the user might have used as Client OR Freelancer
          const identityAddresses = [account.address.toLowerCase()];
          if (currentEoa) identityAddresses.push(currentEoa.toLowerCase());
          
          // Re-fetch profile address if not in scope (though we updated pAddr scope, safety first)
          let finalPAddr = pAddr;
          if (!finalPAddr) {
            try {
              const factory = getContract({ client, chain: CHAIN, address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory as any });
              finalPAddr = await readContract({ contract: factory, method: "function freelancerProfile(address) view returns (address)", params: [account.address] }) as string;
            } catch {}
          }
          if (finalPAddr && finalPAddr !== "0x0000000000000000000000000000000000000000") identityAddresses.push(finalPAddr.toLowerCase());

          // Unique addresses only
          const uniqueIdentities = Array.from(new Set(identityAddresses));
          console.log("[JOBS] Scanning identities:", uniqueIdentities);
          
          const allJobIds: bigint[] = [];
          for (const addr of uniqueIdentities) {
            try {
              // Check Client, Applied, and Direct Offer job roles
              const [clientJobs, appliedJobs, directOffers] = await Promise.all([
                readContract({ contract: jobBoard, method: "function jobsByClient(address) view returns (uint256[])", params: [addr] }).catch(() => []),
                readContract({ contract: jobBoard, method: "function getJobsAppliedBy(address) view returns (uint256[])", params: [addr] }).catch(() => []),
                readContract({ contract: jobBoard, method: "function getOffersToFreelancer(address) view returns (uint256[])", params: [addr] }).catch(() => [])
              ]) as [bigint[], bigint[], bigint[]];
              
              if (clientJobs) allJobIds.push(...clientJobs);
              if (appliedJobs) allJobIds.push(...appliedJobs);
              if (directOffers) allJobIds.push(...directOffers);
            } catch (e) { console.warn(`Failed to fetch jobs for ${addr}:`, e); }
          }
          
          const uniqueJobIds = Array.from(new Set(allJobIds));

          if (uniqueJobIds.length > 0) {
            const jobData = await Promise.all(uniqueJobIds.map(async (id) => {
              try {
                const res = await readContract({ 
                  contract: jobBoard, 
                  method: "function getJob(uint256) view returns (address,string,string,uint256,uint8,address,address,uint64,uint64,uint64,bytes32[],uint256)", 
                  params: [id] 
                }) as any;

                if (res && (Number(res[4]) === 2 || Number(res[4]) === 4)) { // Hired or Completed
                  const escrowAddr = res[6];
                  // If hired, check if escrow is terminal. If completed, it is terminal.
                  if (Number(res[4]) === 2 && escrowAddr && escrowAddr !== "0x0000000000000000000000000000000000000000") {
                    try {
                      const escrowC = getContract({ client, chain: CHAIN, address: escrowAddr });
                      const isTerminal = await readContract({ contract: escrowC, method: "function terminal() view returns (bool)" });
                      return isTerminal ? null : res;
                    } catch { return res; }
                  }
                  return res;
                }
              } catch { return null; }
              return null;
            }));

            jobData.forEach((res: any) => {
              if (res) jobBudgetSum += BigInt(res[3]);
            });
          }
        } catch (e) { console.error("Failed to fetch job budgets:", e); }

        setAnalytics({ tokenSupply: totalSupply, sharesSold, vaultStatus: vs, distributorStatus: ds, vaultBalance, investors, jobBudgetSum });
      }
    } catch (err) { console.error(err); } finally { setLoading(false); setRefreshing(false); setIsFirstLoad(false); }
  }, [account, eoaAddress]);

  useEffect(() => { 
    if (account) { 
      fetchAll(); 
      fetchBalances(); 
    } else { 
      // If no account, we can't be loading a company
      setLoading(false); 
      setIsFirstLoad(false); 
    } 
  }, [account, eoaAddress, fetchAll]);

  const handleRefresh = async () => { setRefreshing(true); await Promise.all([fetchAll(), fetchBalances()]); };

  // Vault operation handlers
  const handleWithdrawRaised = async () => {
    if (!account || !company) return;
    try {
      const a = parseFloat(withdrawAmt); if (isNaN(a) || a <= 0) return;
      const exec = await getExecutionAccount();
      // Use EOA as recipient if available, else SW
      const recipient = eoaAddress || account.address;
      const vault = getContract({ client, chain: CHAIN, address: company.vault as any });
      const tx = prepareContractCall({ contract: vault, method: "function withdrawRaised(uint256, address)", params: [BigInt(Math.floor(a * 1e6)), recipient] });
      await sendTransaction({ transaction: tx, account: exec });
      setWithdrawAmt(""); handleRefresh();
    } catch (err: any) { alert("Failed: " + err.message); }
  };

  const handleClaimSolo = async () => {
    if (!account || !company) return;
    try {
      setClaimLoading(true);
      const a = parseFloat(soloJobAmt); if (isNaN(a) || a <= 0) return;
      const exec = await getExecutionAccount();
      const vault = getContract({ client, chain: CHAIN, address: company.vault as any });
      const tx = prepareContractCall({ contract: vault, method: "function claimMonthlySoloJob(uint256)", params: [BigInt(Math.floor(a * 1e6))] });
      await sendTransaction({ transaction: tx, account: exec });
      setSoloJobAmt(""); handleRefresh();
    } catch (err: any) { alert("Failed: " + err.message); } finally { setClaimLoading(false); }
  };

  const handleEndRound = async () => {
    if (!account || !company) return;
    try {
      setEndRoundLoading(true);
      const exec = await getExecutionAccount();
      const saleC = getContract({ client, chain: CHAIN, address: company.sale as any });
      const tx = prepareContractCall({ contract: saleC, method: "function endRound()" });
      await sendTransaction({ transaction: tx, account: exec });
      handleRefresh();
    } catch (err: any) { alert("Failed: " + err.message); } finally { setEndRoundLoading(false); }
  };

  const handleClosePeriod = async () => {
    if (!account || !company) return;
    try {
      setClosePeriodLoading(true);
      const exec = await getExecutionAccount();
      const vault = getContract({ client, chain: CHAIN, address: company.vault as any });
      const tx = prepareContractCall({ contract: vault, method: "function closePeriod()" });
      await sendTransaction({ transaction: tx, account: exec });
      handleRefresh();
    } catch (err: any) { alert("Failed: " + err.message); } finally { setClosePeriodLoading(false); }
  };

  const handleSubmitExpenses = async () => {
    if (!account || !company) return;
    try {
      setExpenseLoading(true);
      const a = parseFloat(expenseAmt); if (isNaN(a) || a <= 0) return;
      const exec = await getExecutionAccount();
      const vault = getContract({ client, chain: CHAIN, address: company.vault as any });
      const tx = prepareContractCall({ contract: vault, method: "function submitExpenses(uint256)", params: [BigInt(Math.floor(a * 1e6))] });
      await sendTransaction({ transaction: tx, account: exec });
      setExpenseAmt(""); handleRefresh();
    } catch (err: any) { alert("Failed: " + err.message); } finally { setExpenseLoading(false); }
  };

  const handleWithdrawBusiness = async () => {
    if (!account || !company) return;
    try {
      setWithdrawBusinessLoading(true);
      const a = parseFloat(withdrawBusinessAmt); if (isNaN(a) || a <= 0) return;
      const exec = await getExecutionAccount();
      const recipient = eoaAddress || account.address;
      const vault = getContract({ client, chain: CHAIN, address: company.vault as any });
      const tx = prepareContractCall({ contract: vault, method: "function withdrawBusiness(uint256, address)", params: [BigInt(Math.floor(a * 1e6)), recipient] });
      await sendTransaction({ transaction: tx, account: exec });
      setWithdrawBusinessAmt(""); handleRefresh();
    } catch (err: any) { alert("Failed: " + err.message); } finally { setWithdrawBusinessLoading(false); }
  };

  const handleAcceptOwnership = async () => {
    if (!account || !company) return;
    try {
      setAcceptOwnershipLoading(true);
      const exec = await getExecutionAccount();
      // Accept ownership on vault, token, and distributor
      const vaultC = getContract({ client, chain: CHAIN, address: company.vault as any });
      const tokenC = getContract({ client, chain: CHAIN, address: company.token as any });
      const distC = getContract({ client, chain: CHAIN, address: company.distributor as any });
      try {
        const tx1 = prepareContractCall({ contract: vaultC, method: "function acceptOwnership()" });
        await sendTransaction({ transaction: tx1, account: exec });
      } catch (e) { console.warn("Vault acceptOwnership:", e); }
      try {
        const tx2 = prepareContractCall({ contract: tokenC, method: "function acceptOwnership()" });
        await sendTransaction({ transaction: tx2, account: exec });
      } catch (e) { console.warn("Token acceptOwnership:", e); }
      try {
        const tx3 = prepareContractCall({ contract: distC, method: "function acceptOwnership()" });
        await sendTransaction({ transaction: tx3, account: exec });
      } catch (e) { console.warn("Distributor acceptOwnership:", e); }
      setVaultOwnershipPending(false);
      handleRefresh();
    } catch (err: any) { alert("Failed: " + err.message); } finally { setAcceptOwnershipLoading(false); }
  };

  const handleLinkWallet = async () => {
    if (!account || !company) return;
    try {
      setLinkLoading(true);
      const exec = await getExecutionAccount();
      const registry = getContract({ client, chain: CHAIN, address: DEPLOYED_CONTRACTS.addresses.CompanyRegistry as any });
      const tx = prepareContractCall({ contract: registry, method: "function linkFreelancerProfile(address)", params: [account.address] });
      await sendTransaction({ transaction: tx, account: exec });
      handleRefresh();
    } catch (err: any) { alert("Failed: " + err.message); } finally { setLinkLoading(false); }
  };

  const handleTransfer = async () => {
    if (!account || !eoaAddress) return;
    try {
      setTransferLoading(true);
      const amt = parseFloat(transferAmt);
      if (isNaN(amt) || amt <= 0) return;

      const eoaAccount = (activeWallet as any).getAdminAccount?.();
      if (!eoaAccount && transferDirection === "EOA_TO_SW") throw new Error("Could not access EOA account");

      const swAccount = account;

      if (transferToken === "USDT") {
        const usdtC = getContract({ client, chain: CHAIN, address: DEPLOYED_CONTRACTS.addresses.MockUSDT as any });
        const tx = prepareContractCall({
          contract: usdtC,
          method: "function transfer(address to, uint256 amount)",
          params: [transferDirection === "EOA_TO_SW" ? swAccount.address : eoaAddress, BigInt(Math.floor(amt * 1e6))]
        });
        await sendTransaction({ transaction: tx, account: transferDirection === "EOA_TO_SW" ? eoaAccount : swAccount });
      } else {
        // MATIC Transfer
        const tx = {
          to: transferDirection === "EOA_TO_SW" ? swAccount.address : eoaAddress,
          value: BigInt(Math.floor(amt * 1e18)),
          chain: CHAIN,
          client
        } as any;
        await sendTransaction({ transaction: tx, account: transferDirection === "EOA_TO_SW" ? eoaAccount : swAccount });
      }

      setTransferAmt("");
      handleRefresh();
      alert("Transfer successful!");
    } catch (err: any) { alert("Transfer failed: " + err.message); } finally { setTransferLoading(false); }
  };

  if (!account) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh]">
        <Wallet className="w-16 h-16 text-muted-foreground opacity-50 mb-4" />
        <h2 className="text-xl font-bold">Connect Wallet</h2>
        <p className="text-muted-foreground text-sm">Please connect your smart wallet to access the founder portal.</p>
      </div>
    );
  }

  if (loading || isFirstLoad) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="mt-4 text-muted-foreground font-medium">Loading your company...</p>
      </div>
    );
  }

  if (!company) {
    return <CreateCompanyForm account={account} onSuccess={handleRefresh} buildExecAccount={getExecutionAccount} />;
  }

  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: "home", label: "Overview", icon: BarChart3 },
    { id: "round", label: "Round", icon: CircleDollarSign },
    { id: "investors", label: "Investors", icon: Users },
    { id: "vault", label: "Vault", icon: Landmark },
  ];
  // --- RENDER ---
  return (
    <div className="max-w-7xl mx-auto space-y-6 md:space-y-10 pb-24 w-full px-2 sm:px-4 md:px-6">

      {/* Premium Hub Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-8 pb-4 border-b border-border">
        <div className="space-y-2 md:space-y-4 min-w-0">
          <div className="flex items-center gap-3 md:gap-6">
             <div className="relative group/logo translate-y-0 md:translate-y-2 shrink-0">
                <div className="absolute -inset-1 bg-primary/20 rounded-2xl blur-lg group-hover/logo:opacity-100 opacity-50 transition duration-700"></div>
                <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-xl md:rounded-2xl bg-background border border-border flex items-center justify-center shadow-sm relative overflow-hidden">
                  {getGatewayUrl(company.meta?.image) ? (
                    <img src={getGatewayUrl(company.meta.image)} alt={company.meta.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-primary via-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-base md:text-2xl italic">
                       {company.meta?.name ? company.meta.name.substring(0, 2).toUpperCase() : "V"}
                    </div>
                  )}
                </div>
             </div>
             <div className="space-y-0.5 md:space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 md:gap-4">
                  <h1 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-black tracking-tighter text-foreground leading-tight">
                    {company.meta?.name || `Venture #${company.id.toString()}`}
                  </h1>
                  <span className="px-2 py-1 md:px-5 md:py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] shadow-inner shrink-0">
                    {company.sector}
                  </span>
                </div>

             </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 bg-surface backdrop-blur-3xl p-1.5 md:p-2 rounded-2xl md:rounded-[2.5rem] border border-border shadow-sm self-start md:self-auto">
           <button 
             onClick={handleRefresh}
             disabled={refreshing}
             className="flex items-center gap-1.5 md:gap-2 px-3 md:px-6 py-2 md:py-3 text-[10px] md:text-[11px] font-black tracking-[0.15em] md:tracking-[0.2em] text-muted-foreground rounded-full hover:bg-surface-secondary hover:text-foreground transition-all active:scale-95 disabled:opacity-50 uppercase"
           >
             <RefreshCw className={`w-3 h-3 md:w-3.5 md:h-3.5 ${refreshing ? "animate-spin" : ""}`} />
             Sync
           </button>
           <button onClick={() => setShowStartRound(!showStartRound)} disabled={company.round.active || !isLinked}
             className="px-4 md:px-8 py-2 md:py-3 bg-primary text-primary-foreground rounded-full font-black text-[10px] md:text-[11px] tracking-[0.15em] md:tracking-[0.2em] uppercase transition-all flex items-center gap-2 md:gap-3 hover:shadow-sm hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0">
             <Rocket className="w-3 h-3 md:w-4 md:h-4" />
             <span className="hidden sm:inline">{!isLinked ? "Link Profile" : company.round.active ? "Round Active" : "Launch Round"}</span>
             <span className="sm:hidden">{!isLinked ? "Link" : company.round.active ? "Active" : "Launch"}</span>
           </button>
        </div>
      </div>

      {/* Link Warning Banner */}
      {!isLinked && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="relative group overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-orange-500/20 blur opacity-50 group-hover:opacity-100 transition duration-700"></div>
          <div className="relative bg-amber-500/5 border border-amber-500/20 rounded-[2.5rem] p-6 flex flex-col sm:flex-row items-center justify-between gap-6 backdrop-blur-xl">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20 shadow-inner">
                <AlertCircle className="w-7 h-7 text-amber-500 animate-pulse" />
              </div>
              <div className="space-y-1">
                <p className="font-black text-amber-500 text-lg uppercase tracking-tight">Ecosystem Disconnect</p>
                <p className="text-sm text-amber-500/70 font-medium">Business operations are restricted until your Freelancer Profile is linked to this treasury.</p>
              </div>
            </div>
            <button onClick={handleLinkWallet} disabled={linkLoading} 
              className="px-10 py-4 bg-amber-500 text-black font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-amber-400 transition-all shadow-xl active:scale-95 disabled:opacity-50">
              {linkLoading ? "Syncing..." : "Link Profile Now"}
            </button>
          </div>
        </motion.div>
      )}

      {/* Professional Navigation */}
      <div className="flex gap-1 md:gap-2 bg-surface backdrop-blur-xl border border-border rounded-2xl md:rounded-3xl p-1.5 md:p-2 max-w-2xl mx-auto shadow-sm">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 md:gap-3 py-2.5 sm:py-3 md:py-4 px-2 sm:px-4 md:px-6 rounded-xl md:rounded-2xl text-[9px] sm:text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] transition-all relative ${activeTab === t.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-surface-secondary"}`}>
            {activeTab === t.id && (
              <motion.div layoutId="nav-glow" className="absolute inset-0 rounded-xl md:rounded-2xl bg-primary/20 blur-xl -z-10" />
            )}
            <t.icon className={`w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 ${activeTab === t.id ? "text-primary-foreground" : "text-muted-foreground/60"}`} /> 
            <span className="hidden xs:inline sm:inline">{t.label}</span>
            {t.id === "investors" && analytics?.investors?.length ? (
              <span className={`text-[8px] md:text-[9px] px-1 md:px-2 py-0.5 rounded-full ${activeTab === t.id ? "bg-background/20 text-primary-foreground" : "bg-primary/20 text-primary"}`}>
                {analytics.investors.length}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Tab Content Display */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4 }} className="relative z-10">

          {/* ========== HOME TAB: INTELLIGENCE OVERVIEW ========== */}
          {activeTab === "home" && (
            <div className="space-y-6">
              {/* Primary Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                {[
                  { label: "Equity Supply", value: fmtShares(analytics?.tokenSupply), icon: Coins, color: "text-blue-500", suffix: "Shares" },
                  { label: "Circulating", value: fmtShares(analytics?.sharesSold), icon: PieChart, color: "text-violet-500", suffix: "Shares" },
                  { label: "Revenue", value: fmtUSDT(analytics?.vaultStatus?.totalRevenue), icon: TrendingUp, color: "text-teal-500", suffix: "USDT" },
                  { label: "Treasury", value: fmtUSDT(analytics?.vaultBalance), icon: Landmark, color: "text-emerald-500", suffix: "USDT" },
                ].map((card, i) => (
                  <div key={i} className="bg-surface/50 border border-border rounded-xl md:rounded-2xl p-3 md:p-5 hover:bg-surface/80 transition-colors">
                    <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                      <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg bg-surface flex items-center justify-center border border-border shadow-sm shrink-0`}>
                        <card.icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${card.color}`} />
                      </div>
                      <p className="text-[9px] md:text-xs text-muted-foreground font-medium uppercase tracking-wider leading-tight">{card.label}</p>
                    </div>
                    <div className="flex items-baseline gap-1 md:gap-2">
                       <p className={`text-base md:text-2xl font-bold font-mono ${card.color}`}>{card.value}</p>
                       <span className="text-[9px] md:text-xs text-muted-foreground font-medium">{card.suffix}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Secondary Metrics Dashboard */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                {/* Ecosystem Stats Bento */}
                <div className="bg-surface border border-border rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-8 shadow-sm relative overflow-hidden h-full">
                  <div className="flex items-center gap-3 mb-5 md:mb-8 relative z-10">
                    <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                      <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                    </div>
                    <h3 className="text-base md:text-xl font-bold">Ecosystem Analytics</h3>
                  </div>
                  
                  <div className="space-y-3 md:space-y-4 relative z-10">
                     <div className="bg-surface-secondary/50 rounded-xl md:rounded-2xl p-4 md:p-5 border border-border/50 flex justify-between items-center group hover:bg-surface transition-colors">
                        <div>
                           <p className="text-xs text-muted-foreground mb-1">Total Shareholders</p>
                           <p className="text-xl md:text-2xl font-bold text-foreground">{analytics?.investors?.length || "0"}</p>
                        </div>
                        <Users className="w-7 h-7 md:w-8 md:h-8 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                     </div>
                     <div className="bg-surface-secondary/50 rounded-xl md:rounded-2xl p-4 md:p-5 border border-border/50 flex justify-between items-center group hover:bg-surface transition-colors">
                        <div>
                           <p className="text-xs text-muted-foreground mb-1">Valuation Rate</p>
                           <p className="text-base md:text-lg font-bold text-emerald-500">Stable</p>
                        </div>
                        <Activity className="w-7 h-7 md:w-8 md:h-8 text-muted-foreground/30 group-hover:text-emerald-500 transition-colors" />
                     </div>
                  </div>
                </div>

                {/* Security Status Bento */}
                <div className="bg-surface border border-border rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-8 shadow-sm relative overflow-hidden h-full">
                  <div className="flex items-center gap-3 mb-5 md:mb-8 relative z-10">
                    <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                      <Shield className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
                    </div>
                    <h3 className="text-base md:text-xl font-bold">Security & On-Chain Status</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4 relative z-10">
                    <div className="bg-emerald-500/5 rounded-2xl p-5 border border-emerald-500/20 text-center">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      </div>
                      <p className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-widest mb-1">Ledger Sync</p>
                      <p className="text-lg font-bold text-emerald-600">ACTIVE</p>
                    </div>
                    <div className="bg-blue-500/5 rounded-2xl p-5 border border-blue-500/20 text-center">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-3">
                        <Building2 className="w-4 h-4 text-blue-500" />
                      </div>
                      <p className="text-[10px] font-bold text-blue-600/80 uppercase tracking-widest mb-1">Core Contracts</p>
                      <p className="text-lg font-bold text-blue-600">VERIFIED</p>
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-surface-secondary rounded-xl border border-border flex items-start gap-3 relative z-10">
                    <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      All financial data is synced directly from Polygon Amoy. Vault rules enforce strict 10% min investor distributions and 70% max expense limits.
                    </p>
                  </div>
                </div>
              </div>

              {/* Active Round Quick View Enhanced */}
              {company.round.active && (
                <div className="bg-gradient-to-br from-primary/10 via-surface to-blue-500/10 rounded-[1.5rem] sm:rounded-[2rem] md:rounded-[2.5rem] p-4 sm:p-6 md:p-10 border border-primary/20 shadow-xl relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 md:gap-8 relative z-10">
                    <div className="flex items-center gap-3 md:gap-6">
                      <div className="w-11 h-11 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-white flex items-center justify-center border border-border shadow-sm shrink-0">
                        <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-primary/10 flex items-center justify-center">
                          <CircleDollarSign className="w-4 h-4 md:w-6 md:h-6 text-primary" />
                        </div>
                      </div>
                      <div>
                        <span className="px-2 py-0.5 md:px-3 md:py-1 rounded-full bg-primary/10 text-primary text-[9px] md:text-[10px] font-bold uppercase tracking-wider mb-1 md:mb-2 inline-block">Active Capital Acquisition</span>
                        <h3 className="text-xl md:text-3xl font-bold text-foreground">Round #{company.round.roundId.toString()}</h3>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 md:gap-4 w-full sm:w-auto">
                      <div className="bg-surface/80 backdrop-blur-sm rounded-xl md:rounded-2xl p-3 md:px-6 md:py-5 border border-border text-center">
                         <p className="text-[9px] md:text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Current Valuation</p>
                         <p className="text-base md:text-xl font-bold font-mono text-emerald-500">{fmtPrice(company.round.pricePerShare)} <span className="text-[9px] md:text-xs">USDT</span></p>
                      </div>
                      <div className="bg-surface/80 backdrop-blur-sm rounded-xl md:rounded-2xl p-3 md:px-6 md:py-5 border border-border text-center">
                         <p className="text-[9px] md:text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Available Shares</p>
                         <p className="text-base md:text-xl font-bold font-mono text-foreground">{fmtShares(company.round.sharesRemaining)}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 md:mt-8 flex justify-end">
                    <button onClick={() => setActiveTab("round")} className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                      Manage Round Details <ChevronDown className="w-4 h-4 -rotate-90" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========== ROUND TAB: CAPITAL STRATEGY ========== */}
          {activeTab === "round" && (
            <div className="space-y-6">
              <div className="bg-surface border border-border rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-8 lg:p-10 shadow-sm relative overflow-hidden h-full">
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 relative z-10">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                        <TrendingUp className="w-5 h-5 text-primary" />
                      </div>
                      Capital Strategies
                    </h3>
                    <p className="text-muted-foreground text-sm">Manage corporate share issuance and financing rounds.</p>
                  </div>
                  <div className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border ${company.round.active ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-surface-secondary text-muted-foreground border-border"}`}>
                    {company.round.active ? `Round #${company.round.roundId.toString()} Operational` : company.round.roundId > BigInt(0) ? `Last Cycle: Round #${company.round.roundId.toString()}` : "No Active Rounds"}
                  </div>
                </div>

                {company.round.active ? (
                  <div className="space-y-10 relative z-10">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="p-5 bg-surface-secondary/50 rounded-2xl border border-border/50 text-center">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Round ID</p>
                        <p className="font-bold text-2xl text-foreground">#{company.round.roundId.toString()}</p>
                      </div>
                      <div className="p-5 bg-surface-secondary/50 rounded-2xl border border-border/50 text-center">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Unit Valuation</p>
                        <p className="font-bold text-2xl text-emerald-500 font-mono">{fmtPrice(company.round.pricePerShare)} <span className="text-xs text-muted-foreground">USDT</span></p>
                      </div>
                      <div className="p-5 bg-surface-secondary/50 rounded-2xl border border-border/50 text-center">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Shares Issued</p>
                        <p className="font-bold text-2xl text-foreground">{fmtShares(company.round.sharesRemaining)}</p>
                      </div>
                      <div className="p-5 bg-surface-secondary/50 rounded-2xl border border-border/50 text-center">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Target Capital</p>
                        <p className="font-bold text-2xl text-amber-500 font-mono">{fmtUSDT(company.round.sharesRemaining * company.round.pricePerShare / BigInt(1e18))} <span className="text-xs text-muted-foreground">USDT</span></p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {analytics && analytics.tokenSupply > BigInt(0) && (
                      <div className="p-6 sm:p-8 bg-surface-secondary rounded-[2rem] border border-border shadow-sm">
                        <div className="flex justify-between items-end mb-4">
                          <div>
                             <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Market Reception</p>
                             <p className="text-lg font-bold text-foreground">Absorption Progress</p>
                          </div>
                          <p className="font-mono text-2xl font-bold text-primary">
                            {Math.min(100, Number(analytics.sharesSold * BigInt(100) / analytics.tokenSupply))}%
                          </p>
                        </div>
                        <div className="w-full bg-background rounded-full h-3 overflow-hidden border border-border shadow-inner">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Number(analytics.sharesSold * BigInt(100) / analytics.tokenSupply))}%` }}
                            className="h-full bg-primary rounded-full"></motion.div>
                        </div>
                        <div className="flex justify-between mt-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                           <span>Allocated: {fmtShares(analytics.sharesSold)}</span>
                           <span>Total Supply: {fmtShares(analytics.tokenSupply)}</span>
                        </div>
                      </div>
                    )}

                    <button onClick={handleEndRound} disabled={endRoundLoading}
                      className="w-full py-4 bg-red-500/10 text-red-500 border border-red-500/20 font-bold text-sm rounded-xl hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center gap-2 group shadow-sm">
                      {endRoundLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 group-hover:rotate-90 transition-transform" />} 
                      Terminate Current Round
                    </button>
                  </div>
                ) : (
                  <div className="py-20 text-center relative z-10 flex flex-col items-center">
                    <div className="w-20 h-20 bg-surface-secondary rounded-full flex items-center justify-center border border-border mb-6">
                       <CircleDollarSign className="w-10 h-10 text-muted-foreground/30" />
                    </div>
                    <p className="text-muted-foreground text-lg font-medium mb-8 max-w-sm">No active funding rounds. Configure a new round to raise seed capital.</p>
                    <button onClick={() => setShowStartRound(true)} disabled={!isLinked}
                      className="px-8 py-3.5 bg-primary text-white font-bold text-sm rounded-xl hover:bg-primary/90 transition-colors active:scale-95 disabled:opacity-50 shadow-sm flex items-center gap-2">
                      <Rocket className="w-4 h-4" />
                      Configure New Round
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* ========== INVESTORS TAB ========== */}
          {activeTab === "investors" && (
            <div className="space-y-6">
              {/* Summary strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-surface/50 border border-border rounded-2xl p-5 hover:bg-surface/80 transition-colors">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Total Investors</p>
                  <p className="text-2xl font-bold text-foreground">{analytics?.investors?.length || 0}</p>
                </div>
                <div className="bg-surface/50 border border-border rounded-2xl p-5 hover:bg-surface/80 transition-colors">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Total Invested</p>
                  <p className="text-2xl font-bold text-emerald-500 font-mono">{fmtUSDT(analytics?.investors?.reduce((sum, inv) => sum + inv.totalInvested, BigInt(0)))} <span className="text-xs font-sans text-muted-foreground">USDT</span></p>
                </div>
                <div className="bg-surface/50 border border-border rounded-2xl p-5 hover:bg-surface/80 transition-colors">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Total Shares Held</p>
                  <p className="text-2xl font-bold text-blue-500 font-mono">{fmtShares(analytics?.investors?.reduce((sum, inv) => sum + inv.sharesHeld, BigInt(0)))}</p>
                </div>
                <div className="bg-surface/50 border border-border rounded-2xl p-5 hover:bg-surface/80 transition-colors">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Total Dividends</p>
                  <p className="text-2xl font-bold text-amber-500 font-mono">{fmtUSDT(analytics?.investors?.reduce((sum, inv) => sum + inv.totalPayouts, BigInt(0)))} <span className="text-xs font-sans text-muted-foreground">USDT</span></p>
                </div>
              </div>

              {/* Investor Cards */}
              {analytics?.investors && analytics.investors.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {analytics.investors.map((inv, i) => (
                    <motion.button key={i} onClick={() => setSelectedInvestor(inv)}
                      whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
                      className="bg-surface border border-border rounded-2xl p-6 text-left hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group">
                      {/* Header */}
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0 border border-primary/20">
                          {inv.meta?.name ? inv.meta.name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-lg truncate group-hover:text-primary transition-colors">{inv.meta?.name || "Anonymous"}</p>
                          <p className="text-xs text-muted-foreground font-mono">{shortAddr(inv.address)}</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                      
                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-surface-secondary/50 rounded-xl p-3 border border-border/50 text-center">
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Shares</p>
                          <p className="text-sm font-bold font-mono">{fmtShares(inv.sharesHeld)}</p>
                        </div>
                        <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/10 text-center">
                          <p className="text-[10px] text-emerald-600/80 font-bold uppercase tracking-widest mb-1">Invested</p>
                          <p className="text-sm font-bold font-mono text-emerald-600">{fmtUSDT(inv.totalInvested)}</p>
                        </div>
                        <div className="bg-amber-500/5 rounded-xl p-3 border border-amber-500/10 text-center">
                          <p className="text-[10px] text-amber-600/80 font-bold uppercase tracking-widest mb-1">Earned</p>
                          <p className="text-sm font-bold font-mono text-amber-600">{fmtUSDT(inv.totalPayouts)}</p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              ) : (
                <div className="bg-surface border border-dashed border-border rounded-3xl py-20 text-center">
                  <div className="w-16 h-16 bg-surface-secondary rounded-full flex items-center justify-center mx-auto mb-4 border border-border">
                    <Users className="w-8 h-8 text-muted-foreground/40" />
                  </div>
                  <p className="text-lg font-bold text-foreground mb-2">No Investors Yet</p>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">Start a funding round to attract investors and distribute equity.</p>
                </div>
              )}
            </div>
          )}

          {/* ========== VAULT TAB ========== */}
          {activeTab === "vault" && (
            <div className="space-y-8">
              {/* EOA Balance Display (Top) */}
              <div className="bg-surface border border-primary/20 rounded-xl md:rounded-[2rem] p-4 md:p-6 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 left-0 w-1 md:w-1.5 h-full bg-primary/80"></div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-6 pl-2">
                  <div>
                    <h3 className="font-bold text-sm md:text-lg flex items-center gap-2">
                      <Wallet className="w-4 h-4 md:w-5 md:h-5 text-primary" /> Personal EOA Wallet
                    </h3>
                    <p className="text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1">Personal account for gas and transfers.</p>
                  </div>
                  <div className="flex flex-wrap gap-2 md:gap-4">
                    <div className="flex items-center gap-2 md:gap-4 bg-background px-3 py-2 md:px-5 md:py-3 rounded-xl md:rounded-2xl border border-border">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                        <Coins className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase font-bold tracking-wider">EOA MATIC</p>
                        <p className="text-sm md:text-base font-bold font-mono text-foreground">{eoaMaticBal ? Number(eoaMaticBal).toFixed(3) : "0.000"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4 bg-background px-3 py-2 md:px-5 md:py-3 rounded-xl md:rounded-2xl border border-border">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-teal-500/10 flex items-center justify-center border border-teal-500/20">
                        <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-teal-500" />
                      </div>
                      <div>
                        <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase font-bold tracking-wider">EOA USDT</p>
                        <p className="text-sm md:text-base font-bold font-mono text-foreground">{eoaUsdtBal ? Number(eoaUsdtBal).toFixed(3) : "0.000"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ownership Acceptance Banner */}
              {vaultOwnershipPending && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <AlertCircle className="w-24 h-24 text-amber-500" />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
                    <div>
                      <h4 className="font-bold text-lg text-amber-500 flex items-center gap-2 mb-2">
                        <AlertCircle className="w-5 h-5" /> Ownership Transfer Pending
                      </h4>
                      <p className="text-sm text-foreground/80 max-w-2xl leading-relaxed">Your contracts use Ownable2Step. You must accept ownership before you can perform any vault operations including submitting expenses, withdrawing profits, or closing accounting periods.</p>
                    </div>
                    <button onClick={handleAcceptOwnership} disabled={acceptOwnershipLoading}
                      className="px-6 py-3.5 bg-amber-500 text-black font-bold text-sm rounded-xl hover:bg-amber-400 transition-colors disabled:opacity-50 shrink-0 flex items-center gap-2 shadow-sm whitespace-nowrap">
                      {acceptOwnershipLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Accepting...</> : <><CheckCircle2 className="w-4 h-4" /> Accept Ownership</>}
                    </button>
                  </div>
                </div>
              )}
              
              {/* Vault Overview Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
                {[
                  { label: "Vault Balance", value: fmtUSDT(analytics?.vaultBalance), icon: Landmark, color: "text-emerald-500", sub: "USDT on-chain" },
                  { label: "Total Revenue", value: fmtUSDT(analytics?.vaultStatus?.totalRevenue), icon: ArrowDownToLine, color: "text-teal-500", sub: "Completed jobs" },
                  { label: "Expenses", value: fmtUSDT(analytics?.vaultStatus?.totalExpenses), icon: Receipt, color: "text-orange-500", sub: "Claimed" },
                  { label: "Distributed", value: fmtUSDT(analytics?.vaultStatus?.totalDistributed), icon: Users, color: "text-pink-500", sub: "Dividends" },
                  { label: "Raised Total", value: fmtUSDT(analytics?.vaultStatus?.raisedTotal), icon: TrendingUp, color: "text-blue-500", sub: "Share sales" },
                  { label: "Raised Used", value: fmtUSDT(analytics?.vaultStatus?.raisedWithdrawn), icon: ArrowUpFromLine, color: "text-amber-500", sub: "Withdrawn" },
                  { label: "Owner Profit", value: fmtUSDT(analytics?.vaultStatus?.ownerWithdrawable), icon: Wallet, color: "text-violet-500", sub: "Withdrawable" },
                  { label: "Available", value: fmtUSDT(analytics?.vaultStatus?.raisedWithdrawableAmt), icon: DollarSign, color: "text-cyan-500", sub: "Raised avail." },
                ].map((card, i) => (
                  <div key={i} className="bg-surface border border-border rounded-xl md:rounded-2xl p-3 md:p-5 hover:bg-surface-secondary transition-colors group">
                    <div className="flex items-start justify-between mb-2 md:mb-3">
                      <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-background flex items-center justify-center border border-border">
                        <card.icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${card.color}`} />
                      </div>
                    </div>
                    <p className="text-[9px] md:text-xs font-semibold text-muted-foreground mb-0.5 md:mb-1">{card.label}</p>
                    <p className="text-sm md:text-xl font-bold font-mono text-foreground mb-0.5 md:mb-1">{card.value}</p>
                    <p className="text-[8px] md:text-[10px] text-muted-foreground/80 hidden sm:block">{card.sub}</p>
                  </div>
                ))}
              </div>

              {/* Operations and Accounting Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Main Content (Left) */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                  
                  {/* Current Period Accounting (Horizontal Banner) */}
                  <div className="bg-surface border border-border rounded-[2rem] p-6 lg:p-8 shadow-sm relative overflow-hidden shrink-0">
                    
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 relative z-10">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner shrink-0">
                          <Activity className="w-6 h-6 text-teal-500" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-foreground">Active Accounting Cycle</h3>
                          <p className="text-sm text-muted-foreground">Current period revenue and expense tracking</p>
                        </div>
                      </div>
                      <button onClick={handleClosePeriod} disabled={closePeriodLoading || !analytics?.vaultStatus?.periodRevenue}
                        className="px-6 py-3.5 bg-teal-500/10 text-teal-500 border border-teal-500/20 font-bold rounded-xl hover:bg-teal-500 hover:text-white transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm text-sm whitespace-nowrap active:scale-95 shrink-0">
                        {closePeriodLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                        Close Period & Distribute
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10 w-full overflow-hidden">
                      <div className="bg-background rounded-2xl p-3 md:p-5 border border-border hover:border-teal-500/30 transition-colors flex flex-col justify-center min-w-0">
                        <p className="text-[8px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 md:mb-2 flex items-center gap-1.5 truncate"><Activity className="w-3 h-3 text-teal-500 shrink-0" /> Revenue</p>
                        <p className="text-base sm:text-xl md:text-2xl font-black text-foreground font-mono truncate">{fmtUSDT(analytics?.vaultStatus?.periodRevenue)}</p>
                      </div>
                      <div className="bg-background rounded-2xl p-3 md:p-5 border border-border hover:border-orange-500/30 transition-colors flex flex-col justify-center min-w-0">
                        <p className="text-[8px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 md:mb-2 flex items-center gap-1.5 truncate"><Receipt className="w-3 h-3 text-orange-500 shrink-0" /> Expenses</p>
                        <p className="text-base sm:text-xl md:text-2xl font-black text-foreground font-mono truncate">{fmtUSDT(analytics?.vaultStatus?.periodExpenses)}</p>
                      </div>
                      <div className="bg-background rounded-2xl p-3 md:p-5 border border-border hover:border-amber-500/30 transition-colors flex flex-col justify-center min-w-0">
                        <p className="text-[8px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 md:mb-2 flex items-center gap-1.5 truncate"><Shield className="w-3 h-3 text-amber-500 shrink-0" /> Max / 70%</p>
                        <p className="text-base sm:text-xl md:text-2xl font-black text-foreground font-mono truncate">
                          {analytics?.vaultStatus?.periodRevenue ? fmtUSDT(analytics.vaultStatus.periodRevenue * BigInt(7000) / BigInt(10000)) : "0.00"}
                        </p>
                      </div>
                      <div className="bg-background rounded-2xl p-3 md:p-5 border border-border hover:border-emerald-500/30 transition-colors flex flex-col justify-center min-w-0">
                        <p className="text-[8px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 md:mb-2 flex items-center gap-1.5 truncate"><TrendingUp className="w-3 h-3 text-emerald-500 shrink-0" /> Net Profit</p>
                        <p className="text-base sm:text-xl md:text-2xl font-black text-emerald-500 font-mono truncate">
                          {analytics?.vaultStatus?.periodRevenue && analytics.vaultStatus.periodRevenue > analytics.vaultStatus.periodExpenses
                            ? fmtUSDT(analytics.vaultStatus.periodRevenue - analytics.vaultStatus.periodExpenses)
                            : "0.00"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Treasury Operations Grid - 2 columns side-by-side on md+ */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">
                    
                    {/* Withdraw Business Profits */}
                    <div className="bg-surface border border-border rounded-[2rem] p-6 shadow-sm flex flex-col h-full">
                      <div className="flex items-center gap-3 mb-2 mt-2">
                         <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                            <Wallet className="w-5 h-5 text-emerald-500" />
                         </div>
                         <div>
                           <h4 className="font-bold text-lg leading-tight">Withdraw Profit</h4>
                           <p className="text-[10px] text-muted-foreground mt-0.5">Transfer accumulated owner share to your EOA.</p>
                         </div>
                      </div>
                      
                      <div className="bg-emerald-500/5 rounded-2xl p-5 border border-emerald-500/10 mb-6 mt-6 flex-grow flex flex-col justify-center">
                        <div className="flex items-center justify-between mb-2">
                           <p className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-widest">Available to Withdraw</p>
                           <button onClick={() => setWithdrawBusinessAmt(fmtUSDT(analytics?.vaultStatus?.ownerWithdrawable).replaceAll(",", ""))} className="text-[9px] font-bold text-emerald-600 hover:text-white hover:bg-emerald-500 transition-colors uppercase tracking-wider bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20 active:scale-95">MAX</button>
                        </div>
                        <p className="text-2xl sm:text-3xl font-black font-mono text-emerald-600">{fmtUSDT(analytics?.vaultStatus?.ownerWithdrawable)} <span className="text-[10px] sm:text-xs text-emerald-600/60 font-sans tracking-normal">USDT</span></p>
                      </div>

                      <div className="flex gap-2">
                        <input type="number" placeholder="0.00" value={withdrawBusinessAmt} 
                          onChange={e => {
                            const val = e.target.value;
                            const max = Number(analytics?.vaultStatus?.ownerWithdrawable || 0) / 1e6;
                            if (Number(val) <= max) setWithdrawBusinessAmt(val);
                          }}
                          className="w-full text-sm font-mono bg-background border border-border rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-colors shadow-inner" />
                        <button onClick={handleWithdrawBusiness} disabled={!withdrawBusinessAmt || withdrawBusinessLoading}
                          className="px-6 py-3 bg-emerald-500 text-white font-bold rounded-xl text-sm hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50 shrink-0 shadow-md">
                          {withdrawBusinessLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Withdraw"}
                        </button>
                      </div>
                    </div>

                    {/* Withdraw Raised Funds */}
                    <div className="bg-surface border border-border rounded-[2rem] p-6 shadow-sm flex flex-col h-full">
                      <div className="flex items-center gap-3 mb-2 mt-2">
                         <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">
                            <Rocket className="w-5 h-5 text-amber-500" />
                         </div>
                         <div>
                           <h4 className="font-bold text-lg leading-tight">Deploy Capital</h4>
                           <p className="text-[10px] text-muted-foreground mt-0.5">Withdraw funds up to 60% of your hired budgets.</p>
                         </div>
                      </div>
                      
                      <div className="bg-amber-500/5 rounded-2xl p-5 border border-amber-500/10 mb-6 mt-6 flex-grow flex flex-col justify-center">
                        <div className="flex items-center justify-between mb-2">
                           <p className="text-[10px] font-bold text-amber-600/80 uppercase tracking-widest">Available Allowance</p>
                           <button onClick={() => {
                              const totalHiredBudget = Number(analytics?.jobBudgetSum || 0);
                              const totalWithdrawn = Number(analytics?.vaultStatus?.raisedWithdrawn || 0);
                              const remainingAllowance = Math.max(0, (totalHiredBudget * 0.6) - totalWithdrawn);
                              const cashLimit = Number(analytics?.vaultStatus?.raisedWithdrawableAmt || 0) / 1e6;
                              setWithdrawAmt(Math.min(remainingAllowance / 1e6, cashLimit).toFixed(2));
                            }} className="text-[9px] font-bold text-amber-600 hover:text-white hover:bg-amber-500 transition-colors uppercase tracking-wider bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20 active:scale-95">MAX</button>
                        </div>
                        <p className="text-2xl sm:text-3xl font-black font-mono text-amber-600">
                          {fmtUSDT(BigInt(Math.max(0, (Number(analytics?.jobBudgetSum || 0) * 0.6) - Number(analytics?.vaultStatus?.raisedWithdrawn || 0))))}
                          <span className="text-[10px] sm:text-xs text-amber-600/60 font-sans ml-1 tracking-normal">USDT</span>
                        </p>
                        <p className="text-[10px] text-amber-600/80 mt-2 font-medium flex justify-between uppercase tracking-wider">
                           <span>Vault Max: <span className="font-bold font-mono text-amber-600">{fmtUSDT(analytics?.vaultStatus?.raisedWithdrawableAmt)}</span></span>
                           <span>Hired: <span className="font-bold font-mono text-amber-600">{fmtUSDT(analytics?.jobBudgetSum)}</span></span>
                        </p>
                      </div>

                      <div className="flex gap-2 relative">
                        <input type="number" placeholder="0.00" value={withdrawAmt} 
                          onChange={e => {
                            const val = e.target.value;
                            const totalHiredBudget = Number(analytics?.jobBudgetSum || 0);
                            const totalWithdrawn = Number(analytics?.vaultStatus?.raisedWithdrawn || 0);
                            const remainingAllowance = Math.max(0, (totalHiredBudget * 0.6) - totalWithdrawn);
                            const cashLimit = Number(analytics?.vaultStatus?.raisedWithdrawableAmt || 0) / 1e6;
                            const actualMax = Math.min(remainingAllowance / 1e6, cashLimit);
                            if (Number(val) <= actualMax) setWithdrawAmt(val);
                          }}
                          className="w-full text-sm font-mono bg-background border border-border rounded-xl px-4 py-3 outline-none focus:border-amber-500 transition-colors shadow-inner" />
                        <button onClick={handleWithdrawRaised} disabled={!withdrawAmt}
                          className="px-6 py-3 bg-amber-500 text-white font-bold rounded-xl text-sm hover:bg-amber-600 transition-all active:scale-95 disabled:opacity-50 shrink-0 shadow-md">
                          Withdraw
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sidebar (Right) */}
                <div className="lg:col-span-4 h-full">
                  {/* Smart Rules Vertical List */}
                  <div className="bg-surface border border-border rounded-[2rem] p-6 sm:p-8 shadow-sm h-full relative overflow-hidden flex flex-col">

                    <div className="flex items-center gap-4 mb-8 relative z-10 w-full">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                        <Shield className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">Protocol Rules</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Immutable on-chain execution</p>
                      </div>
                    </div>

                    <div className="flex-grow flex flex-col gap-4 relative z-10">
                      <div className="p-5 bg-background rounded-[1.5rem] border border-border flex items-center gap-5 hover:border-emerald-500/30 transition-colors group">
                         <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 text-emerald-500">
                            <ArrowDownToLine className="w-5 h-5 group-hover:scale-110 group-hover:text-emerald-400 transition-all" />
                         </div>
                         <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Revenue Floor</p>
                            <p className="text-sm font-bold text-foreground">10% of Total Revenue</p>
                         </div>
                      </div>
                      
                      <div className="p-5 bg-background rounded-[1.5rem] border border-border flex items-center gap-5 hover:border-blue-500/30 transition-colors group">
                         <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20 text-blue-500">
                            <PieChart className="w-5 h-5 group-hover:scale-110 group-hover:text-blue-400 transition-all" />
                         </div>
                         <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Profit Share</p>
                            <p className="text-sm font-bold text-foreground">40% of Net Profit</p>
                         </div>
                      </div>
                      
                      <div className="p-5 bg-background rounded-[1.5rem] border border-border flex items-center gap-5 hover:border-amber-500/30 transition-colors group">
                         <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20 text-amber-500">
                            <Receipt className="w-5 h-5 group-hover:scale-110 group-hover:text-amber-400 transition-all" />
                         </div>
                         <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Expense Cap</p>
                            <p className="text-sm font-bold text-foreground">Max 70% of Revenue</p>
                         </div>
                      </div>
                      
                      <div className="p-5 bg-background rounded-[1.5rem] border border-border flex items-center gap-5 hover:border-violet-500/30 transition-colors group">
                         <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0 border border-violet-500/20 text-violet-500">
                            <Clock className="w-5 h-5 group-hover:scale-110 group-hover:text-violet-400 transition-all" />
                         </div>
                         <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Solo Job Claim</p>
                            <p className="text-sm font-bold text-foreground">Permitted Every 30 Days</p>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Contract Addresses */}
              <div className="bg-surface border border-border rounded-[2rem] p-8 shadow-sm">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                   <Settings className="w-5 h-5 text-muted-foreground" /> Infrastructure Contracts
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {[
                    { label: "Owner Key (EOA)", addr: company.owner, highlight: true },
                    { label: "Equity Token", addr: company.token },
                    { label: "Sale Controller", addr: company.sale },
                    { label: "Treasury Vault", addr: company.vault },
                    { label: "Dividend Distributor", addr: company.distributor },
                  ].map((item, i) => (
                    <div key={i} className={`flex flex-col p-4 rounded-2xl border ${item.highlight ? "bg-primary/5 border-primary/20" : "bg-background border-border"}`}>
                      <span className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${item.highlight ? "text-primary" : "text-muted-foreground"}`}>{item.label}</span>
                      <a href={`https://amoy.polygonscan.com/address/${item.addr}`} target="_blank" rel="noopener noreferrer"
                        className={`text-sm font-mono truncate hover:underline flex items-center gap-1 w-full ${item.highlight ? "text-foreground" : "text-primary"}`}>
                        {shortAddr(item.addr)} <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>

      {/* Modals */}
      {showStartRound && company && !company.round.active && (
        <StartRoundModal company={company} onClose={() => setShowStartRound(false)} onSuccess={handleRefresh} buildExecAccount={getExecutionAccount} />
      )}
      {selectedInvestor && (
        <InvestorPopup investor={selectedInvestor} onClose={() => setSelectedInvestor(null)} />
      )}
    </div>
  );
}
