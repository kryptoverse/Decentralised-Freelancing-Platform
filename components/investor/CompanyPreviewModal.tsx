"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import {
  getContract, readContract, prepareContractCall,
  sendTransaction, waitForReceipt, prepareEvent, getContractEvents
} from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ExternalLink, Shield, Briefcase, Users, TrendingUp,
  CircleDollarSign, Clock, Settings, Info, Loader2,
  CheckCircle2, Rocket, BarChart3, DollarSign, Coins, Activity,
  Building2, AlertCircle, UserPlus, Gift, RefreshCw
} from "lucide-react";

import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";

// ─── Types ──────────────────────────────────────────────────
interface RoundInfo {
  roundId: bigint;
  pricePerShare: bigint;
  sharesRemaining: bigint;
  active: boolean;
}

interface CompanyInputData {
  id: bigint;
  owner: string;
  token: string;
  sale: string;
  vault: string;
  distributor: string;
  sector: string;
  meta: any;
  round: RoundInfo;
}

interface CompanyDetailData {
  tokenSupply: bigint;
  sharesSold: bigint;
  raisedTotal: bigint;
  totalDistributed: bigint;
  investorCount: number;
  jobsCompleted: number;
  vaultBalance: bigint;
}

// ─── Helpers ─────────────────────────────────────────────────
function shortAddr(a: string) {
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

function fmtUSDT(raw: bigint | undefined) {
  if (!raw) return "0.00";
  return (Number(raw) / 1e6).toLocaleString("en-US", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function fmtShares(raw: bigint | undefined) {
  if (!raw) return "0";
  return Math.round(Number(raw) / 1e18).toLocaleString("en-US");
}

function fmtPrice(raw: bigint | undefined) {
  if (!raw) return "0.00";
  return (Number(raw) / 1e6).toLocaleString("en-US", {
    minimumFractionDigits: 2, maximumFractionDigits: 6,
  });
}

function getGatewayUrl(uri: string | undefined) {
  if (!uri) return undefined;
  if (uri.startsWith("ipfs://"))
    return `https://gateway.pinata.cloud/ipfs/${uri.replace("ipfs://", "")}`;
  return uri;
}

// ─── Main Component ──────────────────────────────────────────
export function CompanyPreviewModal({
  company,
  open,
  onClose,
  onInvest,
}: {
  company: CompanyInputData | null;
  open: boolean;
  onClose: () => void;
  onInvest: () => void;
}) {
  const activeAccount = useActiveAccount();
  const [details, setDetails] = useState<CompanyDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [navbarHeight, setNavbarHeight] = useState(65);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Mount, detect mobile, measure navbar height
  useEffect(() => {
    setMounted(true);
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);

    // Measure the TOP navbar height precisely using its id.
    // Do NOT use querySelector('nav') — that finds the sidebar nav element (full-height).
    const navbar = document.getElementById("top-navbar");
    if (navbar) setNavbarHeight(navbar.offsetHeight);

    return () => window.removeEventListener("resize", check);
  }, []);

  // Always lock body scroll (portal is always on document.body)
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Force backdrop scroll to top every time the modal opens
  // (Framer Motion y-animation can trigger auto-scroll to bottom in overflow containers)
  useEffect(() => {
    if (open && backdropRef.current) {
      backdropRef.current.scrollTop = 0;
    }
  }, [open]);

  // Check investor profile
  useEffect(() => {
    async function checkProfile() {
      if (!activeAccount) return;
      try {
        const reg = getContract({ client, chain: CHAIN, address: DEPLOYED_CONTRACTS.addresses.InvestorRegistry as any });
        const profile = await readContract({
          contract: reg,
          method: "function profiles(address) view returns (string, bool)",
          params: [activeAccount.address]
        }) as any;
        setHasProfile(profile[1]);
      } catch { setHasProfile(false); }
    }
    if (open) checkProfile();
  }, [activeAccount, open]);

  const fetchDetails = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    try {
      // Resolve vault address — if not passed (portfolio view), fetch from registry
      let vaultAddr = company.vault;
      if (!vaultAddr) {
        try {
          const registry = getContract({ client, chain: CHAIN, address: DEPLOYED_CONTRACTS.addresses.CompanyRegistry as any });
          const cData: any = await readContract({
            contract: registry,
            method: "function getCompany(uint256) view returns ((address owner, address token, address sale, address vault, address distributor, string metadataURI, string sector, bool exists))",
            params: [company.id]
          });
          vaultAddr = cData.vault;
        } catch {}
      }

      const tokenC = getContract({ client, chain: CHAIN, address: company.token as any });
      const saleC  = getContract({ client, chain: CHAIN, address: company.sale as any });
      const vaultC = vaultAddr ? getContract({ client, chain: CHAIN, address: vaultAddr as any }) : null;

      const [totalSupply, saleBalance, vaultStatus] = await Promise.all([
        readContract({ contract: tokenC, method: "function totalSupply() view returns (uint256)" }).catch(() => 0n) as Promise<bigint>,
        readContract({ contract: tokenC, method: "function balanceOf(address) view returns (uint256)", params: [company.sale] }).catch(() => 0n) as Promise<bigint>,
        vaultC
          ? readContract({ contract: vaultC, method: "function getVaultStatus() view returns (uint256, uint256, uint256, uint256, uint256, uint256)" }).catch(() => [0n,0n,0n,0n,0n,0n]) as Promise<any>
          : Promise.resolve([0n,0n,0n,0n,0n,0n]),
      ]);

      const sharesSold = totalSupply > 0n ? totalSupply - saleBalance : 0n;

      // Investor count from SharesBought events
      let investorCount = 0;
      try {
        const sharesBoughtEvent = prepareEvent({ signature: "event SharesBought(uint256 indexed roundId, address indexed buyer, uint256 usdtPaid, uint256 sharesReceived)" });
        const events = await getContractEvents({ contract: saleC, events: [sharesBoughtEvent] });
        const uniqueBuyers = new Set<string>();
        events.forEach((ev: any) => { if (ev.args?.buyer) uniqueBuyers.add(ev.args.buyer.toLowerCase()); });
        investorCount = uniqueBuyers.size;
      } catch {}

      // Jobs completed
      let jobsCompleted = 0;
      try {
        const jobReg = getContract({
          client, chain: CHAIN,
          address: (DEPLOYED_CONTRACTS.addresses as any).JobEscrowFactory as `0x${string}`,
        });
        const jobCompletedEvent = prepareEvent({ signature: "event EscrowDeployed(address indexed escrow, address indexed client, address indexed freelancer)" });
        const jobEvents = await getContractEvents({ contract: jobReg, events: [jobCompletedEvent] }).catch(() => []);
        jobsCompleted = jobEvents.filter((ev: any) => ev.args?.client?.toLowerCase() === company.owner.toLowerCase()).length;
      } catch {}

      // Vault balance
      let vaultBalance = 0n;
      if (vaultAddr) {
        try {
          const usdt = getContract({ client, chain: CHAIN, address: DEPLOYED_CONTRACTS.addresses.MockUSDT as any });
          vaultBalance = await readContract({ contract: usdt, method: "function balanceOf(address) view returns (uint256)", params: [vaultAddr] }) as bigint;
        } catch {}
      }

      setDetails({
        tokenSupply: totalSupply,
        sharesSold,
        raisedTotal: vaultStatus[0] as bigint,
        totalDistributed: vaultStatus[3] as bigint,
        investorCount,
        jobsCompleted,
        vaultBalance,
      });
    } catch (err) {
      console.error("CompanyPreviewModal: fetchDetails error", err);
    } finally {
      setLoading(false);
    }
  }, [company]);

  useEffect(() => {
    if (open && company) fetchDetails();
    else { setDetails(null); setLoading(true); }
  }, [open, company, fetchDetails]);

  if (!open || !company || !mounted) return null;

  const logoUrl = getGatewayUrl(company.meta?.image);

  // ── Always fixed — never absolute. Fixed = viewport-relative, scroll-immune. ──
  // Desktop: offset left by sidebar width via CSS custom prop --sidebar-w (set in layout.tsx).
  // Mobile (< 640px): left: 0 (sidebar is a drawer, not persistent).
  // Top offset = actual measured navbar height so panel starts exactly below the navbar.
  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    top: navbarHeight,
    right: 0,
    bottom: 0,
    left: isMobile ? 0 : 'var(--sidebar-w, 16rem)',
    zIndex: 9999,
    overflowY: 'auto',
    backgroundColor: 'rgba(0,0,0,0.78)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
  };

  // ── Portal: always on document.body (fixed positioning handles offset) ──
  return ReactDOM.createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={backdropStyle}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          ref={backdropRef}
        >
          {/* Panel: horizontally centered, always starts at top of fixed overlay */}
          <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 py-4">
          <motion.div
            initial={{ scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className="bg-background border border-border rounded-[1.5rem] sm:rounded-[2rem] w-full shadow-2xl relative flex flex-col"
          >
              {/* ── HERO HEADER ─────────────────────────────────── */}
              <div className="relative rounded-t-[1.5rem] sm:rounded-t-[2rem] overflow-hidden shrink-0">
                {/* Background */}
                <div className="absolute inset-0 bg-surface-secondary">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/25 via-transparent to-blue-500/20 opacity-60" />
                </div>

                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/50 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-all backdrop-blur-md"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Refresh */}
                <button
                  onClick={fetchDetails}
                  disabled={loading}
                  className="absolute top-3 right-14 z-20 w-9 h-9 rounded-full bg-black/50 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-all backdrop-blur-md"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>

                {/* Hero content */}
                <div className="relative p-4 sm:p-6 md:p-10 flex flex-col sm:flex-row items-start sm:items-end gap-4 sm:gap-6 bg-gradient-to-t from-background/95 via-background/60 to-transparent pt-10 sm:pt-6">
                  {/* Logo */}
                  <div className="relative shrink-0">
                    <div className="absolute -inset-3 bg-primary/20 rounded-2xl blur-xl opacity-60" />
                    <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-28 md:h-28 rounded-2xl bg-[#0c0c0c] border border-white/20 flex items-center justify-center shadow-2xl relative overflow-hidden">
                      {logoUrl ? (
                        <img src={logoUrl} alt={company.meta?.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary via-blue-600 to-indigo-800 flex items-center justify-center text-white font-black text-2xl sm:text-3xl italic">
                          {company.meta?.name ? company.meta.name.substring(0, 2).toUpperCase() : "CO"}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title area */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2">
                      <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em]">
                        <Shield className="w-3 h-3" /> Verified On-Chain
                      </span>
                      <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-muted-foreground text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em]">
                        Registry #{company.id.toString()}
                      </span>
                      {company.round.active && (
                        <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em]">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                          Round Active
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl sm:text-2xl md:text-4xl font-black tracking-tighter text-white drop-shadow-xl mb-2 leading-tight">
                      {company.meta?.name || `Company #${company.id.toString()}`}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1.5 sm:gap-2 text-primary bg-primary/10 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-primary/20 text-xs sm:text-sm font-semibold">
                        <Briefcase className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> {company.sector}
                      </span>
                      <span className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground bg-surface px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-border text-xs sm:text-sm">
                        <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        {loading ? "—" : `${details?.investorCount ?? 0} Shareholders`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── BODY ────────────────────────────────────────── */}
              <div className="flex-1 p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-6">

                {/* Description */}
                {company.meta?.description && (
                  <div className="bg-surface/40 border border-border rounded-[1.25rem] sm:rounded-[1.5rem] p-4 sm:p-5 md:p-7 relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-2 sm:mb-3">
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <h3 className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Company Charter</h3>
                    </div>
                    <p className="text-sm sm:text-base md:text-lg text-foreground/90 leading-relaxed font-medium">
                      {company.meta.description}
                    </p>
                  </div>
                )}

                {/* Key Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                  {[
                    {
                      label: "Total Supply",
                      value: loading ? "—" : fmtShares(details?.tokenSupply),
                      sub: "Equity shares",
                      icon: Coins,
                      color: "text-blue-400",
                      bg: "bg-blue-500/10 border-blue-500/20",
                    },
                    {
                      label: "Circulating",
                      value: loading ? "—" : fmtShares(details?.sharesSold),
                      sub: "Shares sold",
                      icon: Activity,
                      color: "text-violet-400",
                      bg: "bg-violet-500/10 border-violet-500/20",
                    },
                    {
                      label: "Total Raised",
                      value: loading ? "—" : `${fmtUSDT(details?.raisedTotal)} USDT`,
                      sub: "From share sales",
                      icon: TrendingUp,
                      color: "text-emerald-400",
                      bg: "bg-emerald-500/10 border-emerald-500/20",
                    },
                    {
                      label: "Dividends Paid",
                      value: loading ? "—" : `${fmtUSDT(details?.totalDistributed)} USDT`,
                      sub: "To investors",
                      icon: Gift,
                      color: "text-amber-400",
                      bg: "bg-amber-500/10 border-amber-500/20",
                    },
                  ].map((stat, i) => (
                    <div key={i} className={`rounded-xl sm:rounded-2xl p-3 sm:p-4 border ${stat.bg} flex flex-col gap-1.5 sm:gap-2`}>
                      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-background/40 flex items-center justify-center border border-current/20`}>
                        <stat.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${stat.color}`} />
                      </div>
                      <div>
                        <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">{stat.label}</p>
                        <p className={`text-sm sm:text-base md:text-xl font-black font-mono ${stat.color} break-all`}>{stat.value}</p>
                        <p className="text-[8px] sm:text-[9px] text-muted-foreground/70">{stat.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Two-column: left=operator info, right=round/invest */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">

                  {/* Left: Company Info */}
                  <div className="space-y-3 sm:space-y-4">
                    {/* CEO & Services */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      {company.meta?.ceoName && (
                        <div className="bg-surface/40 border border-border rounded-xl sm:rounded-2xl p-3 sm:p-4">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-2 sm:mb-3">
                            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                          </div>
                          <p className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">CEO / Director</p>
                          <p className="text-xs sm:text-base font-bold text-foreground truncate">{company.meta.ceoName}</p>
                        </div>
                      )}
                      {company.meta?.services && (
                        <div className="bg-surface/40 border border-border rounded-xl sm:rounded-2xl p-3 sm:p-4">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-2 sm:mb-3">
                            <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                          </div>
                          <p className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">Services</p>
                          <p className="text-xs sm:text-base font-bold text-foreground line-clamp-2">{company.meta.services}</p>
                        </div>
                      )}
                    </div>

                    {/* Jobs & Activity */}
                    <div className="bg-surface/40 border border-border rounded-xl sm:rounded-2xl p-4 sm:p-5">
                      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                          <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-400" />
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold">Operational Activity</h4>
                      </div>
                      <div className="space-y-2 sm:space-y-3">
                        <div className="flex justify-between items-center py-1.5 sm:py-2 border-b border-border/50">
                          <span className="text-xs sm:text-sm text-muted-foreground">Jobs Completed</span>
                          <span className="font-bold font-mono text-teal-400 text-sm">
                            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : details?.jobsCompleted ?? 0}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 sm:py-2 border-b border-border/50">
                          <span className="text-xs sm:text-sm text-muted-foreground">Vault Balance</span>
                          <span className="font-bold font-mono text-emerald-400 text-sm">
                            {loading ? "—" : `${fmtUSDT(details?.vaultBalance)} USDT`}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 sm:py-2">
                          <span className="text-xs sm:text-sm text-muted-foreground">Shareholders</span>
                          <span className="font-bold font-mono text-foreground text-sm">
                            {loading ? "—" : details?.investorCount ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Product Link */}
                    {company.meta?.products && (
                      <div className="relative rounded-xl sm:rounded-2xl overflow-hidden p-[1px]">
                        <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-500 opacity-50 blur-sm" />
                        <div className="relative bg-surface/90 rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-amber-500/20 flex items-center justify-between gap-3 sm:gap-4">
                          <div className="min-w-0">
                            <p className="text-[9px] sm:text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5">
                              <Rocket className="w-3 h-3" /> Live Product
                            </p>
                            <p className="font-bold text-foreground text-xs sm:text-base truncate">{company.meta.products}</p>
                          </div>
                          {company.meta?.productLink && (
                            <a href={company.meta.productLink} target="_blank" rel="noopener noreferrer"
                              className="shrink-0 px-3 sm:px-4 py-2 bg-amber-500 text-black text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] rounded-xl hover:bg-amber-400 transition-colors flex items-center gap-1.5">
                              Open <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Contract Addresses */}
                    <div className="bg-surface/40 border border-border rounded-xl sm:rounded-2xl p-4 sm:p-5">
                      <div className="flex items-center gap-2 mb-3 sm:mb-4">
                        <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
                        <h4 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">System Contracts</h4>
                      </div>
                      <div className="space-y-1.5 sm:space-y-2">
                        {[
                          { label: "Owner (EOA)", addr: company.owner, highlight: true },
                          { label: "Equity Token", addr: company.token },
                          { label: "Sale Controller", addr: company.sale },
                        ].map((item, i) => (
                          <div key={i} className="flex justify-between items-center bg-background/40 px-2.5 sm:px-3 py-2 rounded-xl border border-white/5 gap-2">
                            <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.1em] shrink-0 ${item.highlight ? "text-primary" : "text-muted-foreground"}`}>{item.label}</span>
                            <a href={`https://amoy.polygonscan.com/address/${item.addr}`} target="_blank" rel="noopener noreferrer"
                              className="text-[10px] sm:text-xs font-mono font-bold text-primary hover:underline flex items-center gap-1 min-w-0">
                              {shortAddr(item.addr)} <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right: Round & Invest */}
                  <div className="space-y-3 sm:space-y-4">
                    {/* Investment Action Panel */}
                    <div className="relative rounded-[1.25rem] sm:rounded-[1.5rem] overflow-hidden shadow-xl border border-primary/20">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent" />
                      <div className="relative bg-surface/60 backdrop-blur-2xl rounded-[1.25rem] sm:rounded-[1.5rem] p-4 sm:p-6 space-y-4 sm:space-y-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-black text-lg sm:text-xl text-foreground mb-0.5">Capital Offering</h3>
                            <p className="text-xs sm:text-sm font-medium text-primary">Investment Gateway</p>
                          </div>
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]">
                            <CircleDollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                          </div>
                        </div>

                        {company.round.active ? (
                          <div className="space-y-3 sm:space-y-4">
                            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                              <div className="p-3 sm:p-4 bg-background/50 rounded-xl sm:rounded-2xl border border-white/5">
                                <p className="text-[8px] sm:text-[9px] text-muted-foreground font-black uppercase tracking-[0.2em] mb-1 sm:mb-1.5">Unit Price</p>
                                <p className="text-lg sm:text-xl font-black text-foreground font-mono break-all">{fmtPrice(company.round.pricePerShare)}</p>
                                <p className="text-[8px] sm:text-[9px] text-primary font-medium mt-0.5">USDT / share</p>
                              </div>
                              <div className="p-3 sm:p-4 bg-background/50 rounded-xl sm:rounded-2xl border border-white/5">
                                <p className="text-[8px] sm:text-[9px] text-muted-foreground font-black uppercase tracking-[0.2em] mb-1 sm:mb-1.5">Available</p>
                                <p className="text-lg sm:text-xl font-black text-foreground font-mono">{fmtShares(company.round.sharesRemaining)}</p>
                                <p className="text-[8px] sm:text-[9px] text-muted-foreground font-medium mt-0.5">shares left</p>
                              </div>
                            </div>

                            {hasProfile === false && (
                              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl text-xs flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>
                                  <strong>Profile Required</strong> — you must have an investor profile to invest.
                                  <a href="/investor/profile" className="block mt-1 underline font-bold">Create Profile →</a>
                                </div>
                              </div>
                            )}

                            <button
                              onClick={() => { onClose(); onInvest(); }}
                              disabled={hasProfile === false}
                              className="w-full py-3 sm:py-4 bg-primary text-white rounded-xl sm:rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-[0_10px_40px_rgba(var(--primary-rgb),0.4)] hover:-translate-y-1 transition-all active:translate-y-0 disabled:opacity-50 disabled:translate-y-0 relative overflow-hidden group"
                            >
                              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                              <span className="relative z-10 flex items-center justify-center gap-2">
                                <DollarSign className="w-4 h-4" /> Acquire Equity
                              </span>
                            </button>
                          </div>
                        ) : (
                          <div className="py-6 sm:py-8 text-center border border-dashed border-white/10 rounded-xl sm:rounded-2xl bg-black/20">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-surface rounded-full flex items-center justify-center mx-auto mb-3 border border-white/5">
                              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground/50" />
                            </div>
                            <p className="text-[10px] sm:text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">Funding Window Closed</p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground/60 mt-1">No active fundraising round</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="bg-surface/40 border border-border rounded-xl sm:rounded-2xl p-4 sm:p-5">
                      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                        <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                        <h4 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Treasury Ledger</h4>
                      </div>
                      <div className="space-y-3 sm:space-y-4">
                        {[
                          { label: "Total Capital Raised", value: `${fmtUSDT(details?.raisedTotal)} USDT`, color: "bg-emerald-500" },
                          { label: "Dividends Distributed", value: `${fmtUSDT(details?.totalDistributed)} USDT`, color: "bg-amber-500" },
                        ].map((stat, i) => (
                          <div key={i} className="space-y-1.5 sm:space-y-2">
                            <div className="flex justify-between items-end gap-2">
                              <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-[0.1em]">{stat.label}</span>
                              <span className="text-xs sm:text-sm font-black font-mono shrink-0">
                                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : stat.value}
                              </span>
                            </div>
                            <div className="h-1.5 sm:h-2 w-full bg-background/80 rounded-full overflow-hidden border border-white/5">
                              <div className={`h-full ${stat.color} rounded-full`} style={{ width: "100%" }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Round Info (when active) */}
                    {company.round.active && (
                      <div className="bg-primary/5 border border-primary/20 rounded-xl sm:rounded-2xl p-4 sm:p-5">
                        <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2 sm:mb-3">
                          Round #{company.round.roundId.toString()} · Active
                        </p>
                        <div className="flex justify-between text-xs sm:text-sm">
                          <span className="text-muted-foreground">Round ID</span>
                          <span className="font-bold">#{company.round.roundId.toString()}</span>
                        </div>
                        <div className="flex justify-between text-xs sm:text-sm mt-2">
                          <span className="text-muted-foreground">Shares Remaining</span>
                          <span className="font-bold font-mono">{fmtShares(company.round.sharesRemaining)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── FOOTER ──────────────────────────────────────── */}
              <div className="p-3 sm:p-4 md:p-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-3 shrink-0 bg-surface/40 rounded-b-[1.5rem] sm:rounded-b-[2rem]">
                <p className="text-[10px] sm:text-xs text-muted-foreground text-center sm:text-left">
                  All data is read directly from on-chain contracts. Refresh for latest state.
                </p>
                <button
                  onClick={onClose}
                  className="px-5 sm:px-6 py-2 sm:py-2.5 border border-border rounded-xl text-xs sm:text-sm font-medium hover:bg-surface-secondary transition-colors w-full sm:w-auto"
                >
                  Close Preview
                </button>
              </div>
            </motion.div>
          </div>
          </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
