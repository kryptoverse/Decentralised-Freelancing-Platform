"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { Wallet, FileText, Plus, Briefcase } from "lucide-react";
import { getWalletBalance } from "thirdweb/wallets";
import { polygonAmoy } from "thirdweb/chains";
import { client } from "@/lib/thirdweb-client";
import { useEffect, useState } from "react";
import { PostJobForm } from "@/components/client/post-job-form";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { getContract, readContract } from "thirdweb";
import { CHAIN } from "@/lib/chains";
import { useClientEvents } from "@/contexts/ClientEventsContext";
import { WorkDeliveredToast } from "@/components/notifications/WorkDeliveredToast";
import { batchReadSameContract } from "@/lib/batch-reads";

/* --------------------------------------------------
    HELPER: Create slug like "2-unreal-engine-dev"
-------------------------------------------------- */
function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function ClientHome() {
  const router = useRouter();
  const account = useActiveAccount();

  // Smart Wallet (4337)
  const ZERO = "0x0000000000000000000000000000000000000000";

  const smartAddress: `0x${string}` =
    (account?.address as `0x${string}`) || ZERO;


  const [balance, setBalance] = useState<{ displayValue: string; symbol: string } | null>(
    null
  );
  const [usdtBalance, setUsdtBalance] = useState<string | null>(null);

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

  // Work delivery notification
  const [showWorkToast, setShowWorkToast] = useState(false);
  const [workDeliveryInfo, setWorkDeliveryInfo] = useState<{ jobId: string; jobTitle: string } | null>(null);

  // Get events from context
  const { latestJobPosted, latestWorkDelivered } = useClientEvents();

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
          params: [smartAddress],
        });

        if (
          !profileAddr ||
          profileAddr === ZERO
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
          readContract({
            contract: p,
            method: "function name() view returns (string)",
          }),
          readContract({
            contract: p,
            method: "function bio() view returns (string)",
          }),
          readContract({
            contract: p,
            method: "function totalJobsPosted() view returns (uint256)",
          }),
          readContract({
            contract: p,
            method: "function totalJobsCompleted() view returns (uint256)",
          }),
        ]);

        setProfile({
          name: name as string,
          bio: bio as string,
          totalJobsPosted: Number(posted),
          totalJobsCompleted: Number(completed),
        });
      } catch (err) {
        console.error("❌ Error loading profile:", err);
      }
    }

    fetchProfile();
  }, [account, smartAddress]);

  /* ------------------------------------
      LOAD JOBS POSTED BY CLIENT
  ------------------------------------ */
  // Extract loadJobs function for reuse
  const loadJobs = async () => {
    if (!account) return;

    try {
      const jobBoard = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.JobBoard,
      });

      const jobIds = (await readContract({
        contract: jobBoard,
        method: "function jobsByClient(address) view returns (uint256[])",
        params: [smartAddress],
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

          const rawCount = await readContract({
            contract: jobBoard,
            method: "function getApplicantCount(uint256) view returns (uint256)",
            params: [id],
          });

          const [freelancers] = (await readContract({
            contract: jobBoard,
            method:
              "function getApplicants(uint256,uint256,uint256) view returns (address[],uint64[])",
            params: [id, 0n, BigInt(rawCount as bigint)],
          })) as [string[], bigint[]];

          const realCount = freelancers.filter(
            (a) => a !== ZERO
          ).length;

          return {
            id: Number(id),
            title: res[1],
            status: Number(res[4]),
            budgetUSDC: Number(res[3]),
            expiresAt: Number(res[9]),
            applicants: realCount,
          };
        })
      );

      setJobs(fullJobs);
    } catch (e) {
      console.error("❌ Error loading jobs:", e);
    }
  };

  useEffect(() => {
    loadJobs();
  }, [account, smartAddress]);

  /* ------------------------------------
      INCREMENTAL JOB FETCH (for new jobs)
  ------------------------------------ */
  const fetchSingleJob = async (jobId: bigint) => {
    try {
      const jobBoard = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.JobBoard,
      });

      const res = await readContract({
        contract: jobBoard,
        method:
          "function getJob(uint256) view returns (address,string,string,uint256,uint8,address,address,uint64,uint64,uint64,bytes32[],uint256)",
        params: [jobId],
      });

      const rawCount = await readContract({
        contract: jobBoard,
        method: "function getApplicantCount(uint256) view returns (uint256)",
        params: [jobId],
      });

      const [freelancers] = await readContract({
        contract: jobBoard,
        method:
          "function getApplicants(uint256,uint256,uint256) view returns (address[],uint64[])",
        params: [jobId, 0n, BigInt(rawCount as bigint)],
      }) as [string[], bigint[]];

      const realCount = freelancers.filter(
        (a) => a !== ZERO
      ).length;

      const newJob = {
        id: Number(jobId),
        title: (res as any)[1],
        status: Number((res as any)[4]),
        budgetUSDC: Number((res as any)[3]),
        expiresAt: Number((res as any)[9]),
        applicants: realCount,
      };

      // Add to jobs array if not already present
      setJobs(prev => {
        const exists = prev.some(j => j.id === newJob.id);
        if (exists) return prev;
        return [newJob, ...prev];
      });

      console.log("✅ Added new job to list incrementally:", newJob);
    } catch (e) {
      console.error("❌ Error fetching single job:", e);
    }
  };

  /* ------------------------------------
      REAL-TIME EVENT: Job Posted
  ------------------------------------ */
  useEffect(() => {
    if (!latestJobPosted || !account) return;

    // Check if this is MY job (I posted it)
    if (latestJobPosted.client.toLowerCase() === smartAddress.toLowerCase()) {
      console.log("📝 Dashboard: New job posted, adding incrementally...");
      fetchSingleJob(BigInt(latestJobPosted.jobId));
    }
  }, [latestJobPosted, account, smartAddress]);

  /* ------------------------------------
      WORK DELIVERY NOTIFICATION
  ------------------------------------ */
  useEffect(() => {
    if (!latestWorkDelivered) return;

    // Find the job from our jobs list that matches
    const matchedJob = jobs.find(j => {
      // Since we don't have escrow-to-jobId mapping easily here,
      // we'll need to enhance this. For now, show generic notification
      return true; // TODO: Match by escrow address
    });

    if (matchedJob) {
      setWorkDeliveryInfo({
        jobId: matchedJob.id.toString(),
        jobTitle: matchedJob.title,
      });
      setShowWorkToast(true);

      // Auto-hide after 10 seconds
      setTimeout(() => setShowWorkToast(false), 10000);
    }
  }, [latestWorkDelivered, jobs]);

  /* ------------------------------------
      NATIVE WALLET BALANCE (MATIC)
  ------------------------------------ */
  useEffect(() => {
    if (smartAddress.startsWith("0x0000")) return;

    async function fetchBalance() {
      try {
        setLoading(true);

        const result = await getWalletBalance({
          client,
          chain: polygonAmoy,
          address: smartAddress,
        });

        // Format to 3 decimal places
        const numericValue = parseFloat(result.displayValue);
        const formattedValue = numericValue.toFixed(3);

        setBalance({ displayValue: formattedValue, symbol: result.symbol });
      } catch (err) {
        console.error("❌ balance error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchBalance();
  }, [smartAddress]);

  /* ------------------------------------
      MOCK USDT BALANCE (ERC20)
  ------------------------------------ */
  useEffect(() => {
    if (smartAddress.startsWith("0x0000")) return;

    async function fetchUSDTBalance() {
      try {
        const usdt = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.MockUSDT,
        });

        const raw = await readContract({
          contract: usdt,
          method: "function balanceOf(address) view returns (uint256)",
          params: [smartAddress],
        });

        const decimals = await readContract({
          contract: usdt,
          method: "function decimals() view returns (uint8)",
        });

        const formatted =
          Number(raw as bigint) / 10 ** Number(decimals);

        setUsdtBalance(formatted.toFixed(3));
      } catch (err) {
        console.error("❌ USDT balance error:", err);
        setUsdtBalance(null);
      }
    }

    fetchUSDTBalance();
  }, [smartAddress]);

  /* ------------------------------------
      FILTER JOBS BY STATUS
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

  /* ------------------------------------
      RENDER
  ------------------------------------ */
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
            onClick={async () => {
              // Check profile before opening modal
              if (!smartAddress || smartAddress.startsWith("0x0000")) return;

              try {
                const factory = getContract({
                  client,
                  chain: CHAIN,
                  address: DEPLOYED_CONTRACTS.addresses.ClientFactory,
                });

                const profileAddr = await readContract({
                  contract: factory,
                  method: "function clientProfiles(address) view returns (address)",
                  params: [smartAddress],
                });

                const ZERO = "0x0000000000000000000000000000000000000000";
                if (!profileAddr || profileAddr === ZERO) {
                  // Show profile required modal
                  const shouldCreate = window.confirm(
                    "You need to create a client profile before posting jobs. Would you like to create one now?"
                  );
                  if (shouldCreate) {
                    router.push("/client/profile/create");
                  }
                  return;
                }

                setShowPostJob(true);
              } catch (err) {
                console.error("Error checking profile:", err);
                // Still allow opening modal, but form will check again
                setShowPostJob(true);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Post Job
          </button>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
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
              label: "MATIC Balance",
              value: balance
                ? `${balance.displayValue} ${balance.symbol}`
                : loading
                  ? "Fetching..."
                  : "0",
            },
            {
              icon: Wallet,
              label: "USDT Balance",
              value:
                usdtBalance !== null
                  ? `${usdtBalance} USDT`
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

        {/* JOB LIST */}
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
                className={`pb-2 text-sm font-medium ${selectedTab === t.id
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Job Grid */}
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
                  onClick={() => {
                    const slug = slugify(job.title);
                    router.push(`/client/jobs/${job.id}-${slug}`);
                  }}
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

      {/* WORK DELIVERED NOTIFICATION */}
      {workDeliveryInfo && (
        <WorkDeliveredToast
          jobId={workDeliveryInfo.jobId}
          jobTitle={workDeliveryInfo.jobTitle}
          visible={showWorkToast}
          onDismiss={() => setShowWorkToast(false)}
        />
      )}
    </>
  );
}
