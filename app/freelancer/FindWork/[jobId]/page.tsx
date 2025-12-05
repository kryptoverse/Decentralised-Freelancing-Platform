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

import {
  ArrowLeft,
  Clock,
  DollarSign,
  Loader2,
  Users,
  User,
  Tag,
  AlertCircle,
  CheckCircle2,
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

  // PROPOSAL STATE
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalText, setProposalText] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("");

  // FREELANCER PROFILE STATUS
  const [hasFreelancerProfile, setHasFreelancerProfile] = useState<
    boolean | null
  >(null);
  const [isKYCVerified, setIsKYCVerified] = useState<boolean | null>(null);
  const [showKYCModal, setShowKYCModal] = useState(false);

  const [job, setJob] = useState<JobDetails | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [applicantCount, setApplicantCount] = useState<number | null>(null);
  const [hasApplied, setHasApplied] = useState(false);
  const [clientName, setClientName] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txMsg, setTxMsg] = useState<string | null>(null);

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

        setHasFreelancerProfile(profileAddr !== ZERO);

        // Check KYC status if profile exists
        if (profileAddr !== ZERO) {
          try {
            const profile = getContract({
              client,
              chain: CHAIN,
              address: profileAddr as `0x${string}`,
            });

            const kycStatus = await readContract({
              contract: profile,
              method: "function isKYCVerified() view returns (bool)",
            });

            setIsKYCVerified(kycStatus as boolean);
          } catch (e) {
            console.error("KYC check failed:", e);
            setIsKYCVerified(false);
          }
        } else {
          setIsKYCVerified(false);
        }
      } catch (e) {
        console.error("Profile check failed:", e);
        setHasFreelancerProfile(false);
        setIsKYCVerified(false);
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

        // ---- CLIENT NAME ----
        try {
          const clientFactory = getContract({
            client,
            chain: CHAIN,
            address: DEPLOYED_CONTRACTS.addresses.ClientFactory as `0x${string}`,
          });

          const clientProfileAddr = await readContract({
            contract: clientFactory,
            method: "function getProfile(address) view returns (address)",
            params: [clientAddr as `0x${string}`],
          });

          if (clientProfileAddr && clientProfileAddr !== "0x0000000000000000000000000000000000000000") {
            const clientProfile = getContract({
              client,
              chain: CHAIN,
              address: clientProfileAddr as `0x${string}`,
            });

            const name = await readContract({
              contract: clientProfile,
              method: "function name() view returns (string)",
            });

            setClientName(name as string);
          }
        } catch (err) {
          console.error("Failed to fetch client name:", err);
        }

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
        console.error(err);
        setError(err.message || "Failed to load job");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [account, numericJobId]);

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

  const canApply =
    !!account && !!job && job.status === 1 && !isExpired && !hasApplied && isKYCVerified === true;

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
    <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* HEADER */}
      <section className="glass-effect border rounded-2xl p-6 space-y-4">
        <h1 className="text-2xl md:text-3xl font-bold">{job.title}</h1>

        <div className="text-sm text-gray-400 flex flex-wrap gap-4">
          {clientName && (
            <span className="flex items-center gap-1">
              <User className="w-4 h-4" />
              Client: <span className="font-medium text-white">{clientName}</span>
            </span>
          )}
          <span>
            Posted:{" "}
            {new Date(Number(job.createdAt) * 1000).toLocaleString()}
          </span>
          <span
            className={`px-3 py-1 rounded-full text-xs ${statusMeta.colorClass}`}
          >
            {statusMeta.label}
          </span>
        </div>

        <div className="flex items-center gap-3 mt-2">
          <DollarSign className="w-4 h-4 text-primary" />
          <span className="font-semibold text-white">
            {(Number(job.budgetUSDC) / 1e6).toFixed(2)} USDT
          </span>

          {job.expiresAt > 0n && (
            <div className="flex items-center gap-1 text-gray-400">
              <Clock className="w-4 h-4" />
              {isExpired ? "Expired" : `${daysLeft} days left`}
            </div>
          )}
        </div>

        {job.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {job.tags.map((tag, idx) => (
              <span
                key={idx}
                className="px-2 py-1 text-xs bg-primary/10 border border-primary/30 rounded-full text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* GRID */}
      <section className="grid gap-6 md:grid-cols-[2fr,1fr]">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-effect border rounded-2xl p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold">Description</h2>
          <p className="text-sm text-gray-300 whitespace-pre-wrap">
            {job.description}
          </p>
        </motion.div>

        {/* APPLY + APPLICANTS PANEL */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="glass-effect border rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold">Apply to this Job</h2>

            {txMsg && (
              <div className="text-green-400 p-3 bg-green-500/10 border border-green-400/20 rounded-lg text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {txMsg}
              </div>
            )}
            {error && (
              <div className="text-red-400 p-3 bg-red-500/10 border border-red-400/20 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}

            {/* Freelancer has NO profile */}
            {hasFreelancerProfile === false && (
              <button
                onClick={() => router.push("/freelancer/Profile")}
                className="w-full py-2 rounded-lg bg-primary text-white"
              >
                Create Freelancer Profile to Apply
              </button>
            )}

            {/* KYC Not Verified */}
            {hasFreelancerProfile === true && isKYCVerified === false && (
              <div className="space-y-3">
                <div className="p-3 bg-yellow-500/10 border border-yellow-400/20 rounded-lg text-sm text-yellow-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>KYC verification required to apply for jobs</span>
                </div>
                <button
                  onClick={() => setShowKYCModal(true)}
                  className="w-full py-2 rounded-lg bg-yellow-600 text-white"
                >
                  Verify KYC Status
                </button>
              </div>
            )}

            {/* CAN APPLY */}
            {canApply && hasFreelancerProfile && isKYCVerified === true && (
              <button
                onClick={() => setShowProposalModal(true)}
                disabled={txLoading}
                className="w-full py-2 rounded-lg bg-primary text-white flex justify-center"
              >
                Write Proposal
              </button>
            )}

            {/* ALREADY APPLIED */}
            {hasApplied && (
              <div className="p-4 bg-green-500/10 border border-green-400/20 rounded-lg">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <div>
                    <p className="font-semibold">Application Submitted</p>
                    <p className="text-xs text-gray-400 mt-1">
                      You have already applied to this job. The client will review your proposal.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* APPLICANTS */}
          <div className="glass-effect border rounded-2xl p-6 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" /> Applicants
            </h2>
            <p className="text-xs text-gray-400">
              {applicantCount ?? "0"} total
            </p>

            {applicants.length === 0 ? (
              <p className="text-xs text-gray-500">No applicants yet.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {applicants.map((a, idx) => (
                  <li
                    key={idx}
                    className="border rounded-lg px-3 py-2 flex justify-between text-gray-300"
                  >
                    <span>
                      {a.freelancer.slice(0, 6)}...
                      {a.freelancer.slice(-4)}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {new Date(
                        Number(a.appliedAt) * 1000
                      ).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      </section>

      {/* KYC VERIFICATION MODAL */}
      {showKYCModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-background border p-6 rounded-xl w-full max-w-md space-y-4">
            <h2 className="text-xl font-semibold">KYC Verification Required</h2>
            <p className="text-gray-300">
              You need to complete KYC verification before you can apply for jobs.
              Please contact the administrator to get your KYC status verified.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowKYCModal(false)}
                className="px-4 py-2 bg-primary text-white rounded-lg"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROPOSAL MODAL */}
      {showProposalModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-background border p-6 rounded-xl w-full max-w-lg space-y-4">
            <h2 className="text-xl font-semibold">Submit Proposal</h2>

            <textarea
              className="w-full p-3 rounded-lg border bg-background"
              rows={6}
              placeholder="Write your proposal..."
              value={proposalText}
              onChange={(e) => setProposalText(e.target.value)}
            />

            <div>
              <label className="text-sm font-medium">Bid Amount (USDT)</label>
              <input
                type="number"
                className="mt-1 w-full p-3 border rounded-lg bg-background"
                placeholder="300"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Delivery Days</label>
              <input
                type="number"
                className="mt-1 w-full p-3 border rounded-lg bg-background"
                placeholder="7"
                value={deliveryDays}
                onChange={(e) => setDeliveryDays(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowProposalModal(false)}
                className="px-4 py-2 border rounded-lg"
              >
                Cancel
              </button>

              <button
                onClick={handleApplyWithProposal}
                disabled={txLoading}
                className="px-4 py-2 bg-primary text-white rounded-lg"
              >
                {txLoading ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
