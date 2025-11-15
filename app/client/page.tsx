"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { Wallet, Users, FileText, Plus, Briefcase } from "lucide-react";
import { getWalletBalance } from "thirdweb/wallets";
import { polygonAmoy } from "thirdweb/chains";
import { client } from "@/lib/thirdweb-client";
import { useEffect, useState } from "react";
import { PostJobForm } from "@/components/client/post-job-form";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { getContract, readContract } from "thirdweb";
import { CHAIN } from "@/lib/chains";

export default function ClientHome() {
  const router = useRouter();
  const account = useActiveAccount();

  const safeAddress =
    typeof account?.address === "string"
      ? (account.address as `0x${string}`)
      : ("0x0000000000000000000000000000000000000000" as `0x${string}`);

  const [balance, setBalance] = useState<{ displayValue: string; symbol: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPostJob, setShowPostJob] = useState(false);

  const [profile, setProfile] = useState<{
    name: string;
    bio: string;
    totalJobsPosted: number;
    totalJobsCompleted: number;
  } | null>(null);

  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedTab, setSelectedTab] = useState("open");

  /* ------------------------------------
      LOAD CLIENT PROFILE
  ------------------------------------ */
  useEffect(() => {
    if (!account) return;

    async function fetchProfile() {
      try {
        const factory = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.ClientFactory,
        });

        const profileAddr = await readContract({
          contract: factory,
          method: "function clientProfiles(address) view returns (address)",
          params: [safeAddress],
        });

        if (
          !profileAddr ||
          profileAddr === "0x0000000000000000000000000000000000000000"
        ) {
          setProfile(null);
          return;
        }

        const p = getContract({
          client,
          chain: CHAIN,
          address: profileAddr as `0x${string}`,
        });

        const [name, bio, posted, completed] = await Promise.all([
          readContract({ contract: p, method: "function name() view returns (string)" }),
          readContract({ contract: p, method: "function bio() view returns (string)" }),
          readContract({ contract: p, method: "function totalJobsPosted() view returns (uint256)" }),
          readContract({ contract: p, method: "function totalJobsCompleted() view returns (uint256)" }),
        ]);

        setProfile({
          name,
          bio,
          totalJobsPosted: Number(posted),
          totalJobsCompleted: Number(completed),
        });
      } catch (err) {
        console.error("❌ Error loading profile:", err);
      }
    }

    fetchProfile();
  }, [account]);

  /* ------------------------------------
      LOAD JOBS POSTED BY CLIENT
  ------------------------------------ */
  useEffect(() => {
    if (!account) return;

    async function loadJobs() {
      try {
        const jobBoard = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.JobBoard,
        });

        // IMPORTANT: Correct function name is jobsByClient(address)
        const jobIds = (await readContract({
          contract: jobBoard,
          method: "function jobsByClient(address) view returns (uint256[])",
          params: [safeAddress],
        })) as bigint[];

        if (!jobIds || jobIds.length === 0) {
          setJobs([]);
          return;
        }

        const fullJobs = await Promise.all(
          jobIds.map(async (id: bigint) => {
            const res = (await readContract({
              contract: jobBoard,
              method:
                "function getJob(uint256) view returns (address,string,string,uint256,uint8,address,address,uint64,uint64,uint64,bytes32[],uint256)",
              params: [id],
            })) as any;

            const applicantCount = await readContract({
              contract: jobBoard,
              method: "function getApplicantCount(uint256) view returns (uint256)",
              params: [id],
            });

            return {
              id: Number(id),
              title: res[1],
              status: Number(res[4]),
              budgetUSDC: Number(res[3]),
              expiresAt: Number(res[9]),
              applicants: Number(applicantCount),
            };
          })
        );

        setJobs(fullJobs);
      } catch (e) {
        console.error("❌ Error loading jobs:", e);
      }
    }

    loadJobs();
  }, [account]);

  /* ------------------------------------
      WALLET BALANCE 
  ------------------------------------ */
  useEffect(() => {
    if (safeAddress.startsWith("0x0000")) return;

    async function fetchBalance() {
      try {
        setLoading(true);

        const result = await getWalletBalance({
          client,
          chain: polygonAmoy,
          address: safeAddress,
        });

        setBalance({ displayValue: result.displayValue, symbol: result.symbol });
      } catch (err) {
        console.error("❌ balance error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchBalance();
  }, [safeAddress]);

  /* ------------------------------------
      FILTER JOBS BY STATUS TABS
  ------------------------------------ */
  const filtered = jobs.filter((job) => {
    switch (selectedTab) {
      case "open":
        return job.status === 1;
      case "hired":
        return job.status === 2;
      case "completed":
        return job.status === 4;
      case "cancelled":
        return job.status === 3 || job.status === 5;
      default:
        return true;
    }
  });

  // ========= RENDER =========

  if (!account)
    return <div className="p-8">Please connect your wallet to continue.</div>;

  return (
    <>
      <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto space-y-12">

        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="w-full sm:w-auto">
            <h1 className="text-3xl font-bold break-words">
              {profile ? `Welcome, ${profile.name} 👋` : "Welcome, Client 👋"}
            </h1>

            <p className="text-muted-foreground mt-1 max-w-md break-words">
              {profile?.bio || "Complete your profile to unlock all features."}
            </p>
          </div>

          <button
            onClick={() => setShowPostJob(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Post Job
          </button>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {[
            {
              icon: Briefcase,
              label: "Jobs Posted",
              value: profile?.totalJobsPosted ?? "—",
            },
            {
              icon: FileText,
              label: "Completed Jobs",
              value: profile?.totalJobsCompleted ?? "—",
            },
            {
              icon: Wallet,
              label: "Wallet Balance",
              value: balance
                ? `${balance.displayValue} ${balance.symbol}`
                : "Fetching...",
            },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="p-6 rounded-2xl glass-effect border shadow-md flex items-center justify-between"
            >
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <h2 className="text-2xl font-semibold">{stat.value}</h2>
              </div>
              <stat.icon className="w-6 h-6 text-primary" />
            </motion.div>
          ))}
        </div>

        {/* JOBS POSTED SECTION */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold">Your Jobs</h2>

          {/* Tabs */}
          <div className="flex overflow-x-auto gap-4 border-b pb-2 scrollbar-hide">
            {[
              { id: "open", label: "Open" },
              { id: "hired", label: "In Progress" },
              { id: "completed", label: "Completed" },
              { id: "cancelled", label: "Cancelled / Expired" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTab(t.id)}
                className={`pb-2 text-sm font-medium whitespace-nowrap ${
                  selectedTab === t.id
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Job List */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {filtered.length === 0 && (
              <p className="text-muted-foreground text-sm">No jobs found.</p>
            )}

            {filtered.map((job, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="border rounded-xl p-6 glass-effect flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold break-words">{job.title}</h3>

                  <p className="text-muted-foreground text-sm">
                    Applicants: {job.applicants}
                  </p>

                  <p className="text-muted-foreground text-sm">
                    Budget: {(job.budgetUSDC / 1e6).toFixed(2)} USDT
                  </p>
                </div>

                <button
                  onClick={() => router.push(`/client/jobs/${job.id}`)}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 w-full sm:w-auto"
                >
                  View Analytics
                </button>
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      {/* POST JOB MODAL */}
      {showPostJob && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <PostJobForm
              onJobPosted={() => setShowPostJob(false)}
              onCancel={() => setShowPostJob(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
