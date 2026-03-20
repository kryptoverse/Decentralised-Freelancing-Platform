"use client";

import { useEffect, useState, useCallback } from "react";
import { getContract, readContract, prepareContractCall, sendTransaction } from "thirdweb";
import { smartWallet } from "thirdweb/wallets";
import { useActiveAccount, useActiveWallet } from "thirdweb/react";
import { motion } from "framer-motion";
import {
    Loader2, TrendingUp, DollarSign, RefreshCw, CheckCircle2,
    AlertCircle, Clock, Gift, RotateCcw, Building2, ExternalLink
} from "lucide-react";
import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { CompanyPreviewModal } from "@/components/investor/CompanyPreviewModal";
import { useChatContext } from "@/components/chat/ChatContext";

/* ─── Types ─────────────────────────────────────────────── */
interface MyInvestment {
    address: string;           // Fundraise contract
    myDeposit: bigint;
    targetAmount: bigint;
    totalRaised: bigint;
    investorProfitShareBps: bigint;
    fundingDeadline: bigint;
    isResolved: boolean;
    isAccepted: boolean;
    payoutDistributed: boolean;
    investorPoolTotal: bigint;
    investorClaimed: bigint;    // how much I already claimed
    jobTitle: string;
    // Derived
    claimable: bigint;
    refundable: boolean;
}

interface MyCompanyInvestment {
    companyId: bigint;
    owner: string;
    token: string;
    sale: string;
    distributor: string;
    metadataURI: string;
    sector: string;
    myDeposit: bigint;
    myClaimed: bigint;
    claimableDividend: bigint;
    meta?: any;
}

/* ─── Helpers ───────────────────────────────────────────── */
const fmt = (raw: bigint) =>
    (Number(raw) / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getGatewayUrl = (uri: string) => {
    if (!uri) return "";
    if (uri.startsWith("ipfs://")) {
        return uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
    }
    return uri;
};

/* ─── Page ──────────────────────────────────────────────── */
export default function InvestorPortfolioPage() {
    const account = useActiveAccount();
    const activeWallet = useActiveWallet();
    const { setChatContext } = useChatContext();

    const [activeTab, setActiveTab] = useState<"jobs" | "companies">("jobs");
    const [jobInvestments, setJobInvestments] = useState<MyInvestment[]>([]);
    const [companyInvestments, setCompanyInvestments] = useState<MyCompanyInvestment[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [txLoading, setTxLoading] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
    const [previewCompany, setPreviewCompany] = useState<any | null>(null);

    function showToast(msg: string, ok = true) {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 4000);
    }

    async function getExecutionAccount() {
        if (!activeWallet) throw new Error("No active wallet");
        const personal = (activeWallet as any).getAdminAccount?.();
        if (!personal) throw new Error("Could not get personal EOA from wallet");
        return await smartWallet({ chain: CHAIN, sponsorGas: false }).connect({ client, personalAccount: personal });
    }

    const fetchInvestments = useCallback(async () => {
        if (!account) return;
        try {
            const registry = getContract({
                client, chain: CHAIN,
                address: (DEPLOYED_CONTRACTS.addresses as any).InvestorRegistry as `0x${string}`,
            });

            // --- Fetch Job Portfolio ---
            const addrs = await readContract({
                contract: registry,
                method: "function getJobPortfolio(address) view returns (address[])",
                params: [account.address as `0x${string}`],
            }) as string[];

            let finalJobs: MyInvestment[] = [];
            if (addrs && addrs.length > 0) {
                // STEP 1: Massive parallel fetch for all base data across ALL jobs
                const baseJobDataPromises = addrs.map(addr => {
                    const f = getContract({ client, chain: CHAIN, address: addr as `0x${string}` });
                    return Promise.all([
                        readContract({ contract: registry, method: "function getJobInvestmentStats(address,address) view returns (uint256,uint256)", params: [account.address as `0x${string}`, addr as `0x${string}`] }),
                        readContract({ contract: f, method: "function targetAmount() view returns (uint256)" }),
                        readContract({ contract: f, method: "function totalRaised() view returns (uint256)" }),
                        readContract({ contract: f, method: "function investorProfitShareBps() view returns (uint96)" }),
                        readContract({ contract: f, method: "function fundingDeadline() view returns (uint64)" }),
                        readContract({ contract: f, method: "function isResolved() view returns (bool)" }),
                        readContract({ contract: f, method: "function isAccepted() view returns (bool)" }),
                        readContract({ contract: f, method: "function payoutDistributed() view returns (bool)" }),
                        readContract({ contract: f, method: "function investorPoolTotal() view returns (uint256)" }),
                        readContract({ contract: f, method: "function escrow() view returns (address)" }),
                    ]).then(data => ({ addr, data })).catch(() => null);
                });

                const baseJobsRaw = await Promise.all(baseJobDataPromises);
                const baseJobs = baseJobsRaw.filter(j => j !== null) as { addr: string, data: any[] }[];

                // STEP 2: Second parallel fetch exactly for dependent data (escrow -> freelancer)
                const freelancerPromises = baseJobs.map(({ data }) => {
                    const escrowAddr = data[9] as string;
                    if (!escrowAddr) return Promise.resolve("");
                    const escrowC = getContract({ client, chain: CHAIN, address: escrowAddr as `0x${string}` });
                    return readContract({ contract: escrowC, method: "function freelancer() view returns (address)" }).catch(() => "");
                });

                const freelancers = await Promise.all(freelancerPromises);

                // STEP 3: Assemble Jobs
                finalJobs = baseJobs.map(({ addr, data }, i) => {
                    const [stats, targetAmount, totalRaised, investorProfitShareBps, fundingDeadline, isResolved, isAccepted, payoutDistributed, investorPoolTotal] = data;
                    const [myDeposit, myClaimed] = stats as [bigint, bigint];
                    
                    const fl = freelancers[i] as string;
                    const jobTitle = fl ? `Job by ${fl.slice(0, 8)}...` : `Fundraise ${addr.slice(0, 8)}...`;

                    let claimable = 0n;
                    if ((payoutDistributed as boolean) && (myClaimed as bigint) === 0n && (totalRaised as bigint) > 0n) {
                        claimable = ((myDeposit as bigint) * (investorPoolTotal as bigint)) / (totalRaised as bigint);
                    }

                    return {
                        address: addr, myDeposit: myDeposit as bigint,
                        targetAmount: targetAmount as bigint, totalRaised: totalRaised as bigint,
                        investorProfitShareBps: investorProfitShareBps as bigint,
                        fundingDeadline: fundingDeadline as bigint,
                        isResolved: isResolved as boolean, isAccepted: isAccepted as boolean,
                        payoutDistributed: payoutDistributed as boolean,
                        investorPoolTotal: investorPoolTotal as bigint,
                        investorClaimed: myClaimed as bigint,
                        claimable, refundable: (isResolved as boolean) && !(isAccepted as boolean) && (myDeposit as bigint) > 0n, 
                        jobTitle,
                    } satisfies MyInvestment;
                });
            }

            // --- Fetch Company Portfolio ---
            const companyRegistryC = getContract({
                client, chain: CHAIN,
                address: DEPLOYED_CONTRACTS.addresses.CompanyRegistry as `0x${string}`,
            });

            const companyIds = await readContract({
                contract: registry,
                method: "function getPortfolio(address) view returns (uint256[])",
                params: [account.address as `0x${string}`],
            }) as bigint[];

        let finalCompanies: MyCompanyInvestment[] = [];
        if (companyIds && companyIds.length > 0) {
            // MEGA FETCH for Companies
            const cPromises = companyIds.map(async cId => {
                try {
                    const [stats, cData] = await Promise.all([
                        readContract({ contract: registry, method: "function getInvestmentStats(address,uint256) view returns (uint256,uint256)", params: [account.address as `0x${string}`, cId] }),
                        readContract({ contract: companyRegistryC, method: "function getCompany(uint256) view returns ((address owner, address token, address sale, address vault, address distributor, string metadataURI, string sector, bool exists))", params: [cId] })
                    ]);

                    let claimableDividend = 0n;
                    if (cData.distributor && cData.distributor !== "0x0000000000000000000000000000000000000000") {
                        try {
                            const distributorC = getContract({ client, chain: CHAIN, address: cData.distributor as `0x${string}` });
                            claimableDividend = await readContract({ contract: distributorC, method: "function withdrawableDividendOf(address) view returns (uint256)", params: [account.address as `0x${string}`] }) as bigint;
                        } catch (e) {
                            console.error("Failed to read dividend for", cId, e);
                        }
                    }
                    
                    let meta = null;
                    if (cData.metadataURI) {
                        try {
                            const gatewayUrl = getGatewayUrl(cData.metadataURI);
                            const res = await fetch(gatewayUrl);
                            if (res.ok) meta = await res.json();
                        } catch (e) {
                            console.error("Failed to fetch meta for", cId, e);
                        }
                    }

                    const result: MyCompanyInvestment = {
                        companyId: cId, owner: cData.owner, token: cData.token, sale: cData.sale, distributor: cData.distributor, metadataURI: cData.metadataURI, sector: cData.sector,
                        myDeposit: stats[0], myClaimed: stats[1], claimableDividend, meta
                    };
                    return result;
                } catch (err) {
                    console.error("Failed to fetch company investment for", cId, err);
                    return null;
                }
            });

            const rawCompanies = await Promise.all(cPromises);
            finalCompanies = rawCompanies.filter((c): c is MyCompanyInvestment => c !== null);
            }

            setJobInvestments(finalJobs);
            setCompanyInvestments(finalCompanies);
        } catch (err) {
            console.error("Portfolio fetch error:", err);
        }
    }, [account]);

    useEffect(() => { setLoading(true); fetchInvestments().finally(() => setLoading(false)); }, [fetchInvestments]);

    async function refresh() { setRefreshing(true); await fetchInvestments(); setRefreshing(false); }

    async function doClaim(addr: string, method: "function claimInvestor()" | "function claimRefund()") {
        try {
            setTxLoading(addr);
            const execAccount = await getExecutionAccount();
            const f = getContract({ client, chain: CHAIN, address: addr as `0x${string}` });
            await sendTransaction({
                transaction: prepareContractCall({ contract: f, method, params: [], gas: 250000n }),
                account: execAccount,
            });
            showToast("Claimed successfully! ✅");
            await fetchInvestments();
        } catch (err: any) {
            showToast(err?.message?.slice(0, 100) || "Claim failed", false);
        } finally {
            setTxLoading(null);
        }
    }

    async function doClaimDividend(distributorAddr: string) {
        try {
            setTxLoading(distributorAddr);
            const execAccount = await getExecutionAccount();
            const dist = getContract({ client, chain: CHAIN, address: distributorAddr as `0x${string}` });
            await sendTransaction({
                transaction: prepareContractCall({ contract: dist, method: "function claim()", params: [], gas: 250000n }),
                account: execAccount,
            });
            showToast("Dividends Claimed successfully! ✅");
            await fetchInvestments();
        } catch (err: any) {
            showToast(err?.message?.slice(0, 100) || "Dividend Claim failed", false);
        } finally {
            setTxLoading(null);
        }
    }

    /* Stats Calculations */
    const totalInvestedJobs = jobInvestments.reduce((s, i) => s + i.myDeposit, 0n);
    const totalInvestedComps = companyInvestments.reduce((s, i) => s + i.myDeposit, 0n);
    const totalInvested = totalInvestedJobs + totalInvestedComps;
    
    const totalClaimedJobs = jobInvestments.reduce((s, i) => s + i.investorClaimed, 0n);
    const totalClaimedComps = companyInvestments.reduce((s, i) => s + i.myClaimed, 0n);
    const totalClaimed = totalClaimedJobs + totalClaimedComps;

    // Calculate realized and unrealized profit for jobs
    let totalRealizedProfitJobs = 0n;
    let totalExpectedGainsJobs = 0n;

    jobInvestments.forEach(inv => {
        // If they already claimed, the profit is (Claimed - Deposit) if positive
        if (inv.investorClaimed > 0n) {
            if (inv.investorClaimed > inv.myDeposit) {
                totalRealizedProfitJobs += (inv.investorClaimed - inv.myDeposit);
            }
        } 
        // If not claimed but payout is distributed, we can calculate expected profit
        else if (inv.payoutDistributed && inv.investorPoolTotal > 0n && inv.totalRaised > 0n) {
            const myShare = (inv.myDeposit * inv.investorPoolTotal) / inv.totalRaised;
            if (myShare > inv.myDeposit) {
                totalExpectedGainsJobs += (myShare - inv.myDeposit);
            }
        }
    });

    const totalClaimable = jobInvestments.reduce((s, i) => s + i.claimable, 0n); 
    const now = BigInt(Math.floor(Date.now() / 1000));

    useEffect(() => {
        const ctx = `--- CURRENT USER CONTEXT ---
Role: Investor
Total Invested: ${fmt(totalInvested)} USDT
Realized Profits: ${fmt(totalRealizedProfitJobs + totalClaimedComps)} USDT
Pending Returns: ${fmt(totalClaimable)} USDT
Active Jobs Invested In: ${jobInvestments.filter(i => !i.isResolved).length}
Company Shares Owned: ${companyInvestments.length}`;
        setChatContext((prev) => {
            const base = prev.split('--- CURRENT USER CONTEXT ---')[0].trim();
            return base + '\n\n' + ctx;
        });
    }, [totalInvested, totalRealizedProfitJobs, totalClaimedComps, totalClaimable, jobInvestments, companyInvestments, setChatContext]);

    return (
        <>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 sm:space-y-8 max-w-6xl mx-auto w-full">
            {/* Toast */}
            {toast && (
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className={`fixed top-4 right-4 left-4 sm:left-auto sm:right-6 sm:top-6 z-[9999] px-4 py-3 rounded-xl shadow-xl text-sm font-medium flex items-center gap-2 ${toast.ok ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300" : "bg-red-500/20 border border-red-500/40 text-red-300"}`}>
                    {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {toast.msg}
                </motion.div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold gradient-text">My Portfolio</h1>
                    <p className="text-muted-foreground text-xs sm:text-sm mt-1">Track your investments, realized profit, and pending returns.</p>
                </div>
                <button onClick={refresh} disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border hover:bg-surface-secondary transition-colors text-sm font-medium shadow-sm self-start sm:self-auto">
                    <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh Data
                </button>
            </div>

            {/* Granular Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
                {[
                    { label: "Total Invested", value: `$${fmt(totalInvested)}`, icon: DollarSign },
                    { label: "Active Jobs", value: jobInvestments.filter(i => !i.isResolved).length.toString(), icon: Clock },
                    { label: "Company Shares", value: companyInvestments.length.toString(), icon: TrendingUp },
                    { label: "Realized PnL", value: `+$${fmt(totalRealizedProfitJobs + totalClaimedComps)}`, icon: CheckCircle2, highlight: totalRealizedProfitJobs + totalClaimedComps > 0n },
                    { label: "Pending Returns", value: `$${fmt(totalClaimable)}`, icon: Gift, highlight: totalClaimable > 0n },
                ].map((s, i) => (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} key={s.label} 
                        className={`glass-effect rounded-xl sm:rounded-2xl p-3 sm:p-4 border ${s.highlight ? "border-emerald-500/40 shadow-lg shadow-emerald-500/5" : "border-border"}`}>
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                            <s.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${s.highlight ? "text-emerald-400" : "text-primary"}`} />
                            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-tight">{s.label}</span>
                        </div>
                        <p className={`text-xl sm:text-2xl font-bold truncate ${s.highlight ? "text-emerald-400" : ""}`}>{s.value}</p>
                        {s.label === "Realized PnL" && s.highlight && <p className="text-[9px] sm:text-[10px] text-emerald-400/80 mt-1">Profits claimed to wallet</p>}
                        {s.label === "Pending Returns" && s.highlight && <p className="text-[9px] sm:text-[10px] text-emerald-400/80 mt-1">Ready to claim now!</p>}
                    </motion.div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border overflow-x-auto scrollbar-none">
                <button
                    onClick={() => setActiveTab("jobs")}
                    className={`px-4 sm:px-6 py-2.5 sm:py-3 font-medium text-xs sm:text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === "jobs" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                    Job Fundraises ({jobInvestments.length})
                </button>
                <button
                    onClick={() => setActiveTab("companies")}
                    className={`px-4 sm:px-6 py-2.5 sm:py-3 font-medium text-xs sm:text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === "companies" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                    Company Shares ({companyInvestments.length})
                </button>
            </div>

            {/* Investment List */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : !account ? (
                <div className="text-center py-20 text-muted-foreground">Connect your wallet to view your portfolio.</div>
            ) : activeTab === "jobs" ? (
                jobInvestments.length === 0 ? (
                    <div className="text-center py-20 space-y-3">
                        <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto" />
                        <p className="text-muted-foreground">No job fundraise investments yet.</p>
                        <a href="/investor" className="text-primary text-sm hover:underline">Browse fundraises →</a>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {jobInvestments.map((inv, i) => {
                            const isActive = !inv.isResolved && inv.fundingDeadline > now;
                            const myShare = inv.payoutDistributed && inv.investorPoolTotal > 0n && inv.totalRaised > 0n
                                ? (inv.myDeposit * inv.investorPoolTotal) / inv.totalRaised : 0n;
                            const profit = myShare > inv.myDeposit ? myShare - inv.myDeposit : 0n;

                            return (
                                <motion.div key={inv.address} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                        className="bg-surface border border-border rounded-2xl p-5 md:p-6 space-y-5 hover:border-primary/30 transition-colors shadow-sm">
                                        {/* Head */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                                            <div className="min-w-0">
                                                <p className="font-bold text-base sm:text-lg text-foreground mb-1 truncate">{inv.jobTitle}</p>
                                                <p className="text-[10px] sm:text-xs text-muted-foreground font-mono bg-background border border-border inline-block px-2 py-1 rounded-md">{inv.address.slice(0, 10)}...{inv.address.slice(-6)}</p>
                                            </div>
                                            <span className={`px-3 sm:px-4 py-1 sm:py-1.5 text-[9px] sm:text-[10px] uppercase tracking-widest rounded-lg font-bold self-start sm:self-center shrink-0 border shadow-sm ${isActive ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : inv.isAccepted ? "bg-blue-500/10 text-blue-500 border-blue-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}`}>
                                                {isActive ? "Active Funding" : inv.isAccepted ? "Job in Progress" : "Cancelled / Failed"}
                                            </span>
                                        </div>

                                        {/* Metrics */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                                            <div className="bg-background rounded-xl p-3 md:p-4 border border-border/50 flex flex-col justify-center">
                                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">My Stake</p>
                                                <p className="font-bold font-mono text-primary text-base md:text-lg">{fmt(inv.myDeposit)} <span className="text-xs text-muted-foreground">USDT</span></p>
                                            </div>
                                            <div className="bg-background rounded-xl p-3 md:p-4 border border-border/50 flex flex-col justify-center">
                                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Profit Share</p>
                                                <p className="font-bold font-mono text-foreground text-base md:text-lg">{(Number(inv.investorProfitShareBps) / 100).toFixed(1)}<span className="text-xs text-muted-foreground">%</span></p>
                                            </div>
                                            <div className="bg-background rounded-xl p-3 md:p-4 border border-border/50 flex flex-col justify-center">
                                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Status</p>
                                                <p className="font-bold text-foreground text-sm flex items-center h-full">
                                                    {!inv.isResolved ? "Funding" : !inv.payoutDistributed ? "Awaiting Payout" : "Completed"}
                                                </p>
                                            </div>
                                            <div className={`rounded-xl p-3 md:p-4 border flex flex-col justify-center ${profit > 0n ? "bg-emerald-500/5 border-emerald-500/20" : "bg-background border-border/50"}`}>
                                                <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${profit > 0n ? "text-emerald-500" : "text-muted-foreground"}`}>Target Return</p>
                                                <p className={`font-bold font-mono text-base md:text-lg ${profit > 0n ? "text-emerald-500" : "text-muted-foreground"}`}>{profit > 0n ? `+${fmt(profit)} USDT` : "TBD"}</p>
                                            </div>
                                        </div>

                                        {/* Already claimed */}
                                        {inv.investorClaimed > 0n && (
                                            <div className="flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-sm font-medium text-emerald-500">
                                                <CheckCircle2 className="w-4 h-4" />
                                                Already claimed: <span className="font-bold font-mono">{fmt(inv.investorClaimed)} USDT</span>
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border border-dashed">
                                            <a href={`/client/jobs/${inv.address}`} target="_blank" rel="noopener noreferrer"
                                                className="text-xs font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1 w-full sm:w-auto self-start sm:self-center">
                                                View Source Job <ExternalLink className="w-3 h-3" />
                                            </a>
                                            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                                                {inv.claimable > 0n && inv.investorClaimed === 0n && (
                                                    <button
                                                        onClick={() => doClaim(inv.address, "function claimInvestor()")}
                                                        disabled={txLoading === inv.address}
                                                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 disabled:opacity-50 transition-colors shadow-sm"
                                                    >
                                                        {txLoading === inv.address ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                                                        Claim {fmt(inv.claimable)} USDT
                                                    </button>
                                                )}
                                                {inv.refundable && (
                                                    <button
                                                        onClick={() => doClaim(inv.address, "function claimRefund()")}
                                                        disabled={txLoading === inv.address}
                                                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-amber-500 text-amber-500 text-sm font-bold hover:bg-amber-500 hover:text-white disabled:opacity-50 transition-colors"
                                                    >
                                                        {txLoading === inv.address ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                                                        Refund ({fmt(inv.myDeposit)} USDT)
                                                    </button>
                                                )}
                                                {!inv.claimable && !inv.refundable && inv.investorClaimed === 0n && (
                                                    <p className="text-xs font-medium text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5 py-2 px-4 bg-surface-secondary rounded-xl border border-border w-full sm:w-auto text-center sm:text-left">
                                                        <Clock className="w-3.5 h-3.5 shrink-0" />
                                                        {inv.payoutDistributed ? "Already claimed" : isActive ? "Payout pending completion" : "Waiting for completion"}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                            );
                        })}
                    </div>
                )
            ) : (
                companyInvestments.length === 0 ? (
                    <div className="text-center py-20 space-y-3">
                        <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto" />
                        <p className="text-muted-foreground">No company share investments yet.</p>
                        <a href="/investor" className="text-primary text-sm hover:underline">Find a company →</a>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {companyInvestments.map((c, i) => {
                            const logoUrl = getGatewayUrl(c.meta?.image);
                            return (
                                <motion.div key={c.companyId.toString()} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                                    className="bg-surface border border-border rounded-2xl p-5 space-y-5 flex flex-col justify-between hover:shadow-md transition-shadow"
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-xs font-bold px-2 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">Company #{c.companyId.toString()}</span>
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{c.sector}</span>
                                        </div>
                                        
                                        <div className="flex items-start gap-4">
                                            <div className="w-14 h-14 rounded-xl bg-background border border-border flex items-center justify-center shrink-0 overflow-hidden">
                                                {logoUrl ? (
                                                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                                                ) : (
                                                    <Building2 className="w-6 h-6 text-muted-foreground/40" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0 pt-1">
                                                <h3 className="text-lg font-bold truncate text-foreground">{c.meta?.name || `Unknown Company`}</h3>
                                                <p className="text-xs text-muted-foreground mt-1 truncate">Owner: {c.owner.slice(0, 6)}...{c.owner.slice(-4)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mt-2">
                                        <div className="bg-background border border-border/50 rounded-xl p-3 text-center">
                                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">My Deposit</p>
                                            <p className="font-bold font-mono text-primary text-lg">{fmt(c.myDeposit)}</p>
                                        </div>
                                        <div className="bg-background border border-border/50 rounded-xl p-3 text-center">
                                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Claimed Divs</p>
                                            <p className="font-bold font-mono text-emerald-500 text-lg">{fmt(c.myClaimed)}</p>
                                        </div>
                                    </div>

                                    {c.claimableDividend > 0n && (
                                        <button
                                            onClick={() => doClaimDividend(c.distributor)}
                                            disabled={txLoading === c.distributor}
                                            className="w-full flex justify-center items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 disabled:opacity-50 transition-colors shadow-sm"
                                        >
                                            {txLoading === c.distributor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                                            Claim {fmt(c.claimableDividend)} USDT
                                        </button>
                                    )}

                                    <button onClick={() => setPreviewCompany({
                                          id: c.companyId,
                                          owner: c.owner,
                                          token: c.token,
                                          sale: c.sale,
                                          vault: "",
                                          distributor: c.distributor,
                                          sector: c.sector,
                                          meta: c.meta,
                                          round: { roundId: 0n, pricePerShare: 0n, sharesRemaining: 0n, active: false }
                                      })}
                                        className="w-full inline-block text-center px-4 py-3 border border-border rounded-xl hover:bg-surface-secondary text-sm font-bold text-foreground transition-colors group mt-2"
                                    >
                                        View Company
                                        <span className="inline-block group-hover:translate-x-1 transition-transform ml-1">→</span>
                                    </button>
                                </motion.div>
                            );
                        })}
                    </div>
                )
            )}
        </motion.div>

        {/* Company Preview Modal */}
        <CompanyPreviewModal
            company={previewCompany}
            open={previewCompany !== null}
            onClose={() => setPreviewCompany(null)}
            onInvest={() => setPreviewCompany(null)}
        />
        </>
    );
}
