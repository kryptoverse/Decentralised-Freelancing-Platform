"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getContract, readContract, prepareContractCall, sendTransaction } from "thirdweb";
import { smartWallet } from "thirdweb/wallets";
import { useActiveAccount, useActiveWallet } from "thirdweb/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, TrendingUp, Clock, DollarSign, Users, RefreshCw,
  Zap, AlertCircle, CheckCircle2, X, ChevronRight, Target
} from "lucide-react";
import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { useIPFSUpload } from "@/hooks/useIPFSUpload";
import { getWalletBalance } from "thirdweb/wallets";
import { polygonAmoy } from "thirdweb/chains";

/* ─── Types ─────────────────────────────────────────────── */
interface FundraiseInfo {
  address: string;
  escrow: string;
  targetAmount: bigint;
  totalRaised: bigint;
  fundingDeadline: bigint;
  investorProfitShareBps: bigint;
  isResolved: boolean;
  isAccepted: boolean;
  myDeposit: bigint;
  jobTitle: string;
  jobClient: string;
  jobFreelancer: string;
  escrowRewardUSDT: bigint;
}

/* ─── Helpers ─────────────────────────────────────────────── */
function formatUSDT(raw: bigint) {
  return (Number(raw) / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDeadline(ts: bigint) {
  const diff = Number(ts) - Math.floor(Date.now() / 1000);
  if (diff <= 0) return "Expired";
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  return d > 0 ? `${d}d ${h}h left` : `${h}h left`;
}
function fillPct(raised: bigint, target: bigint) {
  if (target === 0n) return 0;
  return Math.min(100, Math.round(Number((raised * 10000n) / target) / 100));
}

/* ─── Invest Modal ───────────────────────────────────────── */
function InvestModal({
  fundraise, onClose, onSuccess, buildExecAccount,
}: {
  fundraise: FundraiseInfo;
  onClose: () => void;
  onSuccess: () => void;
  buildExecAccount: () => Promise<any>;
}) {
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"input" | "approving" | "investing" | "done" | "error">("input");
  const [errMsg, setErrMsg] = useState("");
  const [balance, setBalance] = useState<bigint>(0n);
  const remaining = fundraise.targetAmount - fundraise.totalRaised;
  const activeAccount = useActiveAccount();

  useEffect(() => {
    async function loadBalance() {
      if (!activeAccount) return;
      try {
        const usdt = getContract({ client, chain: CHAIN, address: DEPLOYED_CONTRACTS.addresses.MockUSDT });
        const bal = await readContract({
          contract: usdt,
          method: "function balanceOf(address) view returns (uint256)",
          params: [activeAccount.address]
        }) as bigint;
        setBalance(bal);
      } catch (err) { console.error("Balance fetch error", err); }
    }
    loadBalance();
  }, [activeAccount]);

  const parsedAmount = parseFloat(amount) || 0;
  const rawAmount = BigInt(Math.floor(parsedAmount * 1e6));

  // Projected Profit Calculation
  // Profit = Amount * (Fundraise Target / Escrow Target) * Profit Share?
  // Wait, no. Total net profit = EscrowReward - TargetAmount
  // User's share of net profit = (UserAmount / TargetAmount) * TotalNetProfit * ProfitShare / 10000
  const netProfit = fundraise.escrowRewardUSDT > fundraise.targetAmount ? fundraise.escrowRewardUSDT - fundraise.targetAmount : 0n;
  const userShareOfNetProfit = fundraise.targetAmount > 0n ? (rawAmount * netProfit / fundraise.targetAmount) * fundraise.investorProfitShareBps / 10000n : 0n;
  const projectedReturn = rawAmount + userShareOfNetProfit;

  async function handleInvest() {
    try {
      if (parsedAmount <= 0) { setErrMsg("Enter a valid amount"); return; }
      if (rawAmount > remaining) { setErrMsg(`Max: ${formatUSDT(remaining)} USDT`); return; }
      if (rawAmount > balance) { setErrMsg(`Insufficient USDT balance (${formatUSDT(balance)} available)`); return; }

      setErrMsg(""); setStep("approving");
      const execAccount = await buildExecAccount();

      const usdt = getContract({ client, chain: CHAIN, address: DEPLOYED_CONTRACTS.addresses.MockUSDT });
      const fc = getContract({ client, chain: CHAIN, address: fundraise.address as `0x${string}` });

      const allowance = await readContract({
        contract: usdt,
        method: "function allowance(address,address) view returns (uint256)",
        params: [execAccount.address, fundraise.address as `0x${string}`],
      }) as bigint;

      if (allowance < rawAmount) {
        await sendTransaction({
          transaction: prepareContractCall({
            contract: usdt,
            method: "function approve(address,uint256)",
            params: [fundraise.address as `0x${string}`, rawAmount],
            gas: 80000n,
          }),
          account: execAccount,
        });
      }

      setStep("investing");
      await sendTransaction({
        transaction: prepareContractCall({
          contract: fc,
          method: "function invest(uint256)",
          params: [rawAmount],
          gas: 200000n,
        }),
        account: execAccount,
      });

      setStep("done");
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (err: any) {
      let msg = (err?.message?.slice(0, 120) || "Transaction failed") as string;
      if (err?.message?.includes("AA21")) {
        msg = "Transaction rejected by paymaster (AA21). This could happen if the investment amount slightly bypassed a limit or gas threshold. Please try a slightly lower amount or refresh.";
      }
      setErrMsg(msg);
      setStep("error");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="bg-surface-secondary border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Invest in Fundraise</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="bg-surface rounded-xl p-4 mb-4 space-y-1 text-sm">
          <p className="font-medium truncate">{fundraise.jobTitle}</p>
          <div className="flex justify-between text-muted-foreground mt-2">
            <span>Available to Fund:</span>
            <span className="font-semibold">{formatUSDT(remaining)} USDT</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Your Balance:</span>
            <span className="font-semibold text-primary">{formatUSDT(balance)} USDT</span>
          </div>
          <div className="flex justify-between items-center text-muted-foreground mt-4 pt-4 border-t border-border">
            <span>Projected Return:</span>
            <div className="text-right">
              <p className="text-emerald-400 font-bold text-lg">{formatUSDT(projectedReturn)} USDT</p>
              <p className="text-[10px] opacity-70">(Principal + {Number(fundraise.investorProfitShareBps) / 100}% Profit Share)</p>
            </div>
          </div>
        </div>

        {step === "done" ? (
          <div className="flex flex-col items-center py-6 gap-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            <p className="font-semibold text-emerald-400">Investment Successful!</p>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              <label className="text-sm font-medium">Amount (USDT)</label>
              <div className="relative">
                <input
                  type="number" value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00" max={Number(remaining) / 1e6}
                  disabled={step !== "input" && step !== "error"}
                  className="w-full bg-surface border border-border rounded-xl px-4 py-3 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button onClick={() => setAmount((Number(remaining) / 1e6).toString())}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary hover:underline font-medium">MAX</button>
              </div>
              {errMsg && <p className="text-red-400 text-xs flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errMsg}</p>}
            </div>
            <div className="text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg p-3 mb-4 space-y-1">
              {step === "approving" && <p className="text-primary flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Approving USDT...</p>}
              {step === "investing" && <p className="text-primary flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Depositing into fundraise...</p>}
              {(step === "input" || step === "error") && <p>Two transactions: 1) Approve USDT &nbsp; 2) Invest</p>}
            </div>
            <button
              onClick={handleInvest}
              disabled={step === "approving" || step === "investing"}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {(step === "approving" || step === "investing") && <Loader2 className="w-4 h-4 animate-spin" />}
              {step === "input" || step === "error" ? "Confirm Investment" : step === "approving" ? "Approving..." : "Investing..."}
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ─── Main Page ───────────────────────────────────────────── */
export default function InvestorBrowsePage() {
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const router = useRouter();
  const { uploadMetadata } = useIPFSUpload();

  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", bio: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  const [fundraises, setFundraises] = useState<FundraiseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<FundraiseInfo | null>(null);
  const [filter, setFilter] = useState<"active" | "all">("active");

  const [maticBalance, setMaticBalance] = useState<{ displayValue: string; symbol: string } | null>(null);
  const [usdtBalance, setUsdtBalance] = useState<string | null>(null);
  const [totalProfit, setTotalProfit] = useState<bigint>(0n);

  async function getExecutionAccount() {
    if (!activeWallet) throw new Error("No active wallet");
    const personal = (activeWallet as any).getAdminAccount?.() || (activeWallet as any).getPersonalWallet?.()?.getAccount?.();
    if (!personal) throw new Error("Could not get personal account");
    return await smartWallet({ chain: CHAIN, sponsorGas: true }).connect({ client, personalAccount: personal });
  }

  const fetchFundraises = useCallback(async () => {
    try {
      const factory = getContract({
        client, chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.FundraiseFactory as `0x${string}`,
      });

      const total = await readContract({
        contract: factory, method: "function getTotalFundraises() view returns (uint256)",
      }) as bigint;

      if (total === 0n) { setFundraises([]); return; }

      const addrs = await readContract({
        contract: factory,
        method: "function getFundraises(uint256,uint256) view returns (address[])",
        params: [0n, total],
      }) as string[];

      // STEP 1: All Base Data
      const basePromises = addrs.map(addr => {
        const f = getContract({ client, chain: CHAIN, address: addr as `0x${string}` });

        const mainReqs = [
          readContract({ contract: f, method: "function targetAmount() view returns (uint256)" }),
          readContract({ contract: f, method: "function totalRaised() view returns (uint256)" }),
          readContract({ contract: f, method: "function fundingDeadline() view returns (uint64)" }),
          readContract({ contract: f, method: "function investorProfitShareBps() view returns (uint96)" }),
          readContract({ contract: f, method: "function isResolved() view returns (bool)" }),
          readContract({ contract: f, method: "function isAccepted() view returns (bool)" }),
          readContract({ contract: f, method: "function escrow() view returns (address)" }),
        ];

        if (account) {
          mainReqs.push(
            readContract({
              contract: f,
              method: "function deposits(address) view returns (uint256)",
              params: [account.address as `0x${string}`],
            }).catch(() => 0n)
          );
        } else {
          mainReqs.push(Promise.resolve(0n)); // myDeposit 0 if not logged in
        }

        return Promise.all(mainReqs).then(data => ({ addr, data })).catch(() => null);
      });

      const baseRaw = await Promise.all(basePromises);
      const baseData = baseRaw.filter(x => x !== null) as { addr: string, data: any[] }[];

      // STEP 2: Escrows 
      const escrowPromises = baseData.map(({ data }) => {
        const escrowAddr = data[6] as string;
        if (!escrowAddr) return Promise.resolve(["", "", 0n]);
        const escrowC = getContract({ client, chain: CHAIN, address: escrowAddr as `0x${string}` });
        return Promise.all([
          readContract({ contract: escrowC, method: "function client() view returns (address)" }).catch(() => ""),
          readContract({ contract: escrowC, method: "function freelancer() view returns (address)" }).catch(() => ""),
          readContract({ contract: escrowC, method: "function amount() view returns (uint256)" }).catch(() => 0n)
        ]);
      });

      const escrowsData = await Promise.all(escrowPromises);

      // STEP 3: ZIP
      const finalRes = baseData.map(({ addr, data }, i) => {
        const [targetAmount, totalRaised, fundingDeadline, investorProfitShareBps, isResolved, isAccepted, escrowAddr, myDeposit] = data;
        const [jobClient, jobFreelancer, escrowRewardUSDT] = escrowsData[i];

        const jobTitle = jobFreelancer ? `Job Fundraise — ${(jobFreelancer as string).slice(0, 8)}...` : `Fundraise ${addr.slice(0, 8)}...`;

        return {
          address: addr, escrow: escrowAddr as string,
          targetAmount: targetAmount as bigint, totalRaised: totalRaised as bigint,
          fundingDeadline: fundingDeadline as bigint, investorProfitShareBps: investorProfitShareBps as bigint,
          isResolved: isResolved as boolean, isAccepted: isAccepted as boolean,
          myDeposit: myDeposit as bigint, jobTitle, jobClient: jobClient as string, jobFreelancer: jobFreelancer as string, escrowRewardUSDT: escrowRewardUSDT as bigint
        } satisfies FundraiseInfo;
      });

      setFundraises(finalRes);
    } catch (err) {
      console.error("Failed to load fundraises:", err);
    }
  }, [account]);

  useEffect(() => { setLoading(true); fetchFundraises().finally(() => setLoading(false)); }, [fetchFundraises]);

  const fetchProfile = useCallback(async () => {
    if (!account) { setHasProfile(null); return; }
    try {
      const reg = getContract({
        client, chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.InvestorRegistry as `0x${string}`
      });
      const profilePromise = readContract({
        contract: reg, method: "function profiles(address) view returns (string,bool)",
        params: [account.address as `0x${string}`]
      }) as Promise<[string, boolean]>;

      const usdt = getContract({ client, chain: CHAIN, address: DEPLOYED_CONTRACTS.addresses.MockUSDT });
      const usdtBalPromise = readContract({
        contract: usdt, method: "function balanceOf(address) view returns (uint256)",
        params: [account.address as `0x${string}`]
      }) as Promise<bigint>;

      const maticBalPromise = getWalletBalance({ client, chain: polygonAmoy, address: account.address });

      // Calculate total claimed profit
      const jobIdsPromise = readContract({
        contract: reg, method: "function getJobPortfolio(address) view returns (address[])",
        params: [account.address as `0x${string}`]
      }).catch(() => []) as Promise<string[]>;

      const compIdsPromise = readContract({
        contract: reg, method: "function getPortfolio(address) view returns (uint256[])",
        params: [account.address as `0x${string}`]
      }).catch(() => []) as Promise<bigint[]>;

      const [profile, usdtBal, maticBal, jobIds, compIds] = await Promise.all([
        profilePromise, usdtBalPromise, maticBalPromise, jobIdsPromise, compIdsPromise
      ]);

      setHasProfile(profile[1]);
      if (!profile[1]) setShowProfileSetup(true);

      setUsdtBalance(formatUSDT(usdtBal));
      setMaticBalance({ displayValue: maticBal.displayValue, symbol: maticBal.symbol });

      // Aggregate profit
      let claimedJobs = 0n;
      let claimedComps = 0n;

      if (jobIds.length > 0) {
        const jClaims = await Promise.all(jobIds.map(addr =>
          readContract({
            contract: reg, method: "function getJobInvestmentStats(address,address) view returns (uint256,uint256)",
            params: [account.address as `0x${string}`, addr as `0x${string}`]
          }).then((res: any) => res[1] as bigint).catch(() => 0n)
        ));
        claimedJobs = jClaims.reduce((a, b) => a + b, 0n);
      }

      if (compIds.length > 0) {
        const cClaims = await Promise.all(compIds.map(id =>
          readContract({
            contract: reg, method: "function getInvestmentStats(address,uint256) view returns (uint256,uint256)",
            params: [account.address as `0x${string}`, id]
          }).then((res: any) => res[1] as bigint).catch(() => 0n)
        ));
        claimedComps = cClaims.reduce((a, b) => a + b, 0n);
      }

      setTotalProfit(claimedJobs + claimedComps);

    } catch { setHasProfile(false); setShowProfileSetup(true); }
  }, [account]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  async function handleCreateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!account || !profileForm.name) return;
    setSavingProfile(true);
    try {
      const uri = await uploadMetadata({ name: profileForm.name, bio: profileForm.bio }, { name: `investor_${account.address}` });
      const reg = getContract({ client, chain: CHAIN, address: DEPLOYED_CONTRACTS.addresses.InvestorRegistry as `0x${string}` });
      const tx = prepareContractCall({ contract: reg, method: "function registerProfile(string)", params: [uri] });
      await sendTransaction({ transaction: tx, account });
      setHasProfile(true);
      setShowProfileSetup(false);
    } catch (err) {
      console.error(err);
      alert("Failed to create profile. See console.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    await fetchFundraises();
    setRefreshing(false);
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const displayed = fundraises.filter(f =>
    filter === "all" ? true : !f.isResolved && f.fundingDeadline > now && f.totalRaised < f.targetAmount
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Job Fundraises</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Invest in verified freelancer jobs. Your principal is protected by locked escrow — earn profit when the job completes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border hover:bg-surface-secondary transition-colors text-sm">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button onClick={() => router.push("/investor/portfolio")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-primary text-white text-sm font-medium">
            <TrendingUp className="w-4 h-4" /> My Portfolio
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "My Wallet (MATIC)", value: maticBalance ? `${parseFloat(maticBalance.displayValue).toFixed(4)}` : "...", icon: Zap },
          { label: "My Wallet (USDT)", value: usdtBalance ? `$${usdtBalance}` : "...", icon: DollarSign },
          { label: "Profit Earned", value: `$${formatUSDT(totalProfit)}`, icon: Target },
          { label: "My Investments", value: fundraises.filter(f => f.myDeposit > 0n).length, icon: TrendingUp },
        ].map(s => (
          <div key={s.label} className="glass-effect rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <s.icon className={`w-4 h-4 ${s.label === 'Profit Earned' && totalProfit > 0n ? 'text-emerald-400' : 'text-primary'}`} />
            </div>
            <p className={`text-2xl font-bold truncate ${s.label === 'Profit Earned' && totalProfit > 0n ? 'text-emerald-400' : ''}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(["active", "all"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === f ? "bg-gradient-primary text-white" : "border border-border hover:bg-surface-secondary"}`}>
            {f === "active" ? "Active Only" : "All"}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <Target className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">No {filter === "active" ? "active " : ""}fundraises yet.</p>
          {filter === "active" && <button onClick={() => setFilter("all")} className="text-primary text-sm hover:underline">View all</button>}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {displayed.map((f, i) => {
            const pct = fillPct(f.totalRaised, f.targetAmount);
            const isExpired = f.fundingDeadline <= now;
            const isActive = !f.isResolved && !isExpired && f.totalRaised < f.targetAmount;

            return (
              <motion.div key={f.address} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`glass-effect rounded-2xl p-5 flex flex-col gap-4 border hover:shadow-lg hover:shadow-primary/10 transition-all ${f.myDeposit > 0n ? "border-primary/40" : "border-border"}`}>
                {/* Head */}
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{f.jobTitle}</p>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground mr-2">
                      <span className="shrink-0 font-medium">Freelancer:</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/freelancer/${f.jobFreelancer}`); }}
                        className="text-primary hover:underline font-mono truncate"
                      >
                        {f.jobFreelancer ? `${f.jobFreelancer.slice(0, 6)}...${f.jobFreelancer.slice(-4)}` : "Loading..."}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-1.5 ml-2 flex-shrink-0 flex-wrap justify-end">
                    {f.myDeposit > 0n && <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">Invested</span>}
                    <span className={`px-2 py-0.5 text-xs rounded-full ${isActive ? "bg-emerald-500/20 text-emerald-400" : f.isResolved ? "bg-blue-500/20 text-blue-400" : "bg-red-500/20 text-red-400"}`}>
                      {f.isResolved ? (f.isAccepted ? "Funded" : "Cancelled") : isExpired ? "Expired" : "Active"}
                    </span>
                  </div>
                </div>

                {/* Progress */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatUSDT(f.totalRaised)} / {formatUSDT(f.targetAmount)} USDT</span>
                    <span className="font-medium">{pct}%</span>
                  </div>
                  <div className="h-2 bg-surface rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }}
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full" />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface rounded-xl p-2.5 text-center">
                    <p className="text-xs text-muted-foreground">Profit Share</p>
                    <p className="text-xl font-bold text-emerald-400">{Number(f.investorProfitShareBps) / 100}%</p>
                  </div>
                  <div className="bg-surface rounded-xl p-2.5 text-center">
                    <p className="text-xs text-muted-foreground">Deadline</p>
                    <p className={`text-sm font-bold ${isExpired ? "text-red-400" : "text-amber-400"}`}>{formatDeadline(f.fundingDeadline)}</p>
                  </div>
                </div>

                {f.myDeposit > 0n && (
                  <div className="flex items-center gap-2 bg-primary/10 rounded-xl p-2.5 text-sm">
                    <DollarSign className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground text-xs">Your stake:</span>
                    <span className="font-semibold text-primary text-sm">{formatUSDT(f.myDeposit)} USDT</span>
                  </div>
                )}

                {(() => {
                  if (!account) {
                    return <p className="text-center text-xs text-muted-foreground py-1">Connect wallet to invest</p>;
                  }
                  if (!isActive) {
                    return <p className="text-center text-xs text-muted-foreground py-1">{f.isResolved ? "Fundraise closed" : "Funding period ended"}</p>;
                  }

                  const isOwnerOrFreelancer =
                    account.address.toLowerCase() === f.jobClient.toLowerCase() ||
                    account.address.toLowerCase() === f.jobFreelancer.toLowerCase();

                  if (isOwnerOrFreelancer) {
                    return (
                      <div className="text-center bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl py-2.5 px-3 text-xs w-full">
                        You cannot invest in your own job.
                      </div>
                    );
                  }

                  if (hasProfile === false) {
                    return (
                      <button onClick={() => setShowProfileSetup(true)}
                        className="w-full py-2.5 rounded-xl bg-surface border border-border text-foreground text-sm font-semibold hover:bg-surface-secondary transition-colors">
                        Create Profile to Invest
                      </button>
                    );
                  }

                  return (
                    <button onClick={() => setSelected(f)}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                      <Zap className="w-4 h-4" /> Invest Now <ChevronRight className="w-4 h-4" />
                    </button>
                  );
                })()}
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {selected && (
          <InvestModal
            fundraise={selected}
            onClose={() => setSelected(null)}
            onSuccess={refresh}
            buildExecAccount={getExecutionAccount}
          />
        )}

        {/* Profile Setup Modal */}
        {showProfileSetup && !hasProfile && account && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-surface-secondary border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Create Investor Profile</h2>
                <button onClick={() => setShowProfileSetup(false)} className="p-1 rounded-lg hover:bg-surface transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                You need to set up a public profile before investing in jobs or companies. This information will be stored on IPFS.
              </p>
              <form onSubmit={handleCreateProfile} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Display Name *</label>
                  <input required type="text" value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary"
                    placeholder="E.g. Web3 Capital" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Short Bio (Optional)</label>
                  <textarea rows={3} value={profileForm.bio} onChange={e => setProfileForm({ ...profileForm, bio: e.target.value })}
                    className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary resize-none"
                    placeholder="Tell freelancers about your investment thesis..." />
                </div>
                <button type="submit" disabled={savingProfile || !profileForm.name}
                  className="w-full py-3 mt-2 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center gap-2">
                  {savingProfile ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating Profile...</> : "Complete Setup"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
