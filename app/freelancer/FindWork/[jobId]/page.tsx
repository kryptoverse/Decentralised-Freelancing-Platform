"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  getContract,
  readContract,
  prepareContractCall,
  sendTransaction,
} from "thirdweb";
import { useActiveAccount } from "thirdweb/react";

import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { ipfsToHttp } from "@/utils/ipfs";
import { useIPFSUpload } from "@/hooks/useIPFSUpload";
import { useChatContext, defaultContext } from "@/components/chat/ChatContext";

import {
  ArrowLeft,
  Clock,
  DollarSign,
  Loader2,
  Users,
  Tag,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

type JobStatus = 0 | 1 | 2 | 3 | 4 | 5;

interface JobDetails {
  jobId: number;
  client: string;
  title: string;
  descriptionURI: string;
  description: string;
  budgetUSDC: bigint;
  status: JobStatus;
  hiredFreelancer: string;
  escrow: string;
  createdAt: bigint;
  updatedAt: bigint;
  expiresAt: bigint;
  tags: string[];
  postingBond: bigint;
}

interface Applicant {
  freelancer: string;
  appliedAt: bigint;
}

const JOB_STATUS_LABELS: Record<
  JobStatus,
  { label: string; colorClass: string }
> = {
  0: { label: "Unknown", colorClass: "bg-gray-200 text-gray-800" },
  1: { label: "Open", colorClass: "bg-emerald-500/10 text-emerald-400" },
  2: { label: "Hired", colorClass: "bg-blue-500/10 text-blue-400" },
  3: { label: "Cancelled", colorClass: "bg-red-500/10 text-red-400" },
  4: { label: "Completed", colorClass: "bg-purple-500/10 text-purple-400" },
  5: { label: "Expired", colorClass: "bg-amber-500/10 text-amber-400" },
};

export default function JobDetailsPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const account = useActiveAccount();
  const { uploadMetadata } = useIPFSUpload();
  const { setChatContext } = useChatContext();

  // PROPOSAL STATE
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalText, setProposalText] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("");
  const [isGeneratingProposal, setIsGeneratingProposal] = useState(false);

  // FREELANCER PROFILE STATUS
  const [hasFreelancerProfile, setHasFreelancerProfile] = useState<
    boolean | null
  >(null);
  const [isKYCVerified, setIsKYCVerified] = useState<boolean | null>(null);

  const [job, setJob] = useState<JobDetails | null>(null);
  const [freelancerProfile, setFreelancerProfile] = useState<any>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [applicantCount, setApplicantCount] = useState<number | null>(null);
  const [hasApplied, setHasApplied] = useState(false);

  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txMsg, setTxMsg] = useState<string | null>(null);
  const [showKYCModal, setShowKYCModal] = useState(false);
  const [showProfileRequiredModal, setShowProfileRequiredModal] = useState(false);

  const numericJobId = useMemo(() => {
    try {
      return BigInt(params.jobId);
    } catch {
      return null;
    }
  }, [params.jobId]);

  // -----------------------------------------------------------
  // Load freelancer profile once user connects wallet
  // -----------------------------------------------------------
  useEffect(() => {
    if (!account) return;

    async function loadProfileStatus() {
      if (!account) return;
      const userAddress = account.address as `0x${string}`;

      try {
        const factory = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory,
        });

        const profileAddr = await readContract({
          contract: factory,
          method: "function freelancerProfile(address) view returns (address)",
          params: [userAddress],
        });

        const ZERO = "0x0000000000000000000000000000000000000000";

        if (profileAddr !== ZERO) {
          setHasFreelancerProfile(true);

          // Check KYC status
          const profileContract = getContract({
            client,
            chain: CHAIN,
            address: profileAddr as `0x${string}`,
          });

            try {
              const kycStatus = await readContract({
                contract: profileContract,
                method: "function isKYCVerified() view returns (bool)",
              });
              setIsKYCVerified(Boolean(kycStatus));

              // Fetch metadata for AI context
              const [name, bio, skillsRaw] = await Promise.all([
                readContract({ contract: profileContract, method: "function name() view returns (string)" }),
                readContract({ contract: profileContract, method: "function bio() view returns (string)" }),
                readContract({ contract: profileContract, method: "function skills() view returns (string[])" }).catch(() => []),
              ]);

              setFreelancerProfile({ name, bio, skills: skillsRaw });

              // If KYC is not verified, show modal
              if (!kycStatus) {
                setShowKYCModal(true);
              }
            } catch (e) {
            console.error("KYC check failed:", e);
            setIsKYCVerified(false);
            setShowKYCModal(true);
          }
        } else {
          setHasFreelancerProfile(false);
          setIsKYCVerified(false);
          setShowProfileRequiredModal(true);
        }
      } catch (e) {
        console.error("Profile check failed:", e);
        setHasFreelancerProfile(false);
        setIsKYCVerified(false);
        setShowProfileRequiredModal(true);
      }
    }

    loadProfileStatus();
  }, [account]);

  /* ------------------------------------------------
     LOAD JOB DATA + APPLICANTS
  ------------------------------------------------ */
  useEffect(() => {
    if (!account || numericJobId === null) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const jobBoard = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.JobBoard,
        });

        // ---- JOB DETAILS ----
        const jobData = await readContract({
          contract: jobBoard,
          method:
            "function getJob(uint256) view returns (address,string,string,uint256,uint8,address,address,uint64,uint64,uint64,bytes32[],uint256)",
          params: [numericJobId],
        });

        const [
          clientAddr,
          title,
          descriptionURI,
          budgetUSDC,
          status,
          hiredFreelancer,
          escrow,
          createdAt,
          updatedAt,
          expiresAt,
          tags,
          postingBond,
        ] = jobData as unknown as [
          string,
          string,
          string,
          bigint,
          number,
          string,
          string,
          bigint,
          bigint,
          bigint,
          `0x${string}`[],
          bigint
        ];

        // Fetch IPFS metadata for description
        let description = "";
        if (descriptionURI.trim() !== "") {
          try {
            const res = await fetch(ipfsToHttp(descriptionURI));
            const data = await res.json();
            description = data.description || descriptionURI;
          } catch {
            description = descriptionURI;
          }
        }

        // Decode tag bytes32[]
        const tagStrings = tags
          .map((tag) => {
            try {
              const bytes = new Uint8Array(
                tag
                  .slice(2)
                  .match(/.{1,2}/g)!
                  .map((byte) => parseInt(byte, 16))
              );
              return new TextDecoder()
                .decode(bytes)
                .replace(/\0/g, "")
                .trim();
            } catch {
              return "";
            }
          })
          .filter((t) => t.length > 0);

        // Set job state
        setJob({
          jobId: Number(numericJobId),
          client: clientAddr,
          title,
          descriptionURI,
          description,
          budgetUSDC,
          status: status as JobStatus,
          hiredFreelancer,
          escrow,
          createdAt,
          updatedAt,
          expiresAt,
          tags: tagStrings,
          postingBond,
        });

        // ---- APPLICANTS (fixed) ----
        const rawCount = await readContract({
          contract: jobBoard,
          method: "function getApplicantCount(uint256) view returns (uint256)",
          params: [numericJobId],
        });

        const rawCountNum = Number(rawCount);

        if (rawCountNum === 0) {
          setApplicantCount(0);
          setApplicants([]);
        } else {
          const [freelancers, appliedAt] = (await readContract({
            contract: jobBoard,
            method:
              "function getApplicants(uint256,uint256,uint256) view returns (address[],uint64[])",
            params: [numericJobId, 0n, BigInt(rawCountNum)],
          })) as [string[], bigint[]];

          const ZERO = "0x0000000000000000000000000000000000000000";

          const filtered: Applicant[] = freelancers
            .map((f, idx) => ({
              freelancer: f,
              appliedAt: appliedAt[idx],
            }))
            .filter((a) => a.freelancer !== ZERO);

          setApplicantCount(filtered.length);
          setApplicants(filtered.slice(0, 5));
        }

        // ---- HAS APPLIED (fixed to use getApplicantDetails) ----
        let applied = false;
        try {
          await readContract({
            contract: jobBoard,
            method:
              "function getApplicantDetails(uint256,address) view returns (address,uint64,string,uint256,uint64)",
            params: [numericJobId, account.address],
          });
          applied = true;
        } catch {
          applied = false;
        }

        setHasApplied(applied);
      } catch (err: any) {
      } finally {
        setLoading(false);
      }
    };

    loadData();

    return () => {
      setChatContext(defaultContext);
    };
  }, [account, numericJobId, setChatContext]);

  // EXPIRED?
  const isExpired =
    job && job.expiresAt > 0n
      ? Number(job.expiresAt) <= Date.now() / 1000
      : false;

  const daysLeft =
    job && job.expiresAt > 0n
      ? Math.ceil(
        (Number(job.expiresAt) - Date.now() / 1000) / (60 * 60 * 24)
      )
      : null;

  /* ------------------------------------------------
     AI CONTEXT INJECTION
  ------------------------------------------------ */
  useEffect(() => {
    if (job) {
      const jobContext = `
CURRENT JOB CONTEXT (BROWSING):
- Job ID: ${job.jobId}
- Title: ${job.title}
- Description: ${job.description}
- Budget: ${(Number(job.budgetUSDC) / 1e6).toFixed(2)} USDT
- Status: ${JOB_STATUS_LABELS[job.status]?.label || "Unknown"}
- Client: ${job.client}
- Tags: ${job.tags.join(", ")}
- Applicants: ${applicantCount ?? 0}
- Your Status: ${hasApplied ? "Already Applied" : "Not Applied Yet"}
- Expiry: ${isExpired ? "Expired" : `${daysLeft} days left`}
`;

      let userContext = "";
      if (freelancerProfile) {
        userContext = `
YOUR PROFILE CONTEXT (SIGNED-IN FREELANCER):
- Name: ${freelancerProfile.name}
- Bio: ${freelancerProfile.bio}
- Skills: ${freelancerProfile.skills?.join(", ") || "None listed"}
- KYC Verified: ${isKYCVerified ? "Yes" : "No"}
`;
      }

      setChatContext(defaultContext + "\n\n" + jobContext + "\n" + userContext);
    }
  }, [job, applicantCount, hasApplied, isExpired, daysLeft, freelancerProfile, isKYCVerified, setChatContext]);

  const isOwner = useMemo(() => {
    if (!account || !job) return false;
    return account.address.toLowerCase() === job.client.toLowerCase();
  }, [account, job]);

  const canApply =
    !!account && !!job && job.status === 1 && !isExpired && !hasApplied && !isOwner;

  const canWithdraw =
    !!account && !!job && job.status === 1 && hasApplied;

  /* ---------------------------------------------------------------
     APPLY WITH PROPOSAL (IPFS Upload + call overloaded applyToJob)
  --------------------------------------------------------------- */
  const handleApplyWithProposal = async () => {
    if (!account || !job || numericJobId === null) return;

    if (!hasFreelancerProfile) {
      setError(
        "You must create a freelancer profile before submitting proposal."
      );
      return;
    }

    // Validate bid amount and delivery days
    const parsedBid = Number(bidAmount);
    const parsedDays = Number(deliveryDays);
    if (!bidAmount || isNaN(parsedBid) || parsedBid <= 0) {
      setError("Please enter a valid bid amount (must be greater than 0 USDT).");
      return;
    }
    if (!deliveryDays || isNaN(parsedDays) || parsedDays < 1) {
      setError("Please enter a valid delivery timeline (at least 1 day).");
      return;
    }

    try {
      setTxLoading(true);
      setTxMsg(null);
      setError(null);

      // Upload metadata
      const proposalURI = await uploadMetadata(
        {
          proposal: proposalText,
          bidAmount,
          deliveryDays,
          freelancer: account.address,
          jobId: job.jobId,
        },
        { name: `proposal_${account.address}_${job.jobId}` }
      );

      const jobBoard = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.JobBoard,
      });

      const tx = await prepareContractCall({
        contract: jobBoard,
        method:
          "function applyToJob(uint256,string,uint256,uint64)",
        params: [
          numericJobId,
          proposalURI,
          BigInt(Math.floor(Number(bidAmount) * 1e6)),
          BigInt(deliveryDays),
        ],
      });

      await sendTransaction({ account, transaction: tx });

      setHasApplied(true);
      setShowProposalModal(false);
      setTxMsg("Proposal submitted successfully!");
    } catch (err: any) {
      console.error(err);
      setError("Failed to submit proposal.");
    } finally {
      setTxLoading(false);
    }
  };

  /* ------------------------------------------------
     AI PROPOSAL GENERATOR
  ------------------------------------------------ */
  const handleGenerateProposal = async () => {
    if (!job) return;
    setIsGeneratingProposal(true);
    setProposalText("");

    const systemPrompt = `You are a professional freelance proposal writer.
Write clear, concise, and compelling job proposals in plain text only.
DO NOT use any markdown formatting: no asterisks (*), no hashes (#), no dashes for bullets, no underscores, no backticks.
Write in natural paragraphs. Be professional and direct.
Structure the proposal as: brief intro showing understanding of the job, relevant experience/skills, proposed approach, and a closing call to action.
Keep the proposal between 150-250 words.`;

    const userMessage = `Write a job application proposal for me based on the following:

JOB TITLE: ${job.title}
JOB DESCRIPTION: ${job.description}
BUDGET: ${(Number(job.budgetUSDC) / 1e6).toFixed(2)} USDT
REQUIRED SKILLS: ${job.tags.join(", ")}

MY PROFILE:
Name: ${freelancerProfile?.name || "Freelancer"}
Bio: ${freelancerProfile?.bio || "Experienced professional"}
Skills: ${freelancerProfile?.skills?.join(", ") || "General skills"}
KYC Verified: ${isKYCVerified ? "Yes" : "No"}`;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ id: "1", role: "user", content: userMessage }],
          systemContext: systemPrompt,
        }),
      });

      if (!res.ok) throw new Error("AI request failed");

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let generated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        generated += chunk;
        setProposalText(generated);
      }
    } catch (err) {
      console.error("Proposal generation failed:", err);
      setError("Failed to generate proposal. Please try again or write manually.");
    } finally {
      setIsGeneratingProposal(false);
    }
  };

  /* ------------------------------------------------
     WITHDRAW
  ------------------------------------------------ */
  const handleWithdraw = async () => {
    if (!account || !job || numericJobId === null) return;

    try {
      setTxLoading(true);
      setError(null);
      setTxMsg("");

      const jobBoard = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.JobBoard,
      });

      const tx = await prepareContractCall({
        contract: jobBoard,
        method: "function withdrawApplication(uint256)",
        params: [numericJobId],
      });

      await sendTransaction({ account, transaction: tx });

      setHasApplied(false);
      setTxMsg("Application withdrawn.");
    } catch {
      setError("Withdraw failed.");
    } finally {
      setTxLoading(false);
    }
  };

  /* ------------------------------------------------
     UI
  ------------------------------------------------ */

  if (!account)
    return (
      <div className="p-8 text-center text-gray-400">
        Connect wallet to continue.
      </div>
    );

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-gray-400 mt-2">Loading job...</p>
      </div>
    );

  if (!job)
    return (
      <div className="p-8 text-center text-gray-400">Job not found.</div>
    );

  const statusMeta = JOB_STATUS_LABELS[job.status];

  return (
    <main className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Jobs
      </button>

      {/* ── HEADER CARD ── */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/8 via-background to-background p-6 md:p-8 space-y-5 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight flex-1">
            {job.title}
          </h1>
          <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${statusMeta.colorClass}`}>
            {statusMeta.label}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <span>Client:{" "}<span className="font-mono text-foreground">{job.client.slice(0, 6)}…{job.client.slice(-4)}</span></span>
          <span>Posted: {new Date(Number(job.createdAt) * 1000).toLocaleString()}</span>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 font-semibold text-sm">
            <DollarSign className="w-4 h-4" />
            {(Number(job.budgetUSDC) / 1e6).toFixed(2)} USDT
          </div>
          {job.expiresAt > 0n && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${
              isExpired
                ? "bg-red-500/15 border border-red-500/25 text-red-400"
                : "bg-amber-500/15 border border-amber-500/25 text-amber-400"
            }`}>
              <Clock className="w-4 h-4" />
              {isExpired ? "Expired" : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`}
            </div>
          )}
          {hasApplied && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-400 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" /> Applied
            </div>
          )}
        </div>

        {job.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {job.tags.map((tag, idx) => (
              <span key={idx} className="px-3 py-1 text-xs bg-primary/15 border border-primary/30 rounded-full text-primary font-medium">
                {tag}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ── BODY GRID ── */}
      <section className="grid gap-6 lg:grid-cols-[1fr,300px] items-start">

        {/* LEFT — Description */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-2xl border border-border bg-card shadow-sm"
        >
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">Job Description</h2>
          </div>
          <div className="p-6">
            <p className="text-sm md:text-[15px] text-foreground leading-relaxed whitespace-pre-wrap">
              {job.description || "No description provided."}
            </p>
          </div>
        </motion.div>

        {/* RIGHT — Sticky panel */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="flex flex-col gap-4 lg:sticky lg:top-4"
        >
          {/* Apply card */}
          <div className="rounded-2xl border border-border bg-card shadow-sm p-5 space-y-4">
            <h2 className="text-base font-semibold text-foreground">Apply to this Job</h2>

            {txMsg && (
              <div className="text-green-400 p-3 bg-green-500/10 border border-green-400/20 rounded-xl text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> {txMsg}
              </div>
            )}
            {error && (
              <div className="text-red-400 p-3 bg-red-500/10 border border-red-400/20 rounded-xl text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
            {isOwner && (
              <div className="text-amber-400 p-3 bg-amber-500/10 border border-amber-400/20 rounded-xl text-xs flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>You are the <strong>client</strong> who posted this job. You cannot apply as a freelancer to your own project.</span>
              </div>
            )}

            {canApply && hasFreelancerProfile === false && (
              <button
                onClick={() => router.push("/freelancer/Profile")}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
              >
                Create Profile to Apply
              </button>
            )}

            {canApply && hasFreelancerProfile && (
              <button
                onClick={() => setShowProposalModal(true)}
                disabled={txLoading}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition shadow-md shadow-primary/20 flex items-center justify-center gap-2"
              >
                ✍️ Write Proposal
              </button>
            )}

            {!canApply && !canWithdraw && !hasApplied && job.status !== 1 && (
              <p className="text-xs text-muted-foreground text-center">
                This job is no longer accepting applications.
              </p>
            )}

            {canWithdraw && (
              <button
                onClick={handleWithdraw}
                disabled={txLoading}
                className="w-full py-2.5 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-surface-secondary transition"
              >
                {txLoading ? "Withdrawing…" : "Withdraw Application"}
              </button>
            )}
          </div>

          {/* Applicants card */}
          <div className="rounded-2xl border border-border bg-card shadow-sm p-5 space-y-3">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Applicants
            </h2>
            <p className="text-xs text-muted-foreground">
              <span className="text-foreground font-semibold">{applicantCount ?? 0}</span> total
            </p>
            {applicants.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No applicants yet.</p>
            ) : (
              <ul className="space-y-2">
                {applicants.map((a, idx) => (
                  <li key={idx} className="border border-border rounded-xl px-3 py-2 flex justify-between text-xs">
                    <span className="font-mono text-foreground">{a.freelancer.slice(0, 6)}…{a.freelancer.slice(-4)}</span>
                    <span className="text-muted-foreground">{new Date(Number(a.appliedAt) * 1000).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      </section>

      {/* PROPOSAL MODAL */}
      {showProposalModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-3 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh]"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-foreground">Submit Proposal</h2>
                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px] sm:max-w-[260px]">{job.title}</p>
              </div>
              <button
                onClick={handleGenerateProposal}
                disabled={isGeneratingProposal || txLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 shadow-md shrink-0"
                style={{ background: "linear-gradient(to right, #7c3aed, #4f46e5)", color: "#ffffff" }}
              >
                {isGeneratingProposal ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#ffffff" }} /> Generating…</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5" style={{ color: "#ffffff" }} /> Generate with AI</>
                )}
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Your Proposal</label>
                <p className="text-xs text-muted-foreground">
                  Describe why you are the best fit, or click{" "}
                  <span className="text-violet-400 font-medium">Generate with AI</span> to auto-draft from your profile.
                </p>
                <div className="relative">
                  <textarea
                    className="w-full p-3 sm:p-4 rounded-xl border border-border bg-background text-foreground text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 transition placeholder:text-muted-foreground/50"
                    rows={8}
                    placeholder="Write your proposal here…"
                    value={proposalText}
                    onChange={(e) => setProposalText(e.target.value)}
                    disabled={isGeneratingProposal}
                  />
                  {isGeneratingProposal && (
                    <div className="absolute inset-0 rounded-xl bg-background/70 flex flex-col items-center justify-center gap-2 pointer-events-none">
                      <Sparkles className="w-5 h-5 text-violet-400 animate-pulse" />
                      <span className="text-sm text-violet-400 font-medium">Writing your proposal…</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground text-right">{proposalText.length} characters</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 flex-1">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    Bid Amount <span className="text-muted-foreground font-normal">(USDT)</span>
                  </label>
                  <input
                    type="number"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                    placeholder={`e.g. ${(Number(job.budgetUSDC) / 1e6).toFixed(0)}`}
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Budget: {(Number(job.budgetUSDC) / 1e6).toFixed(2)} USDT</p>
                </div>
                <div className="space-y-1.5 flex-1">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    Delivery Days
                  </label>
                  <input
                    type="number"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                    placeholder="e.g. 7"
                    value={deliveryDays}
                    onChange={(e) => setDeliveryDays(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Minimum 1 day</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-border shrink-0 flex justify-end gap-3">
              <button
                onClick={() => { setShowProposalModal(false); setProposalText(""); }}
                className="px-5 py-2.5 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-surface-secondary transition"
                disabled={isGeneratingProposal}
              >
                Cancel
              </button>
              <button
                onClick={handleApplyWithProposal}
                disabled={txLoading || isGeneratingProposal}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 shadow-md shadow-primary/20"
              >
                {txLoading
                  ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</span>
                  : "Submit Proposal"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* KYC VERIFICATION MODAL */}
      {showKYCModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-amber-500/30 p-6 rounded-2xl w-full max-w-md space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <ShieldAlert className="w-8 h-8" />
              <h2 className="text-xl font-semibold">KYC Verification Required</h2>
            </div>
            <p className="text-sm text-foreground">
              You need to complete KYC verification before you can submit proposals.
            </p>
            <p className="text-sm text-muted-foreground">
              Complete KYC verification in your profile settings to access all freelancer features.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => router.push("/freelancer/FindWork")}
                className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-surface-secondary transition"
              >Back to Jobs</button>
              <button
                onClick={() => router.push("/freelancer/Profile")}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition"
              >Go to Profile</button>
            </div>
          </div>
        </div>
      )}
      {/* PROFILE REQUIRED MODAL */}
      {showProfileRequiredModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background border border-border p-8 rounded-2xl w-full max-w-md space-y-6 text-center shadow-2xl"
          >
            <div className="flex justify-center">
              <div className="p-4 bg-primary/10 rounded-full">
                <ShieldAlert className="w-12 h-12 text-primary" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Profile Required</h2>
              <p className="text-foreground-secondary leading-relaxed">
                You need to create a freelancer profile before you can view job details and submit proposals.
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <button
                onClick={() => router.push("/freelancer/Profile")}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition shadow-lg shadow-primary/20"
              >
                Create Your Profile
              </button>
              <button
                onClick={() => router.push("/freelancer/FindWork")}
                className="w-full py-3 bg-surface border border-border text-foreground rounded-xl font-medium hover:bg-surface-secondary transition"
              >
                Back to Jobs
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}
