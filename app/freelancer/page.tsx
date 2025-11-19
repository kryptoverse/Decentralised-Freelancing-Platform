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
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { getContract, readContract } from "thirdweb";
import { getWalletBalance } from "thirdweb/wallets";
import { polygonAmoy } from "thirdweb/chains";

import { client } from "@/lib/thirdweb";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { CHAIN } from "@/lib/chains";

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

  const [balance, setBalance] = useState<{ displayValue: string; symbol: string } | null>(null);
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

  // Applied & Hired jobs
  const [appliedJobs, setAppliedJobs] = useState<SimpleJob[]>([]);
  const [hiredJobs, setHiredJobs] = useState<SimpleJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // ===== 1) Fetch Wallet Balance =====
  useEffect(() => {
    if (!account?.address) return;

    const fetchBalance = async () => {
      try {
        setLoadingBalance(true);
        const result = await getWalletBalance({
          client,
          chain: polygonAmoy,
          address: account.address,
        });
        setBalance({ displayValue: result.displayValue, symbol: result.symbol });
      } catch (err) {
        console.error("Balance fetch failed:", err);
      } finally {
        setLoadingBalance(false);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 15000);
    return () => clearInterval(interval);
  }, [account?.address]);

  // ===== 2) Fetch Profile Data (FreelancerProfile) =====
  useEffect(() => {
    if (!account?.address) return;

    const loadProfile = async () => {
      try {
        const factory = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory as `0x${string}`,
        });

        const profileAddr = await readContract({
          contract: factory as any,
          method: "function freelancerProfile(address) view returns (address)",
          params: [account.address],
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

        // Try to read all relevant fields. Some may not exist depending on your deployment,
        // but safeRead() will just return null without breaking anything.
        const [
          name,
          bio,
          totalEarningsRaw,
          completedJobsRaw,
          ratingRaw,
          isKYCVerifiedRaw,
          totalPointsRaw,
          levelOnChainRaw,
        ] = await Promise.all([
          safeRead("function name() view returns (string)"),
          safeRead("function bio() view returns (string)"),
          // these two may or may not exist depending on your version
          safeRead("function totalEarnings() view returns (uint256)"),
          safeRead("function completedJobs() view returns (uint256)"),
          // optional aggregated rating field
          safeRead("function rating() view returns (uint256)"),
          safeRead("function isKYCVerified() view returns (bool)"),
          // from your posted contract
          safeRead("function totalPoints() view returns (uint256)"),
          safeRead("function level() view returns (uint8)"),
        ]);

        // Completed jobs count
        const completedJobs = Number(completedJobsRaw || 0);

        // Try to use on-chain level if present, otherwise compute using the same logic as your solidity _computeLevel()
        let level = 0;
        if (typeof levelOnChainRaw === "bigint" || typeof levelOnChainRaw === "number") {
          level = Number(levelOnChainRaw);
        }

        const totalPoints = Number(totalPointsRaw || 0);

        if (level === 0) {
          // mirror your Solidity _computeLevel thresholds as a fallback
          if (completedJobs >= 25 && totalPoints >= 120) level = 5;
          else if (completedJobs >= 20 && totalPoints >= 95) level = 4;
          else if (completedJobs >= 15 && totalPoints >= 70) level = 3;
          else if (completedJobs >= 10 && totalPoints >= 45) level = 2;
          else if (completedJobs >= 5 && totalPoints >= 20) level = 1;
          else level = 0;
        }

        // Stars for UI – at least 1 star for display, but still show underlying level
        const stars = Math.max(1, level || 0);

        // Job success rate / rating (%)
        // Priority:
        // 1) If contract exposes rating(), use that as percentage directly.
        // 2) Else compute as (totalPoints / (completedJobs * 5)) * 100.
        let ratingPercent = 0;
        if (ratingRaw != null) {
          ratingPercent = Number(ratingRaw || 0);
        } else if (completedJobs > 0 && totalPoints > 0) {
          ratingPercent = Math.round((totalPoints / (completedJobs * 5)) * 100);
        } else {
          ratingPercent = 0;
        }

        // Total earnings – if your profile tracks them in USDT (6 decimals),
        // divide by 1e6. If you later flip to 18 decimals, you can adjust here.
        const totalEarningsNum =
          totalEarningsRaw != null ? Number(totalEarningsRaw) / 1e6 : 0;

        setProfile({
          name: name || "Unnamed",
          bio: bio || "No bio yet",
          profileAddress: profileAddr,
        });

        setStats({
          totalEarnings: totalEarningsNum,
          completedJobs,
          rating: ratingPercent, // 0..100
          isKYCVerified: Boolean(isKYCVerifiedRaw),
          level,
          stars,
        });
      } catch (err) {
        console.error("Failed to load profile data:", err);
      }
    };

    loadProfile();
  }, [account?.address]);

  // ===== 3) Fetch Applied & Hired Jobs from JobBoard =====
  useEffect(() => {
    if (!account?.address) return;

    const loadJobs = async () => {
      try {
        setLoadingJobs(true);

        const jobBoard = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.JobBoard as `0x${string}`,
        });

        // jobIds this freelancer has applied to
        const jobIds = (await readContract({
          contract: jobBoard,
          method: "function getJobsAppliedBy(address) view returns (uint256[])",
          params: [account.address],
        })) as bigint[];

        if (!jobIds || jobIds.length === 0) {
          setAppliedJobs([]);
          setHiredJobs([]);
          return;
        }

        const jobs: SimpleJob[] = [];

        for (const idBig of jobIds) {
          const idNum = Number(idBig);
          if (!idNum) continue;

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
              _escrow,
              createdAt,
            ] = data;

            jobs.push({
              jobId: idNum,
              client: clientAddr,
              title,
              budgetUSDC,
              status: Number(status),
              hiredFreelancer,
              createdAt,
            });
          } catch (err) {
            console.error("Failed to load job", idNum, err);
          }
        }

        const lower = account.address.toLowerCase();

        const applied = jobs.filter((j) => j.status === 1); // Open
        const hired = jobs.filter(
          (j) => j.status === 2 && j.hiredFreelancer?.toLowerCase() === lower // Hired
        );

        setAppliedJobs(applied);
        setHiredJobs(hired);
      } catch (err) {
        console.error("Failed to load applied/hired jobs:", err);
      } finally {
        setLoadingJobs(false);
      }
    };

    loadJobs();
  }, [account?.address]);

  if (!account)
    return (
      <div className="p-4 md:p-8">
        Please connect your wallet to view dashboard.
      </div>
    );

  return (
    <main className="flex-1 p-4 md:p-8 overflow-y-auto space-y-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 w-full">
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
                <Star
                  key={i}
                  className="w-4 h-4 text-yellow-400 fill-yellow-400"
                />
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full">
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
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className="p-6 rounded-2xl glass-effect border border-border shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="w-full">
              <p className="text-sm text-foreground-secondary">
                {stat.label}
              </p>
              <h2 className="text-2xl font-semibold break-words">
                {stat.value}
              </h2>
            </div>
            <stat.icon className="w-6 h-6 text-primary flex-shrink-0" />
          </motion.div>
        ))}
      </div>

      {/* WALLET + SMART ACCOUNT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl p-6 glass-effect border border-border shadow-md break-words"
        >
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Smart Account
          </h2>
          <p className="text-sm text-foreground-secondary">
            {`${account.address.slice(0, 6)}...${account.address.slice(-4)}`}
          </p>
          <p className="text-[10px] text-foreground-secondary break-all mt-1">
            {account.address}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-2xl p-6 glass-effect border border-border shadow-md break-words"
        >
          <h2 className="text-xl font-bold mb-3">Wallet Balance</h2>

          {loadingBalance ? (
            <p className="text-foreground-secondary">Fetching balance…</p>
          ) : balance ? (
            <p className="text-3xl font-bold text-primary break-words">
              {balance.displayValue} {balance.symbol}
            </p>
          ) : (
            <p className="text-foreground-secondary break-words">
              {account?.address
                ? "0 POL or failed to load balance"
                : "Connect your wallet"}
            </p>
          )}
        </motion.div>
      </div>

      {/* ================================
          APPLIED & HIRED JOBS
      ================================= */}
      <section className="space-y-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Your Jobs
          </h2>
        </div>

        {loadingJobs ? (
          <p className="text-sm text-muted-foreground">Loading jobs…</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Applied Jobs */}
            <div className="rounded-2xl p-5 glass-effect border border-border shadow-md">
              <h3 className="text-lg font-semibold mb-3">Applied (Pending)</h3>
              {appliedJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  You have not applied to any jobs yet, or they are already
                  hired.
                </p>
              ) : (
                <div className="space-y-3">
                  {appliedJobs.map((job) => (
                    <div
                      key={job.jobId}
                      className="border border-border/60 rounded-xl p-3 flex flex-col gap-2"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-semibold text-sm line-clamp-2">
                            {job.title}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Job #{job.jobId} •{" "}
                            {JOB_STATUS_LABEL[job.status] || "Unknown"}
                          </p>
                        </div>
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary">
                          {(Number(job.budgetUSDC) / 1e6).toFixed(2)} USDT
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          router.push(`/freelancer/jobs/${job.jobId}`)
                        }
                        className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        View Job
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hired Jobs */}
            <div className="rounded-2xl p-5 glass-effect border border-border shadow-md">
              <h3 className="text-lg font-semibold mb-3">Hired Jobs</h3>
              {hiredJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No jobs have been accepted yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {hiredJobs.map((job) => (
                    <div
                      key={job.jobId}
                      className="border border-border/60 rounded-xl p-3 flex flex-col gap-2"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-semibold text-sm line-clamp-2">
                            {job.title}
                          </h4>
                          <p className="text-xs text-green-500 font-medium">
                            Hired • Job #{job.jobId}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Client: {job.client.slice(0, 6)}...
                            {job.client.slice(-4)}
                          </p>
                        </div>
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400">
                          {(Number(job.budgetUSDC) / 1e6).toFixed(2)} USDT
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          router.push(`/freelancer/jobs/${job.jobId}`)
                        }
                        className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        View Job Details
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
