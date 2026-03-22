"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Wallet,
  User,
  Briefcase,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  Star,
  FileText,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { getContract, readContract } from "thirdweb";
import { getWalletBalance } from "thirdweb/wallets";
import { polygonAmoy } from "thirdweb/chains";

import { client } from "@/lib/thirdweb";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { CHAIN } from "@/lib/chains";
import { useChatContext } from "@/components/chat/ChatContext";

// -----------------------------
// Types for Jobs
// -----------------------------
interface SimpleJob {
  jobId: number;
  title: string;
  budgetUSDC: bigint;
  status: number;
  client: string;
  hiredFreelancer: string;
  createdAt: bigint;
}

const JOB_STATUS_LABEL: Record<number, string> = {
  0: "Unknown",
  1: "Open",
  2: "Hired",
  3: "Cancelled",
  4: "Completed",
  5: "Expired",
};

export default function FreelancerHome() {
  const router = useRouter();
  const account = useActiveAccount();
  const { setChatContext } = useChatContext();

  const [balance, setBalance] = useState<{ displayValue: string; symbol: string } | null>(null);
  const [usdtBalance, setUsdtBalance] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    totalEarnings: 0,
    completedJobs: 0,
    rating: 0, // will be % (0 - 100)
    isKYCVerified: false,
    level: 1,
    stars: 1,
  });

  // Applied, Hired & Completed jobs
  const [appliedJobs, setAppliedJobs] = useState<SimpleJob[]>([]);
  const [hiredJobs, setHiredJobs] = useState<SimpleJob[]>([]);
  const [completedJobs, setCompletedJobs] = useState<SimpleJob[]>([]);
  const [cancelledJobs, setCancelledJobs] = useState<SimpleJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [disputedCount, setDisputedCount] = useState(0);
  const [cancelledCount, setCancelledCount] = useState(0);
  const [mobileJobTab, setMobileJobTab] = useState<"hired" | "applied" | "completed" | "cancelled">("hired");
  const [desktopJobTab, setDesktopJobTab] = useState<"hired" | "applied" | "completed" | "cancelled">("hired");

  // Faucet state
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetMessage, setFaucetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ===== 1) Fetch Platform Fee & Balance (Manual Refresh) =====
  const [platformFeeBps, setPlatformFeeBps] = useState<number>(0);

  const fetchBalance = async () => {
    if (!account?.address) return;
    try {
      setLoadingBalance(true);

      // Fetch platform fee from EscrowFactory
      try {
        const factory = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.EscrowFactory as `0x${string}`,
        });
        const feeRaw = await readContract({
          contract: factory,
          method: "function platformFeeBps() view returns (uint16)",
        });
        setPlatformFeeBps(Number(feeRaw));
      } catch (e) {
        console.error("Failed to fetch platform fee:", e);
      }

      // Fetch MATIC balance
      const maticResult = await getWalletBalance({
        client,
        chain: polygonAmoy,
        address: account.address,
      });
      setBalance({ displayValue: maticResult.displayValue, symbol: maticResult.symbol });

      // Fetch USDT balance
      const usdt = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.MockUSDT,
      });

      const usdtRaw = await readContract({
        contract: usdt,
        method: "function balanceOf(address) view returns (uint256)",
        params: [account.address],
      });

      const decimals = await readContract({
        contract: usdt,
        method: "function decimals() view returns (uint8)",
      });

      const formatted = Number(usdtRaw as bigint) / 10 ** Number(decimals);
      setUsdtBalance(formatted.toFixed(2));
    } catch (err) {
      console.error("Balance fetch failed:", err);
    } finally {
      setLoadingBalance(false);
    }
  };

  // Initial balance fetch on mount
  useEffect(() => {
    if (!account?.address) return;
    fetchBalance();
  }, [account?.address]);

  // ===== 2) Fetch Profile Data (FreelancerProfile) =====
  const loadProfile = async (addr: string) => {
    try {
      setLoadingStats(true);
      const factory = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory as `0x${string}`,
      });

      const profileAddr = await readContract({
        contract: factory as any,
        method: "function freelancerProfile(address) view returns (address)",
        params: [addr],
      });

      if (!profileAddr || profileAddr === "0x0000000000000000000000000000000000000000")
        return;

      const profileContract = getContract({
        client,
        chain: CHAIN,
        address: profileAddr as `0x${string}`,
      });

      const safeRead = async (method: `function ${string}`) => {
        try {
          return await readContract<any, any>({
            contract: profileContract as any,
            method,
          });
        } catch {
          console.warn("Missing field on FreelancerProfile:", method);
          return null;
        }
      };

      const [
        name,
        bio,
        totalEarningsRaw,
        completedJobsRaw,
        ratingRaw,
        isKYCVerifiedRaw,
        totalPointsRaw,
        levelOnChainRaw,
        disputedJobsRaw,
        cancelledJobsRaw,
      ] = await Promise.all([
        safeRead("function name() view returns (string)"),
        safeRead("function bio() view returns (string)"),
        safeRead("function totalEarnings() view returns (uint256)"),
        safeRead("function completedJobs() view returns (uint256)"),
        safeRead("function rating() view returns (uint256)"),
        safeRead("function isKYCVerified() view returns (bool)"),
        safeRead("function totalPoints() view returns (uint256)"),
        safeRead("function level() view returns (uint8)"),
        safeRead("function disputedJobs() view returns (uint256)"),
        safeRead("function cancelledJobs() view returns (uint256)"),
      ]);

      const completedJobs = Number(completedJobsRaw || 0);
      setDisputedCount(Number(disputedJobsRaw || 0));
      setCancelledCount(Number(cancelledJobsRaw || 0));
      let level = 0;
      if (typeof levelOnChainRaw === "bigint" || typeof levelOnChainRaw === "number") {
        level = Number(levelOnChainRaw);
      }
      const totalPoints = Number(totalPointsRaw || 0);
      if (level === 0) {
        if (completedJobs >= 25 && totalPoints >= 120) level = 5;
        else if (completedJobs >= 20 && totalPoints >= 95) level = 4;
        else if (completedJobs >= 15 && totalPoints >= 70) level = 3;
        else if (completedJobs >= 10 && totalPoints >= 45) level = 2;
        else if (completedJobs >= 5 && totalPoints >= 20) level = 1;
        else level = 0;
      }
      const stars = Math.max(1, level || 0);
      let ratingPercent = 0;
      if (ratingRaw != null) ratingPercent = Number(ratingRaw || 0);
      else if (completedJobs > 0 && totalPoints > 0)
        ratingPercent = Math.round((totalPoints / (completedJobs * 5)) * 100);

      const totalEarningsNum = totalEarningsRaw != null ? Number(totalEarningsRaw) / 1e6 : 0;

      setProfile({ name: name || "Unnamed", bio: bio || "No bio yet", profileAddress: profileAddr });
      setStats({ totalEarnings: totalEarningsNum, completedJobs, rating: ratingPercent, isKYCVerified: Boolean(isKYCVerifiedRaw), level, stars });
    } catch (err) {
      console.error("Failed to load profile data:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (!account?.address) return;
    loadProfile(account.address);
  }, [account?.address]);

  // ===== 3) Fetch Applied & Hired Jobs (Optimized with Promise.all) =====
  const loadJobs = async () => {
    if (!account?.address) return;
    try {
      setLoadingJobs(true);

      const jobBoard = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.JobBoard as `0x${string}`,
      });

      // ---------------------------------------------------------
      // 1) Get job IDs this freelancer has APPLIED to
      // ---------------------------------------------------------
      const appliedJobIdsPromise = readContract({
        contract: jobBoard,
        method: "function getJobsAppliedBy(address) view returns (uint256[])",
        params: [account.address],
      });

      // ---------------------------------------------------------
      // 2) Get job IDs from DIRECT OFFERS (Storage-based, no events needed!)
      // ---------------------------------------------------------
      const directOfferIdsPromise = readContract({
        contract: jobBoard,
        method: "function getOffersToFreelancer(address) view returns (uint256[])",
        params: [account.address],
      });

      const [appliedJobIds, directOfferIds] = await Promise.all([
        appliedJobIdsPromise,
        directOfferIdsPromise
      ]);

      // Merge and deduplicate (some jobs might technically be in both if logic allowed, safe to merge)
      const allJobIds = Array.from(new Set([
        ...(appliedJobIds as bigint[]).map(n => Number(n)),
        ...(directOfferIds as bigint[]).map(n => Number(n))
      ]));


      if (allJobIds.length === 0) {
        setAppliedJobs([]);
        setHiredJobs([]);
        setCompletedJobs([]);
        return;
      }

      // Parallel fetch all job details
      const jobPromises = allJobIds.map(async (idNum) => {
        if (!idNum) return null;
        if (!idNum) return null;

        try {
          const data = (await readContract({
            contract: jobBoard,
            method:
              "function getJob(uint256) view returns (address,string,string,uint256,uint8,address,address,uint64,uint64,uint64,bytes32[],uint256)",
            params: [BigInt(idNum)],
          })) as any;

          const [
            clientAddr,
            title,
            _descriptionURI,
            budgetUSDC,
            status,
            hiredFreelancer,
            escrowAddr,
            createdAt,
          ] = data;

          let jobStatus = Number(status);
          const ZERO = "0x0000000000000000000000000000000000000000";

          // Check escrow terminal status: distinguish Completed vs Cancelled
          if (jobStatus === 2 && escrowAddr && escrowAddr !== ZERO) {
            try {
              const escrow = getContract({
                client,
                chain: CHAIN,
                address: escrowAddr as `0x${string}`,
              });

              const [terminalRaw, cancelReqBy] = await Promise.all([
                readContract({
                  contract: escrow,
                  method: "function terminal() view returns (bool)",
                }),
                readContract({
                  contract: escrow,
                  method: "function cancelRequestedBy() view returns (address)",
                }).catch(() => ZERO),
              ]);

              if (terminalRaw) {
                // Read profile's jobInfo to distinguish Completed vs Cancelled
                // jobKey = keccak256(abi.encode(escrowAddr, client, freelancer))
                // However, we can check the escrow balance: if 0 and terminal, it was paid.
                // Simpler: check if escrow's `disputed` was true and then read profile.
                // We check escrow.client and escrow.freelancer to build the jobKey:
                const [escrowClient, escrowFreelancer] = await Promise.all([
                  readContract({ contract: escrow, method: "function client() view returns (address)" }).catch(() => ZERO),
                  readContract({ contract: escrow, method: "function freelancer() view returns (address)" }).catch(() => ZERO),
                ]);

                // Check if it was a cancellation (balance goes back to client = Cancelled)
                // The profile has `cancelledJobs` counter; but simpler: check escrow was disputed
                const disputed = await readContract({
                  contract: escrow,
                  method: "function disputed() view returns (bool)",
                }).catch(() => false);

                // If disputed and terminal, we need to check profile's job status
                // Build jobKey: keccak256(abi.encode(address(escrow), client, freelancer))
                // Actually we check from freelancer profile
                if (disputed) {
                  try {
                    const factory = getContract({
                      client,
                      chain: CHAIN,
                      address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory as `0x${string}`,
                    });
                    const profileAddr = await readContract({
                      contract: factory,
                      method: "function freelancerProfile(address) view returns (address)",
                      params: [account!.address],
                    });
                    if (profileAddr && profileAddr !== ZERO) {
                      const profileC = getContract({ client, chain: CHAIN, address: profileAddr as `0x${string}` });
                      // jobKey is keccak256(abi.encode(escrow, client, freelancer))
                      // We can't easily compute this off-chain without ethers, so we use
                      // a workaround: mark as Cancelled if cancelRequestedBy != ZERO AND terminal,
                      // OR if escrow had a full-refund dispute (USDT balance = 0 + no payout).
                      // Simplest reliable heuristic: if the cancelled counter in profile is > 0
                      // AND this job's escrow is terminal + disputed, check USDT balance
                      const [escrowBal] = await readContract({
                        contract: getContract({ client, chain: CHAIN, address: DEPLOYED_CONTRACTS.addresses.MockUSDT }),
                        method: "function balanceOf(address) view returns (uint256)",
                        params: [escrowAddr as `0x${string}`],
                      }).then(v => [v]).catch(() => [0n]);
                      if (BigInt(escrowBal as any) === 0n) {
                        // Might be Completed (paid) or fully Cancelled (refunded) — both have 0 bal
                        // Use the delivered status as a proxy: if delivered, likely Approved/Completed
                        const delivered = await readContract({
                          contract: escrow,
                          method: "function delivered() view returns (bool)",
                        }).catch(() => false);
                        jobStatus = delivered ? 4 : 3; // 4=Completed, 3=Cancelled
                      } else {
                        jobStatus = 4; // still has funds somehow — unusual, treat as pending
                      }
                    } else {
                      jobStatus = 4; // fallback
                    }
                  } catch {
                    jobStatus = 4; // fallback
                  }
                } else {
                  // Not disputed + terminal = normal completion or cancellation
                  const cancelReqStr = String(cancelReqBy);
                  jobStatus = cancelReqStr !== ZERO ? 3 : 4; // 3=Cancelled if cancel was requested
                }
              }
            } catch (err) {
              console.log("Could not check escrow status:", err);
            }
          }

          return {
            jobId: idNum,
            client: clientAddr,
            title,
            budgetUSDC,
            status: jobStatus,
            hiredFreelancer,
            createdAt,
          } as SimpleJob;
        } catch (err) {
          console.error("Failed to load job", idNum, err);
          return null;
        }
      });

      // Wait for all jobs to load in parallel
      const allJobs = await Promise.all(jobPromises);
      const jobs = allJobs.filter((j) => j !== null) as SimpleJob[];

      const lower = account.address.toLowerCase();

      const applied = jobs.filter((j) => j.status === 1); // Open
      const hired = jobs.filter(
        (j) => j.status === 2 && j.hiredFreelancer?.toLowerCase() === lower
      );
      const completed = jobs.filter((j) => j.status === 4); // Completed/Approved
      const cancelled = jobs.filter((j) => j.status === 3); // Cancelled/Refunded

      setAppliedJobs(applied);
      setHiredJobs(hired);
      setCompletedJobs(completed);
      setCancelledJobs(cancelled);

      // Only update stats from job list if the on-chain profile values are zero
      // (on-chain values set by loadProfile() take priority)
      setStats((prev) => {
        // Use on-chain completedJobs if already populated; otherwise derive from job list
        const completedCount = prev.completedJobs > 0 ? prev.completedJobs : completed.length;

        // Use on-chain totalEarnings if already populated; otherwise compute from job list
        let earnings = prev.totalEarnings;
        if (earnings === 0 && completed.length > 0) {
          const feeMultiplier = (10000 - platformFeeBps) / 10000;
          earnings = completed.reduce((sum, job) => {
            return sum + (Number(job.budgetUSDC) / 1e6) * feeMultiplier;
          }, 0);
        }

        return {
          ...prev,
          completedJobs: completedCount,
          totalEarnings: earnings,
        };
      });
    } catch (err) {
      console.error("Failed to load applied/hired jobs:", err);
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address, platformFeeBps]); // Re-fetch when fee changes

  // Faucet handler
  const requestTestTokens = async () => {
    if (!account?.address) return;

    try {
      setFaucetLoading(true);
      setFaucetMessage(null);

      const response = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientAddress: account.address }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to request tokens');
      }

      setFaucetMessage({ type: 'success', text: data.message });
      // Refresh balance after successful faucet
      setTimeout(() => fetchBalance(), 2000);
    } catch (error: any) {
      setFaucetMessage({ type: 'error', text: error.message });
    } finally {
      setFaucetLoading(false);
      // Clear message after 5 seconds
      setTimeout(() => setFaucetMessage(null), 5000);
    }
  };

  useEffect(() => {
    if (!account) return;
    const contextData = `
--- CURRENT USER CONTEXT ---
Role: Freelancer
Name: ${profile?.name || "Unnamed"}
Wallet Address: ${account.address}
Level: ${stats.level} (${stats.stars} Stars)
KYC Verified: ${stats.isKYCVerified ? "Yes" : "No"}
Job Success Rate (Rating): ${stats.rating}%
Total Earnings: ${stats.totalEarnings.toFixed(2)} USDT
Completed Jobs: ${stats.completedJobs}
Disputed Jobs: ${disputedCount}
Cancelled Jobs: ${cancelledCount}
Wallet Balances: MATIC: ${balance?.displayValue} ${balance?.symbol}, USDT: ${usdtBalance} USDT
Pending/Applied Jobs: ${appliedJobs.length}
Hired (Active) Jobs: ${hiredJobs.length}
    `;
    setChatContext((prev) => {
      const base = prev.split('--- CURRENT USER CONTEXT ---')[0].trim();
      return base + '\n\n' + contextData;
    });
  }, [account, profile, stats, disputedCount, cancelledCount, balance, usdtBalance, appliedJobs.length, hiredJobs.length, setChatContext]);

  if (!account)
    return (
      <div className="p-4 md:p-8">
        Please connect your wallet to view dashboard.
      </div>
    );

  return (
    <main className="flex-1 p-4 md:p-8 overflow-y-auto space-y-6 md:space-y-8">

      {/* ===== MOBILE HERO (hidden on md+) ===== */}
      <div className="block md:hidden">
        <div className="rounded-2xl p-4 border border-border shadow-lg"
          style={{ background: "linear-gradient(135deg, hsl(var(--primary)/0.15) 0%, hsl(var(--primary)/0.04) 100%)" }}>

          {/* Avatar + name row */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 border-2 border-primary/40 flex-shrink-0 flex items-center justify-center text-xl font-bold text-primary">
              {profile?.name?.charAt(0)?.toUpperCase() || "F"}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold truncate">Welcome, {profile?.name || "Freelancer"} 👋</h1>
              <div className="flex items-center gap-2 mt-0.5">
                {stats.isKYCVerified ? (
                  <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
                    <ShieldCheck className="w-3 h-3" /> KYC ✓
                  </span>
                ) : (
                  <span className="text-xs text-yellow-400">KYC Pending</span>
                )}
                <span className="text-xs text-muted-foreground">Lv.{stats.level}</span>
                <span className="flex">
                  {Array.from({ length: stats.stars }).map((_, i) => (
                    <Star key={i} className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  ))}
                </span>
              </div>
            </div>
            <button
              onClick={() => router.push("/freelancer/Profile")}
              className="flex-shrink-0 p-2 rounded-full bg-primary text-primary-foreground"
            >
              <User className="w-4 h-4" />
            </button>
          </div>

          {/* Balances */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-xl bg-black/25 p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">MATIC</p>
              {loadingBalance ? (
                <div className="h-5 w-14 bg-white/10 rounded animate-pulse" />
              ) : (
                <p className="text-sm font-bold text-primary truncate">
                  {balance ? parseFloat(balance.displayValue).toFixed(3) : "0"}
                </p>
              )}
            </div>
            <div className="rounded-xl bg-black/25 p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">USDT</p>
              {loadingBalance ? (
                <div className="h-5 w-14 bg-white/10 rounded animate-pulse" />
              ) : (
                <p className="text-sm font-bold text-primary truncate">{usdtBalance ?? "0"} USDT</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={requestTestTokens}
              disabled={faucetLoading}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold disabled:opacity-50"
            >
              {faucetLoading ? "Requesting..." : "🚰 Get Test Tokens"}
            </button>
            <button
              onClick={fetchBalance}
              disabled={loadingBalance}
              className="p-2.5 rounded-xl border border-border bg-black/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-primary ${loadingBalance ? "animate-spin" : ""}`} />
            </button>
          </div>
          {faucetMessage && (
            <p className={`text-[11px] mt-2 ${faucetMessage.type === "success" ? "text-green-400" : "text-red-400"}`}>
              {faucetMessage.text}
            </p>
          )}
        </div>
      </div>

      {/* ===== DESKTOP HEADER (hidden on mobile) ===== */}
      <div className="hidden md:flex md:flex-row items-center justify-between gap-4 w-full">
        <div className="w-full">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground break-words">
            Welcome Back, {profile?.name || "Freelancer"} 👋
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
            {stats.isKYCVerified ? (
              <span className="flex items-center gap-1 text-green-500">
                <ShieldCheck className="w-4 h-4" /> KYC Verified
              </span>
            ) : (
              <span className="text-yellow-400">KYC Pending</span>
            )}
            <span className="ml-2">Level {stats.level}</span>
            <span className="flex ml-1">
              {Array.from({ length: stats.stars }).map((_, i) => (
                <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              ))}
            </span>
          </div>
        </div>
        <button
          onClick={() => router.push("/freelancer/Profile")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition w-full md:w-auto justify-center"
        >
          <User className="w-4 h-4" />
          Profile
        </button>
      </div>

      {/* STATS CARDS */}
      <div className="space-y-3 w-full">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Stats</h2>
          <button
            onClick={() => account?.address && loadProfile(account.address)}
            disabled={loadingStats}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-surface-secondary transition disabled:opacity-50 text-sm"
            title="Refresh stats from blockchain"
          >
            <RefreshCw className={`w-4 h-4 ${loadingStats ? "animate-spin" : ""}`} />
            Refresh Stats
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4 w-full">
          {[
            {
              icon: DollarSign,
              label: "Total Earnings",
              value: `${stats.totalEarnings.toFixed(2)} USDT`,
            },
            {
              icon: Briefcase,
              label: "Completed Jobs",
              value: stats.completedJobs.toString(),
            },
            {
              icon: TrendingUp,
              label: "Job Success Rate",
              value: stats.rating ? `${stats.rating}%` : "N/A",
            },
            {
              icon: ShieldCheck,
              label: "Disputed Jobs",
              value: disputedCount.toString(),
            },
            {
              icon: Briefcase,
              label: "Cancelled Jobs",
              value: cancelledCount.toString(),
            },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="p-3 md:p-6 rounded-2xl glass-effect border border-border shadow-md flex flex-col items-start justify-between gap-2"
            >
              <div className="flex items-center justify-between w-full">
                <p className="text-xs md:text-sm text-foreground-secondary">{stat.label}</p>
                <stat.icon className="w-4 h-4 md:w-6 md:h-6 text-primary flex-shrink-0" />
              </div>
              <h2 className="text-lg md:text-2xl font-semibold break-words">{stat.value}</h2>
            </motion.div>
          ))}
        </div>
      </div>

      {/* WALLET BALANCE (desktop only — mobile shows balance in hero card above) */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="hidden md:block rounded-2xl p-6 glass-effect border border-border shadow-md break-words"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" /> Wallet Balance
          </h2>
          <button
            onClick={fetchBalance}
            disabled={loadingBalance}
            className="p-2 rounded-lg hover:bg-primary/10 transition-colors disabled:opacity-50"
            title="Refresh balance"
          >
            <RefreshCw className={`w-5 h-5 text-primary ${loadingBalance ? "animate-spin" : ""}`} />
          </button>
        </div>
        {loadingBalance ? (
          <p className="text-foreground-secondary">Fetching balance…</p>
        ) : (
          <div className="flex gap-8">
            <div>
              <p className="text-sm text-foreground-secondary">MATIC</p>
              <p className="text-2xl font-bold text-primary">
                {balance ? `${parseFloat(balance.displayValue).toFixed(4)} ${balance.symbol}` : "0"}
              </p>
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">USDT</p>
              <p className="text-2xl font-bold text-primary">
                {usdtBalance !== null ? `${usdtBalance} USDT` : "0"}
              </p>
            </div>
            <div className="ml-auto flex flex-col justify-end">
              <button
                onClick={requestTestTokens}
                disabled={faucetLoading}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 transition disabled:opacity-50 text-sm"
              >
                {faucetLoading ? "Requesting..." : "🚰 Get Test Tokens (0.5 MATIC + 500 USDT)"}
              </button>
              {faucetMessage && (
                <p className={`text-xs mt-1 ${faucetMessage.type === "success" ? "text-green-500" : "text-red-500"}`}>
                  {faucetMessage.text}
                </p>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* ================================
          APPLIED & HIRED JOBS
      ================================= */}
      <section className="space-y-6">
        {loadingJobs ? (
          <p className="text-sm text-muted-foreground">Loading jobs…</p>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <span className="hidden md:inline">Your Jobs</span>
                <span className="md:hidden">My Jobs</span>
              </h2>
              <button
                onClick={loadJobs}
                disabled={loadingJobs}
                className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg border border-border hover:bg-surface-secondary transition disabled:opacity-50 text-sm md:text-base"
                title="Refresh jobs"
              >
                <RefreshCw className={`w-4 h-4 ${loadingJobs ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>

            {/* ===== MOBILE: Tab Switcher (0 to 767px) ===== */}
            <div className="block md:hidden space-y-3">
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                {(["hired", "applied", "completed", "cancelled"] as const).map((tab) => {
                  const counts = { hired: hiredJobs.length, applied: appliedJobs.length, completed: completedJobs.length, cancelled: cancelledJobs.length };
                  const labels = { hired: "Active", applied: "Applied", completed: "Done", cancelled: "Cancelled" };
                  const activeStyle = { hired: "bg-emerald-500 text-white", applied: "bg-primary text-primary-foreground", completed: "bg-blue-500 text-white", cancelled: "bg-red-500 text-white" };
                  const isActive = mobileJobTab === tab;
                  return (
                    <button key={tab} onClick={() => setMobileJobTab(tab)}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${isActive ? activeStyle[tab] : "border border-border text-muted-foreground"}`}>
                      {labels[tab]}
                      <span className={`rounded-full px-1.5 text-[10px] font-bold ${isActive ? "bg-white/25" : "bg-border"}`}>{counts[tab]}</span>
                    </button>
                  );
                })}
              </div>
              {/* Tab content */}
              {mobileJobTab === "hired" && (hiredJobs.length === 0
                ? <p className="text-sm text-muted-foreground py-6 text-center">No active jobs yet.</p>
                : hiredJobs.map(job => (
                  <div key={job.jobId} className="border border-emerald-500/30 rounded-xl p-4 bg-emerald-500/5">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0 mr-3"><h4 className="font-semibold text-sm line-clamp-2">{job.title}</h4><p className="text-xs text-muted-foreground mt-0.5">#{job.jobId} · {job.client.slice(0,6)}...{job.client.slice(-4)}</p></div>
                      <span className="text-sm font-bold text-emerald-400 flex-shrink-0">{(Number(job.budgetUSDC)/1e6).toFixed(2)} USDT</span>
                    </div>
                    <button onClick={() => router.push(`/freelancer/jobs/${job.jobId}`)} className="w-full py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center gap-1">View Details <ArrowRight className="w-3 h-3" /></button>
                  </div>
                ))
              )}
              {mobileJobTab === "applied" && (appliedJobs.length === 0
                ? <p className="text-sm text-muted-foreground py-6 text-center">No pending applications.</p>
                : appliedJobs.map(job => (
                  <div key={job.jobId} className="border border-border rounded-xl p-4 bg-surface-secondary">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0 mr-3"><h4 className="font-semibold text-sm line-clamp-2">{job.title}</h4><p className="text-xs text-muted-foreground mt-0.5">Job #{job.jobId}</p></div>
                      <span className="text-sm font-bold text-primary flex-shrink-0">{(Number(job.budgetUSDC)/1e6).toFixed(2)} USDT</span>
                    </div>
                    <button onClick={() => router.push(`/freelancer/jobs/${job.jobId}`)} className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1">View Details <ArrowRight className="w-3 h-3" /></button>
                  </div>
                ))
              )}
              {mobileJobTab === "completed" && (completedJobs.length === 0
                ? <p className="text-sm text-muted-foreground py-6 text-center">No completed jobs yet.</p>
                : completedJobs.map(job => (
                  <div key={job.jobId} className="border border-blue-500/30 rounded-xl p-4 bg-blue-500/5">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0 mr-3"><h4 className="font-semibold text-sm line-clamp-2">{job.title}</h4><p className="text-xs text-muted-foreground mt-0.5">#{job.jobId} · {job.client.slice(0,6)}...{job.client.slice(-4)}</p></div>
                      <span className="text-sm font-bold text-blue-400 flex-shrink-0">{(Number(job.budgetUSDC)/1e6).toFixed(2)} USDT</span>
                    </div>
                    <button onClick={() => router.push(`/freelancer/jobs/${job.jobId}`)} className="w-full py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold flex items-center justify-center gap-1">View Details <ArrowRight className="w-3 h-3" /></button>
                  </div>
                ))
              )}
              {mobileJobTab === "cancelled" && (cancelledJobs.length === 0
                ? <p className="text-sm text-muted-foreground py-6 text-center">No cancelled jobs.</p>
                : cancelledJobs.map(job => (
                  <div key={job.jobId} className="border border-red-500/30 rounded-xl p-4 bg-red-500/5">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0 mr-3"><h4 className="font-semibold text-sm line-clamp-2">{job.title}</h4><p className="text-xs text-muted-foreground mt-0.5">#{job.jobId} · {job.client.slice(0,6)}...{job.client.slice(-4)}</p></div>
                      <span className="text-sm font-bold text-red-400 flex-shrink-0">{(Number(job.budgetUSDC)/1e6).toFixed(2)} USDT</span>
                    </div>
                    <button onClick={() => router.push(`/freelancer/jobs/${job.jobId}`)} className="w-full py-2 rounded-lg bg-red-900/40 text-red-300 text-xs font-semibold flex items-center justify-center gap-1">View Details <ArrowRight className="w-3 h-3" /></button>
                  </div>
                ))
              )}
            </div>

            {/* ===== DESKTOP: Tabbed View (768px+) ===== */}
            <div className="hidden md:block">
              <div className="flex border-b border-border/60 mb-6">
                {(["hired", "applied", "completed", "cancelled"] as const).map((tab) => {
                  const counts = { hired: hiredJobs.length, applied: appliedJobs.length, completed: completedJobs.length, cancelled: cancelledJobs.length };
                  const labels = { hired: "Active Jobs", applied: "Applied (Pending)", completed: "Completed", cancelled: "Cancelled / Refunded" };
                  const isActive = desktopJobTab === tab;
                  return (
                    <button key={tab} onClick={() => setDesktopJobTab(tab)}
                      className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"}`}>
                      {labels[tab]}
                      <span className={`rounded-full px-2.5 py-0.5 text-xs ${isActive ? "bg-primary/10 text-primary" : "bg-surface-secondary text-muted-foreground"}`}>{counts[tab]}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab Content */}
              <div className="space-y-4">
                {/* Hired / Active Jobs */}
                {desktopJobTab === "hired" && (hiredJobs.length === 0 ? (
                  <div className="text-center py-16 rounded-2xl glass-effect border border-border/50">
                    <p className="text-muted-foreground">No active jobs yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {hiredJobs.map((job) => (
                      <div key={job.jobId} className="flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl glass-effect border border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50 transition-all shadow-sm">
                        <div className="flex-1 flex flex-col md:flex-row md:items-center gap-4 md:gap-8 min-w-0 mr-6">
                          <div className="flex-1 min-w-0">
                             <h4 className="font-semibold text-lg mb-1.5 truncate">{job.title}</h4>
                             <div className="flex items-center gap-3 text-sm text-muted-foreground">
                               <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-medium text-xs">Active</span>
                               <span>Job #{job.jobId}</span>
                               <span>•</span>
                               <span>Client: {job.client.slice(0, 6)}...{job.client.slice(-4)}</span>
                             </div>
                          </div>
                          <div className="text-left md:text-right px-1 md:px-6 md:border-l border-border/50 flex-shrink-0">
                             <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Payment</p>
                             <p className="text-lg font-bold text-emerald-400">{(Number(job.budgetUSDC) / 1e6).toFixed(2)} USDT</p>
                          </div>
                        </div>
                        <div className="mt-4 md:mt-0 md:pl-6 md:border-l border-border/50 flex-shrink-0">
                          <button onClick={() => router.push(`/freelancer/jobs/${job.jobId}`)} className="w-full md:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition flex items-center justify-center gap-2 text-sm font-semibold whitespace-nowrap">
                            View Details <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

                {/* Applied Jobs */}
                {desktopJobTab === "applied" && (appliedJobs.length === 0 ? (
                  <div className="text-center py-16 rounded-2xl glass-effect border border-border/50">
                    <p className="text-muted-foreground">You have not applied to any jobs yet, or they are already hired.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {appliedJobs.map((job) => (
                      <div key={job.jobId} className="flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl glass-effect border border-border bg-surface-secondary hover:border-primary/50 transition-all shadow-sm">
                        <div className="flex-1 flex flex-col md:flex-row md:items-center gap-4 md:gap-8 min-w-0 mr-6">
                          <div className="flex-1 min-w-0">
                             <h4 className="font-semibold text-lg mb-1.5 truncate">{job.title}</h4>
                             <div className="flex items-center gap-3 text-sm text-muted-foreground">
                               <span className="px-2.5 py-0.5 rounded-md bg-surface border border-border text-foreground font-medium text-xs">Job #{job.jobId}</span>
                               <span>•</span>
                               <span>{JOB_STATUS_LABEL[job.status] || "Unknown"}</span>
                             </div>
                          </div>
                          <div className="text-left md:text-right px-1 md:px-6 md:border-l border-border/50 flex-shrink-0">
                             <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Budget</p>
                             <p className="text-lg font-bold text-primary">{(Number(job.budgetUSDC) / 1e6).toFixed(2)} USDT</p>
                          </div>
                        </div>
                        <div className="mt-4 md:mt-0 md:pl-6 md:border-l border-border/50 flex-shrink-0">
                          <button onClick={() => router.push(`/freelancer/jobs/${job.jobId}`)} className="w-full md:w-auto px-6 py-2.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition flex items-center justify-center gap-2 text-sm font-semibold whitespace-nowrap">
                            View Details <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

                {/* Completed Jobs */}
                {desktopJobTab === "completed" && (completedJobs.length === 0 ? (
                  <div className="text-center py-16 rounded-2xl glass-effect border border-border/50">
                    <p className="text-muted-foreground">No completed jobs yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {completedJobs.map((job) => (
                      <div key={job.jobId} className="flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl glass-effect border border-blue-500/30 bg-blue-500/5 hover:border-blue-500/50 transition-all shadow-sm">
                        <div className="flex-1 flex flex-col md:flex-row md:items-center gap-4 md:gap-8 min-w-0 mr-6">
                          <div className="flex-1 min-w-0">
                             <h4 className="font-semibold text-lg mb-1.5 truncate">{job.title}</h4>
                             <div className="flex items-center gap-3 text-sm text-muted-foreground">
                               <span className="px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-400 font-medium text-xs">✓ Done</span>
                               <span>Job #{job.jobId}</span>
                               <span>•</span>
                               <span>Client: {job.client.slice(0, 6)}...{job.client.slice(-4)}</span>
                             </div>
                          </div>
                          <div className="text-left md:text-right px-1 md:px-6 md:border-l border-border/50 flex-shrink-0">
                             <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Earned</p>
                             <p className="text-lg font-bold text-blue-400">{(Number(job.budgetUSDC) / 1e6).toFixed(2)} USDT</p>
                          </div>
                        </div>
                        <div className="mt-4 md:mt-0 md:pl-6 md:border-l border-border/50 flex-shrink-0">
                          <button onClick={() => router.push(`/freelancer/jobs/${job.jobId}`)} className="w-full md:w-auto px-6 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition flex items-center justify-center gap-2 text-sm font-semibold whitespace-nowrap">
                            View Details <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

                {/* Cancelled Jobs */}
                {desktopJobTab === "cancelled" && (cancelledJobs.length === 0 ? (
                  <div className="text-center py-16 rounded-2xl glass-effect border border-border/50">
                    <p className="text-muted-foreground">No cancelled jobs.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cancelledJobs.map((job) => (
                      <div key={job.jobId} className="flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl glass-effect border border-red-500/30 bg-red-500/5 hover:border-red-500/50 transition-all shadow-sm">
                        <div className="flex-1 flex flex-col md:flex-row md:items-center gap-4 md:gap-8 min-w-0 mr-6">
                          <div className="flex-1 min-w-0">
                             <h4 className="font-semibold text-lg mb-1.5 truncate">{job.title}</h4>
                             <div className="flex items-center gap-3 text-sm text-muted-foreground">
                               <span className="px-2.5 py-0.5 rounded-md bg-red-500/20 text-red-500 font-medium text-xs">✕ Cancelled</span>
                               <span>Job #{job.jobId}</span>
                               <span>•</span>
                               <span>Client: {job.client.slice(0, 6)}...{job.client.slice(-4)}</span>
                             </div>
                          </div>
                          <div className="text-left md:text-right px-1 md:px-6 md:border-l border-border/50 flex-shrink-0">
                             <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Refunded</p>
                             <p className="text-lg font-bold text-red-400">{(Number(job.budgetUSDC) / 1e6).toFixed(2)} USDT</p>
                          </div>
                        </div>
                        <div className="mt-4 md:mt-0 md:pl-6 md:border-l border-border/50 flex-shrink-0">
                          <button onClick={() => router.push(`/freelancer/jobs/${job.jobId}`)} className="w-full md:w-auto px-6 py-2.5 rounded-xl bg-red-900/40 text-red-300 hover:bg-red-900/60 transition flex items-center justify-center gap-2 text-sm font-semibold whitespace-nowrap">
                            View Details <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
