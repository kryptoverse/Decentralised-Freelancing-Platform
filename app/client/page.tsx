"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { Wallet, FileText, Plus, Briefcase, Copy, CheckCheck, RefreshCw, ArrowRight } from "lucide-react";
import { getWalletBalance } from "thirdweb/wallets";
import { polygonAmoy } from "thirdweb/chains";
import { client } from "@/lib/thirdweb-client";
import { useEffect, useState } from "react";
import { PostJobForm } from "@/components/client/post-job-form";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { getContract, readContract } from "thirdweb";
import { CHAIN } from "@/lib/chains";
import { useChatContext, defaultContext } from "@/components/chat/ChatContext";

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
  const { setChatContext } = useChatContext();

  // Smart Wallet (4337)
  const ZERO = "0x0000000000000000000000000000000000000000";

  const smartAddress: `0x${string}` =
    (account?.address as `0x${string}`) || ZERO;

  const eoaAddress: `0x${string}` =
    ((account as any)?.walletAddress as `0x${string}`) || ZERO;

  const [copied, setCopied] = useState(false);

  const [balance, setBalance] = useState<{ displayValue: string; symbol: string } | null>(
    null
  );
  const [usdtBalance, setUsdtBalance] = useState<string | null>(null);

  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [showPostJob, setShowPostJob] = useState(false);
  const [showProfilePrompt, setShowProfilePrompt] = useState(false);

  const [profile, setProfile] = useState<{
    name: string;
    bio: string;
    totalJobsPosted: number;
    totalJobsCompleted: number;
  } | null>(null);

  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedTab, setSelectedTab] = useState("open");

  // Faucet state
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetMessage, setFaucetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);


  /* ------------------------------------
      DATA FETCHING FUNCTIONS
  ------------------------------------ */
  const fetchProfile = async () => {
    if (!account || !smartAddress || smartAddress.startsWith("0x0000")) return;
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

      if (!profileAddr || profileAddr === ZERO) {
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
  };

  const loadJobs = async () => {
    if (!account || !smartAddress || smartAddress.startsWith("0x0000")) return;
    try {
      setLoadingJobs(true);
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
        setLoadingJobs(false);
        return;
      }

      // Sort jobIds in descending order to show newest first
      const sortedIds = [...jobIds].reverse();

      const fullJobs = await Promise.all(
        sortedIds.map(async (id: bigint) => {
          try {
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

            // Get applicants safely
            let realCount = 0;
            if (Number(rawCount) > 0) {
              try {
                const [freelancers] = (await readContract({
                  contract: jobBoard,
                  method:
                    "function getApplicants(uint256,uint256,uint256) view returns (address[],uint64[])",
                  params: [id, 0n, BigInt(rawCount as bigint)],
                })) as [string[], bigint[]];

                realCount = freelancers.filter((a) => a !== ZERO).length;
              } catch (err) {
                console.log(`No applicants for job ${id}`);
              }
            }

            let jobStatus = Number(res[4]);
            const escrowAddress = res[6];

            // For hired jobs, check if escrow is terminal (completed or cancelled)
            if (jobStatus === 2 && escrowAddress && escrowAddress !== ZERO) {
              try {
                const escrow = getContract({
                  client,
                  chain: CHAIN,
                  address: escrowAddress as `0x${string}`,
                });

                const [terminalRaw, cancelReqBy, disputed, delivered] = await Promise.all([
                  readContract({ contract: escrow, method: "function terminal() view returns (bool)" }),
                  readContract({ contract: escrow, method: "function cancelRequestedBy() view returns (address)" }).catch(() => ZERO),
                  readContract({ contract: escrow, method: "function disputed() view returns (bool)" }).catch(() => false),
                  readContract({ contract: escrow, method: "function delivered() view returns (bool)" }).catch(() => false)
                ]);

                if (terminalRaw) {
                  if (disputed) {
                    const [escrowBal] = await readContract({
                      contract: getContract({ client, chain: CHAIN, address: DEPLOYED_CONTRACTS.addresses.MockUSDT }),
                      method: "function balanceOf(address) view returns (uint256)",
                      params: [escrowAddress as `0x${string}`],
                    }).then(v => [v]).catch(() => [0n]);

                    if (BigInt(escrowBal as any) === 0n) {
                      jobStatus = delivered ? 4 : 3;
                    } else {
                      jobStatus = 4;
                    }
                  } else {
                    jobStatus = String(cancelReqBy) !== ZERO ? 3 : 4;
                  }
                }
              } catch (err) {
                console.log("Could not check escrow status:", err);
              }
            }

            return {
              id: Number(id),
              title: res[1],
              status: jobStatus,
              budgetUSDC: Number(res[3]),
              hiredFreelancer: res[5],
              expiresAt: Number(res[9]),
              applicants: realCount,
            };
          } catch (e) {
            console.error(`Failed to load job ${id}`, e);
            return null;
          }
        })
      );

      setJobs(fullJobs.filter(j => j !== null));
    } catch (e) {
      console.error("❌ Error loading jobs:", e);
    } finally {
      setLoadingJobs(false);
    }
  };

  const fetchBalance = async () => {
    if (!smartAddress || smartAddress.startsWith("0x0000")) return;
    try {
      const result = await getWalletBalance({
        client,
        chain: polygonAmoy,
        address: smartAddress,
      });

      setBalance({ displayValue: result.displayValue, symbol: result.symbol });
    } catch (err) {
      console.error("❌ balance error:", err);
    }
  };

  const fetchUSDTBalance = async () => {
    if (!smartAddress || smartAddress.startsWith("0x0000")) return;
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

      setUsdtBalance(formatted.toFixed(2));
    } catch (err) {
      console.error("❌ USDT balance error:", err);
      setUsdtBalance(null);
    }
  };

  // Initial load
  useEffect(() => {
    if (account && smartAddress && !smartAddress.startsWith("0x0000")) {
      fetchProfile();
      loadJobs();
      fetchBalance();
      fetchUSDTBalance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, smartAddress]);

  /* ------------------------------------
      AI CONTEXT INJECTION
  ------------------------------------ */
  useEffect(() => {
    if (account && smartAddress && !smartAddress.startsWith("0x0000")) {
      const contextData = `
--- CURRENT USER CONTEXT ---
Role: Client
Name: ${profile?.name || "Unnamed Client"}
Wallet Address: ${smartAddress}
Bio: ${profile?.bio || "No bio set"}
Total Jobs Posted: ${profile?.totalJobsPosted || 0}
Total Jobs Completed: ${profile?.totalJobsCompleted || 0}
Current Job Stats:
- Open Jobs: ${jobs.filter(j => j.status === 1).length}
- Hired Jobs (In Progress): ${jobs.filter(j => j.status === 2).length}
- Completed Jobs: ${jobs.filter(j => j.status === 4).length}
- Cancelled/Expired: ${jobs.filter(j => j.status === 3 || j.status === 5).length}
Wallet Balances: MATIC: ${balance?.displayValue} ${balance?.symbol}, USDT: ${usdtBalance} USDT
`;
      setChatContext(defaultContext + "\n\n" + contextData);
    }

    return () => {
      setChatContext(defaultContext);
    };
  }, [account, smartAddress, profile, jobs, balance, usdtBalance, setChatContext]);

  const refreshBalances = () => {
    fetchBalance();
    fetchUSDTBalance();
  };

  /* ------------------------------------
      ADDRESS COPY
  ------------------------------------ */
  const handleCopy = async () => {
    await navigator.clipboard.writeText(smartAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ------------------------------------
      FAUCET HANDLER
  ------------------------------------ */
  const requestTestTokens = async () => {
    if (!smartAddress || smartAddress.startsWith("0x0000")) return;

    try {
      setFaucetLoading(true);
      setFaucetMessage(null);

      const response = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientAddress: smartAddress }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to request tokens');
      }

      setFaucetMessage({ type: 'success', text: data.message });
      // Refresh balances after successful faucet
      setTimeout(() => refreshBalances(), 2000);
    } catch (error: any) {
      setFaucetMessage({ type: 'error', text: error.message });
    } finally {
      setFaucetLoading(false);
      // Clear message after 5 seconds
      setTimeout(() => setFaucetMessage(null), 5000);
    }
  };


  /* ------------------------------------
      HANDLE POST JOB CLICK
  ------------------------------------ */
  const handlePostJobClick = () => {
    if (!profile) {
      setShowProfilePrompt(true);
    } else {
      setShowPostJob(true);
    }
  };

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



        {/* ===== MOBILE HERO (hidden on md+) ===== */}
        <div className="block md:hidden">
          <div className="rounded-2xl p-4 border border-border shadow-lg"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)/0.15) 0%, hsl(var(--primary)/0.04) 100%)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 border-2 border-primary/40 flex-shrink-0 flex items-center justify-center text-xl font-bold text-primary">
                {(profile?.name || "C").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold truncate">
                  {profile ? `Welcome, ${profile.name} 👋` : "Welcome, Client 👋"}
                </h1>
                <p className="text-xs text-muted-foreground truncate">
                  {profile?.bio || "Complete your profile to unlock all features."}
                </p>
              </div>
            </div>
            {/* Balances */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-xl bg-black/25 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">MATIC</p>
                <p className="text-sm font-bold text-primary truncate">
                  {balance ? parseFloat(balance.displayValue).toFixed(3) : "0"}
                </p>
              </div>
              <div className="rounded-xl bg-black/25 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">USDT</p>
                <p className="text-sm font-bold text-primary truncate">
                  {usdtBalance !== null ? `${usdtBalance}` : "—"}
                </p>
              </div>
            </div>
            {/* Actions */}
            <div className="flex gap-2">
              <button onClick={handlePostJobClick}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Post Job
              </button>
              <button onClick={requestTestTokens} disabled={faucetLoading}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold disabled:opacity-50">
                {faucetLoading ? "Requesting..." : "🚰 Test Tokens"}
              </button>
              <button onClick={refreshBalances} disabled={loadingBalance}
                className="p-2.5 rounded-xl border border-border bg-black/20 disabled:opacity-50">
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
        <div className="hidden md:flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold break-words">
              {profile ? `Welcome, ${profile.name} 👋` : "Welcome, Client 👋"}
            </h1>
            <p className="text-muted-foreground mt-1 max-w-md break-words">
              {profile?.bio || "Complete your profile to unlock all features."}
            </p>
          </div>
          <button onClick={handlePostJobClick}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90">
            <Plus className="w-4 h-4" /> Post Job
          </button>
        </div>

        {/* STATS HEADER (desktop only – mobile shows balances in hero) */}
        <div className="hidden md:flex items-center justify-between">
          <h2 className="text-xl font-bold">Overview</h2>
          <button onClick={refreshBalances} disabled={loadingBalance}
            className="flex items-center gap-2 text-sm text-primary hover:underline disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loadingBalance ? "animate-spin" : ""}`} /> Refresh Balances
          </button>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
          {[
            {
              icon: Briefcase,
              label: "Jobs Posted",
              value: loadingJobs ? "..." : jobs.length,
            },
            {
              icon: FileText,
              label: "Completed Jobs",
              value: loadingJobs
                ? "..."
                : jobs.filter((j) => j.status === 4).length,
            },
            {
              icon: Wallet,
              label: "MATIC Balance",
              value: balance
                ? `${parseFloat(balance.displayValue).toFixed(4)} ${balance.symbol}`
                : loadingBalance
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
              className="p-4 md:p-6 rounded-2xl glass-effect border shadow-md flex items-center justify-between"
            >
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">{stat.label}</p>
                <h2 className="text-xl md:text-2xl font-semibold">{stat.value}</h2>
              </div>
              <stat.icon className="w-5 h-5 md:w-6 md:h-6 text-primary" />
            </motion.div>
          ))}
        </div>

        {/* FAUCET (desktop only – faucet accessible on mobile via hero card) */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.5 }}
          className="hidden md:block p-6 rounded-2xl glass-effect border shadow-md">
          <h3 className="text-lg font-semibold mb-3">Test Tokens Faucet</h3>
          <p className="text-sm text-muted-foreground mb-4">Get test tokens to try out the platform</p>
          <button onClick={requestTestTokens} disabled={faucetLoading}
            className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 transition disabled:opacity-50">
            {faucetLoading ? "Requesting..." : "🚰 Get Test Tokens (0.5 MATIC + 500 USDT)"}
          </button>
          {faucetMessage && (
            <p className={`text-xs mt-2 ${faucetMessage.type === "success" ? "text-green-500" : "text-red-500"}`}>
              {faucetMessage.text}
            </p>
          )}
        </motion.div>

        {/* JOB LIST */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Your Jobs</h2>
            <button
              onClick={loadJobs}
              disabled={loadingJobs}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-surface-secondary transition disabled:opacity-50 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loadingJobs ? "animate-spin" : ""}`} />
              Refresh List
            </button>
          </div>

          {/* Tabs - Pill style for mobile, standard for desktop */}
          <div className="flex md:hidden overflow-x-auto gap-2 pb-2 scrollbar-hide">
            {[
              { id: "open", label: "Open" },
              { id: "hired", label: "In Progress" },
              { id: "completed", label: "Completed" },
              { id: "cancelled", label: "Cancelled" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTab(t.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all ${selectedTab === t.id
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-surface-secondary border border-border text-muted-foreground"
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="hidden md:flex overflow-x-auto gap-4 border-b pb-2 scrollbar-hide">
            {[
              { id: "open", label: "Open" },
              { id: "hired", label: "In Progress" },
              { id: "completed", label: "Completed" },
              { id: "cancelled", label: "Cancelled / Expired" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTab(t.id)}
                className={`pb-2 text-sm font-medium transition-colors ${selectedTab === t.id
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
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="group border border-border/50 rounded-2xl p-4 glass-effect hover:border-primary/50 transition-all flex flex-col gap-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold leading-snug group-hover:text-primary transition-colors line-clamp-2">
                      {job.title}
                    </h3>

                    <div className="mt-2 flex flex-wrap gap-2 items-center">
                      <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                        Budget: {(job.budgetUSDC / 1e6).toFixed(0)} USDT
                      </span>
                      {job.status === 2 || job.status === 3 || job.status === 4 || job.status === 5 ? (
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${job.status === 4
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          : job.status === 3 || job.status === 5
                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          }`}>
                          {job.status === 4 ? "Completed" : job.status === 3 ? "Cancelled" : job.status === 5 ? "Expired" : "Hired"}
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-muted-foreground bg-black/20 px-2 py-0.5 rounded-full">
                          {job.applicants} applicants
                        </span>
                      )}
                    </div>

                    {job.hiredFreelancer && job.hiredFreelancer !== "0x0000000000000000000000000000000000000000" && (
                      <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        With: {job.hiredFreelancer.slice(0, 6)}...{job.hiredFreelancer.slice(-4)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-auto pt-2 border-t border-border/30 flex items-center justify-between">
                  {/* Status/Time (optional) */}
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold italic">Client View</span>
                  <button
                    onClick={() => {
                      const slug = slugify(job.title);
                      router.push(`/client/jobs/${job.id}-${slug}`);
                    }}
                    className="flex items-center gap-1 text-xs font-bold text-primary hover:underline group-hover:gap-2 transition-all"
                  >
                    Manage Job <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      {/* PROFILE CREATION PROMPT MODAL */}
      {showProfilePrompt && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface rounded-2xl max-w-md w-full p-6 border border-border shadow-xl"
          >
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <FileText className="w-8 h-8 text-primary" />
              </div>

              <h2 className="text-2xl font-bold">Create Your Profile First</h2>

              <p className="text-foreground-secondary">
                You need to create a client profile before you can post jobs. This helps freelancers learn more about you and your business.
              </p>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowProfilePrompt(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-surface-secondary transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => router.push('/client/profile')}
                  className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition"
                >
                  Create Profile
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

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
