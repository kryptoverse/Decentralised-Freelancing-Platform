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
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { getContract, readContract } from "thirdweb";
import { getWalletBalance } from "thirdweb/wallets";
import { polygonAmoy } from "thirdweb/chains";
import { client } from "@/lib/thirdweb";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { CHAIN } from "@/lib/chains";
import { ipfsToHttp } from "@/utils/ipfs";
import { useClientEvents } from "@/contexts/ClientEventsContext";
import { RefreshButton } from "@/components/ui/refresh-button";
import { PaymentReceivedToast } from "@/components/notifications/PaymentReceivedToast";

/* ============================================================
   TYPES
============================================================ */
interface JobDetails {
  id: string;
  title: string;
  clientName: string;
  budget: number;
  status: number;
  statusLabel: string;
  createdAt: number;
  appliedAt?: number;
  deliveryDue?: number;
  escrowAddr?: string;
  delivered?: boolean;
}

const JOB_STATUS = {
  0: "Unknown",
  1: "Open",
  2: "Hired",
  3: "Cancelled",
  4: "Completed",
  5: "Expired",
} as const;

const STATUS_COLORS = {
  Open: "bg-amber-500/10 text-amber-400 border-amber-600/30",
  Hired: "bg-emerald-500/10 text-emerald-400 border-emerald-600/30",
  Completed: "bg-blue-500/10 text-blue-400 border-blue-600/30",
  Cancelled: "bg-red-500/10 text-red-400 border-red-600/30",
  Expired: "bg-slate-500/10 text-slate-400 border-slate-600/30",
  Unknown: "bg-gray-500/10 text-gray-400 border-gray-600/30",
} as const;

export default function FreelancerHome() {
  const router = useRouter();
  const account = useActiveAccount();

  const [balance, setBalance] = useState<{ displayValue: string; symbol: string } | null>(null);
  const [usdtBalance, setUsdtBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    totalEarnings: 0,
    completedJobs: 0,
    rating: 0,
    isKYCVerified: false,
    level: 1,
    stars: 1,
  });

  // Job lists
  const [appliedJobs, setAppliedJobs] = useState<JobDetails[]>([]);
  const [hiredJobs, setHiredJobs] = useState<JobDetails[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  // Payment notification
  const [showPaymentToast, setShowPaymentToast] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<{ jobTitle: string; amount: string } | null>(null);

  // Get events from context
  const { latestPayment } = useClientEvents();

  // ===== Fetch Wallet Balance (Manual Refresh Only) =====
  const fetchBalance = async () => {
    if (!account?.address) return;

    try {
      setLoading(true);
      const result = await getWalletBalance({
        client,
        chain: polygonAmoy,
        address: account.address,
      });

      const numericValue = parseFloat(result.displayValue);
      const formattedValue = numericValue.toFixed(3);

      setBalance({ displayValue: formattedValue, symbol: result.symbol });
    } catch (err) {
      console.error("Balance fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // Initial balance fetch on mount
  useEffect(() => {
    fetchBalance();
  }, [account?.address]);

  // ===== Fetch USDT Balance (Manual Refresh Only) =====
  const fetchUSDTBalance = async () => {
    if (!account?.address) return;

    try {
      const usdt = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.MockUSDT,
      });

      const raw = await readContract({
        contract: usdt,
        method: "function balanceOf(address) view returns (uint256)",
        params: [account.address],
      });

      const decimals = await readContract({
        contract: usdt,
        method: "function decimals() view returns (uint8)",
      });

      const formatted = Number(raw as bigint) / 10 ** Number(decimals);
      setUsdtBalance(formatted.toFixed(3));
    } catch (err) {
      console.error("❌ USDT balance error:", err);
      setUsdtBalance(null);
    }
  };

  // Initial USDT balance fetch on mount
  useEffect(() => {
    fetchUSDTBalance();
  }, [account?.address]);

  // ===== Auto-Refresh on Payment Received =====
  useEffect(() => {
    if (!latestPayment || !account?.address) return;

    // Check if payment is for this freelancer
    if (latestPayment.to.toLowerCase() === account.address.toLowerCase()) {
      console.log("💰 Payment received! Auto-refreshing balances...");

      // Refresh balances
      fetchBalance();
      fetchUSDTBalance();

      // Show payment notification
      setPaymentInfo({
        jobTitle: "Job Completed", // We can enhance this by fetching job title
        amount: latestPayment.amount,
      });
      setShowPaymentToast(true);

      // Auto-hide toast after 8 seconds
      setTimeout(() => setShowPaymentToast(false), 8000);
    }
  }, [latestPayment, account?.address]);

  // ===== Fetch Profile Data =====
  useEffect(() => {
    if (!account?.address) return;

    const loadProfile = async () => {
      try {
        console.log("🔍 Loading freelancer data for:", account.address);

        const factory = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory,
        });

        const profileAddr = await readContract({
          contract: factory as any,
          method: `function freelancerProfile(address) view returns (address)`,
          params: [account.address],
        });

        if (
          !profileAddr ||
          profileAddr === "0x0000000000000000000000000000000000000000"
        ) {
          console.warn("No profile found for this wallet.");
          return;
        }

        console.log("✅ Profile found at:", profileAddr);

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
            console.warn("⚠️ Missing field:", method);
            return null;
          }
        };

        const [name, bio, totalEarnings, completedJobs, rating, isKYCVerified] =
          await Promise.all([
            safeRead(`function name() view returns (string)`),
            safeRead(`function bio() view returns (string)`),
            safeRead(`function totalEarnings() view returns (uint256)`),
            safeRead(`function completedJobs() view returns (uint256)`),
            safeRead(`function rating() view returns (uint256)`),
            safeRead(`function isKYCVerified() view returns (bool)`),
          ]);

        const completed = Number(completedJobs || 0);
        let level = 1;
        let stars = 1;
        if (completed >= 3 && completed < 6) {
          level = 2;
          stars = 2;
        } else if (completed >= 6 && completed < 11) {
          level = 3;
          stars = 3;
        } else if (completed >= 11 && completed < 21) {
          level = 4;
          stars = 4;
        } else if (completed >= 21) {
          level = 5;
          stars = 5;
        }

        setProfile({
          name: name || "Unnamed",
          bio: bio || "No bio yet",
          profileAddress: profileAddr,
        });

        setStats({
          totalEarnings: Number(totalEarnings || 0) / 1e18,
          completedJobs: completed,
          rating: Number(rating || 0),
          isKYCVerified: Boolean(isKYCVerified),
          level,
          stars,
        });
      } catch (err) {
        console.error("❌ Failed to load profile data:", err);
      }
    };

    loadProfile();
  }, [account?.address]);

  // ===== Fetch Applied & Hired Jobs =====
  useEffect(() => {
    if (!account?.address) return;

    const loadJobs = async () => {
      try {
        setJobsLoading(true);

        const jobBoard = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.JobBoard,
        });

        const clientFactory = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.ClientFactory,
        });

        // 1. Get all jobs I applied to
        const appliedJobIds = (await readContract({
          contract: jobBoard,
          method: "function getJobsAppliedBy(address) view returns (uint256[])",
          params: [account.address],
        })) as bigint[];

        if (appliedJobIds.length === 0) {
          setAppliedJobs([]);
          setHiredJobs([]);
          return;
        }

        // 2. Fetch details for each job
        const jobDetails: JobDetails[] = [];
        const hiredJobDetails: JobDetails[] = [];

        for (const jobId of appliedJobIds) {
          try {
            // Get job data
            const jobData = await readContract({
              contract: jobBoard,
              method:
                "function getJob(uint256) view returns (address,string,string,uint256,uint8,address,address,uint64,uint64,uint64,bytes32[],uint256)",
              params: [jobId],
            });

            const [
              clientAddr,
              title,
              descUri,
              budget,
              status,
              hiredFreelancer,
              escrow,
              createdAt,
            ] = jobData as any;

            // Get client name
            let clientName = "Unknown Client";
            try {
              const clientProfileAddr = await readContract({
                contract: clientFactory,
                method: "function getProfile(address) view returns (address)",
                params: [clientAddr],
              });

              if (
                clientProfileAddr &&
                clientProfileAddr !== "0x0000000000000000000000000000000000000000"
              ) {
                const clientProfile = getContract({
                  client,
                  chain: CHAIN,
                  address: clientProfileAddr as `0x${string}`,
                });

                const name = await readContract({
                  contract: clientProfile,
                  method: "function name() view returns (string)",
                });

                clientName = name as string;
              }
            } catch { }

            // Get application date
            let appliedAt = 0;
            try {
              const applicantDetails = await readContract({
                contract: jobBoard,
                method:
                  "function getApplicantDetails(uint256,address) view returns (address,uint64,string,uint256,uint64)",
                params: [jobId, account.address],
              });

              appliedAt = Number((applicantDetails as any)[1]);
            } catch { }

            const job: JobDetails = {
              id: jobId.toString(),
              title,
              clientName,
              budget: Number(budget) / 1e6,
              status: Number(status),
              statusLabel: JOB_STATUS[Number(status) as keyof typeof JOB_STATUS],
              createdAt: Number(createdAt),
              appliedAt,
            };

            jobDetails.push(job);

            // If I was hired, add to hired jobs list
            if (
              Number(status) === 2 &&
              hiredFreelancer.toLowerCase() === account.address.toLowerCase()
            ) {
              // Get escrow timeline
              let deliveryDue = 0;
              let delivered = false;

              if (escrow && escrow !== "0x0000000000000000000000000000000000000000") {
                try {
                  const escrowContract = getContract({
                    client,
                    chain: CHAIN,
                    address: escrow as `0x${string}`,
                  });

                  const [, deliveryDueTs] = await readContract({
                    contract: escrowContract,
                    method: "function currentDeadlines() view returns (uint64,uint64,uint64)",
                  });

                  deliveryDue = Number(deliveryDueTs);

                  delivered = await readContract({
                    contract: escrowContract,
                    method: "function delivered() view returns (bool)",
                  }) as boolean;
                } catch { }
              }

              hiredJobDetails.push({
                ...job,
                escrowAddr: escrow,
                deliveryDue,
                delivered,
              });
            }
          } catch (err) {
            console.error(`Error loading job #${jobId}:`, err);
          }
        }

        setAppliedJobs(jobDetails);
        setHiredJobs(hiredJobDetails);
      } catch (err) {
        console.error("❌ Error loading jobs:", err);
      } finally {
        setJobsLoading(false);
      }
    };

    loadJobs();
  }, [account?.address]);

  // ===== Guard =====
  if (!account) {
    return <div className="p-8">Please connect your wallet to view dashboard.</div>;
  }

  // ===== UI =====
  return (
    <main className="flex-1 p-8 overflow-y-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome Back, {profile?.name || "Freelancer"} 👋
          </h1>
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            {stats.isKYCVerified ? (
              <span className="flex items-center gap-1 text-green-500">
                <ShieldCheck className="w-4 h-4" /> KYC Verified
              </span>
            ) : (
              <span className="text-yellow-400">KYC Pending</span>
            )}
            <span className="ml-4">Level {stats.level}</span>
            <span className="flex ml-1">
              {Array.from({ length: stats.stars }).map((_, i) => (
                <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              ))}
            </span>
          </div>
        </div>

        <button
          onClick={() => router.push("/freelancer/Profile")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition"
        >
          <User className="w-4 h-4" />
          <span>Profile</span>
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            icon: DollarSign,
            label: "Total Earnings",
            value: `${stats.totalEarnings.toFixed(2)} USDT`,
          },
          { icon: Briefcase, label: "Completed Jobs", value: stats.completedJobs.toString() },
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
            className="p-6 rounded-2xl glass-effect border border-border shadow-md flex items-center justify-between"
          >
            <div>
              <p className="text-sm text-foreground-secondary">{stat.label}</p>
              <h2 className="text-2xl font-semibold">{stat.value}</h2>
            </div>
            <stat.icon className="w-6 h-6 text-primary" />
          </motion.div>
        ))}
      </div>

      {/* Wallet Balances */}
      <div className="grid md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl p-6 glass-effect border border-border shadow-md"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              MATIC Balance
            </h2>
            <RefreshButton onRefresh={fetchBalance} size="sm" label="" />
          </div>
          {loading ? (
            <p className="text-foreground-secondary">Fetching balance…</p>
          ) : balance ? (
            <p className="text-3xl font-bold text-primary">
              {balance.displayValue} {balance.symbol}
            </p>
          ) : (
            <p className="text-foreground-secondary">
              {account?.address
                ? "0 POL or failed to load balance"
                : "Connect your wallet"}
            </p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-2xl p-6 glass-effect border border-border shadow-md"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              USDT Balance
            </h2>
            <RefreshButton onRefresh={fetchUSDTBalance} size="sm" label="" />
          </div>
          {usdtBalance !== null ? (
            <p className="text-3xl font-bold text-primary">
              {usdtBalance} USDT
            </p>
          ) : (
            <p className="text-foreground-secondary">Fetching...</p>
          )}
        </motion.div>
      </div>

      {/* Active Jobs (Hired) */}
      {hiredJobs.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-4"
        >
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            Active Jobs ({hiredJobs.length})
          </h2>

          <div className="grid gap-4">
            {hiredJobs.map((job, idx) => (
              <HiredJobCard key={idx} job={job} onClick={() => router.push(`/freelancer/jobs/${job.id}`)} />
            ))}
          </div>
        </motion.section>
      )}

      {/* Applied Jobs */}
      <motion.section
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="space-y-4"
      >
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" />
          My Applications ({appliedJobs.length})
        </h2>

        {jobsLoading ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : appliedJobs.length === 0 ? (
          <div className="p-8 text-center border rounded-2xl bg-surface-secondary">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No job applications yet.</p>
            <button
              onClick={() => router.push("/freelancer/FindWork")}
              className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90"
            >
              Find Work
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {appliedJobs.map((job, idx) => (
              <AppliedJobCard key={idx} job={job} onClick={() => router.push(`/freelancer/FindWork/${job.id}`)} />
            ))}
          </div>
        )}
      </motion.section>

      {/* Payment Notification Toast */}
      {paymentInfo && (
        <PaymentReceivedToast
          jobTitle={paymentInfo.jobTitle}
          amount={paymentInfo.amount}
          visible={showPaymentToast}
          onDismiss={() => setShowPaymentToast(false)}
        />
      )}
    </main>
  );
}

/* ============================================================
   JOB CARD COMPONENTS
============================================================ */
function AppliedJobCard({ job, onClick }: { job: JobDetails; onClick: () => void }) {
  const statusColor = STATUS_COLORS[job.statusLabel as keyof typeof STATUS_COLORS] || STATUS_COLORS.Unknown;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border rounded-xl p-6 glass-effect hover:border-primary/50 transition cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold break-words">{job.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">Client: {job.clientName}</p>

          <div className="flex flex-wrap gap-3 mt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <DollarSign className="w-4 h-4" />
              {job.budget.toFixed(2)} USDT
            </span>
            {job.appliedAt && job.appliedAt > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Applied: {new Date(job.appliedAt * 1000).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <span className={`px-3 py-1 text-xs border rounded-full whitespace-nowrap ${statusColor}`}>
          {job.statusLabel}
        </span>
      </div>
    </motion.div>
  );
}

function HiredJobCard({ job, onClick }: { job: JobDetails; onClick: () => void }) {
  const now = Math.floor(Date.now() / 1000);
  const isOverdue = job.deliveryDue && job.deliveryDue > 0 && job.deliveryDue < now && !job.delivered;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border rounded-xl p-6 glass-effect bg-emerald-500/5 hover:border-emerald-400/50 transition cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold break-words flex items-center gap-2">
            {job.title}
            {job.delivered && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Client: {job.clientName}</p>

          <div className="flex flex-wrap gap-3 mt-3 text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <DollarSign className="w-4 h-4" />
              {job.budget.toFixed(2)} USDT
            </span>

            {job.deliveryDue && job.deliveryDue > 0 && (
              <span className={`flex items-center gap-1 ${isOverdue ? "text-red-400" : "text-muted-foreground"}`}>
                <Clock className="w-4 h-4" />
                Due: {new Date(job.deliveryDue * 1000).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {job.delivered ? (
            <span className="px-3 py-1 text-xs border rounded-full bg-blue-500/10 text-blue-400 border-blue-600/30">
              Delivered
            </span>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90"
            >
              Submit Work
            </button>
          )}

          {isOverdue && !job.delivered && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <AlertCircle className="w-3 h-3" />
              Overdue
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
