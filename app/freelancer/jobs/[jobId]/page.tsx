"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

import {
  ArrowLeft,
  DollarSign,
  Clock,
  Tag,
  FileText,
  AlertTriangle,
  Send,
  Loader2,
  ShieldAlert,
} from "lucide-react";

import {
  getContract,
  readContract,
  prepareContractCall,
  sendTransaction,
} from "thirdweb";

import { useConnect, useActiveAccount } from "thirdweb/react";
import { inAppSmartWalletNoGas } from "@/lib/thirdweb";
import { useIPFSUpload } from "@/hooks/useIPFSUpload";

import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { ipfsToHttp } from "@/utils/ipfs";

/* ============================================================
   STRICT TYPES
============================================================ */
interface Job {
  jobId: number;
  client: string;
  title: string;
  descriptionURI: string;
  budgetUSDC: bigint;
  status: number;
  hiredFreelancer: string;
  escrow: string;
  createdAt: bigint;
  updatedAt: bigint;
  expiresAt: bigint;
  tags: string[];
}

interface Proposal {
  appliedAt: bigint;
  proposalText: string;
  bidAmount: bigint;
  deliveryDays: bigint;
}

interface EscrowData {
  escrowAddr: string;
  cancelEnd: bigint;
  deliveryDue: bigint;
  reviewDue: bigint;
  delivered: boolean;
  terminal: boolean;
  cancelRequestedBy: string;
}

/* ============================================================
   STATUS MAPS
============================================================ */
const JOB_STATUS = {
  0: "Unknown",
  1: "Open",
  2: "Hired",
  3: "Cancelled",
  4: "Completed",
  5: "Expired",
} as const;

const STATUS_COLORS = {
  Hired: "bg-emerald-500/10 text-emerald-400 border-emerald-600/30",
  Completed: "bg-blue-500/10 text-blue-400 border-blue-600/30",
  Cancelled: "bg-red-500/10 text-red-400 border-red-600/30",
  Expired: "bg-slate-500/10 text-slate-400 border-slate-600/30",
  Open: "bg-amber-500/10 text-amber-400 border-amber-600/30",
} as const;

/* ============================================================
   HELPERS
============================================================ */
function hexToText(hex: string): string {
  try {
    const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
    return new TextDecoder().decode(bytes).replace(/\0/g, "");
  } catch {
    return "";
  }
}

function fmt(ts: bigint | number): string {
  if (!ts || Number(ts) === 0) return "—";
  return new Date(Number(ts) * 1000).toLocaleString();
}

const ABI_ERROR_MESSAGES: Record<string, string> = {
  "0xe405a433":
    "This escrow is already finalized or in a terminal state. Refresh the page to see the latest status.",
  "0x32cc7236":
    "Only the escrow factory can perform this action. Make sure you are using the correct wallet.",
  "0x706470d2":
    "This action is restricted to the assigned freelancer. Please ensure you’re connected with the correct account.",
  "0x20dbc874":
    "This action is restricted to the client. Switch to the client account if needed.",
};

function getFriendlyError(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const msg = String((err as any).message ?? "");
    for (const [sig, text] of Object.entries(ABI_ERROR_MESSAGES)) {
      if (msg.includes(sig)) return text;
    }
    return msg || "Transaction failed. Please check the console for details.";
  }
  return "Transaction failed. Please check the console for details.";
}

/* ============================================================
   PAGE
============================================================ */
export default function FreelancerJobDetailPage() {
  const router = useRouter();
  const params = useParams<{ jobId: string }>();

  /* ============================================================
     FORCE NON-SPONSORED SMART WALLET
  ============================================================ */
  const { connect, isConnecting } = useConnect();
  const account = useActiveAccount();
  const { uploadMetadata } = useIPFSUpload();

  useEffect(() => {
    if (account || isConnecting) return;

    let mounted = true;
    (async () => {
      try {
        await connect(inAppSmartWalletNoGas);
      } catch (err) {
        if (mounted) console.error("Failed to connect smart wallet:", err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [account, isConnecting, connect]);

  if (!account)
    return <main className="p-8">Connecting to your smart wallet...</main>;

  const walletAccount = account;

  const [job, setJob] = useState<Job | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [description, setDescription] = useState("");
  const [escrowData, setEscrowData] = useState<EscrowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isKYCVerified, setIsKYCVerified] = useState<boolean | null>(null);
  const [showKYCModal, setShowKYCModal] = useState(false);

  const [deliverModal, setDeliverModal] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);

  const [deliverLink, setDeliverLink] = useState("");
  const [deliverNotes, setDeliverNotes] = useState("");
  const [deliverLoading, setDeliverLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const jobId = useMemo(() => {
    try {
      return params?.jobId ? BigInt(params.jobId) : 0n;
    } catch {
      return 0n;
    }
  }, [params?.jobId]);

  /* ============================================================
     LOAD DATA
  ============================================================ */
  useEffect(() => {
    if (!walletAccount.address || jobId === 0n) return;

    async function load() {
      try {
        // First check KYC status
        const factory = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory as `0x${string}`,
        });

        const profileAddr = await readContract({
          contract: factory,
          method: "function freelancerProfile(address) view returns (address)",
          params: [walletAccount.address as `0x${string}`],
        });

        const ZERO = "0x0000000000000000000000000000000000000000";

        if (profileAddr !== ZERO) {
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

            // If KYC is not verified, show modal and stop loading
            if (!kycStatus) {
              setShowKYCModal(true);
              setLoading(false);
              return;
            }
          } catch (e) {
            console.error("KYC check failed:", e);
            setIsKYCVerified(false);
            setShowKYCModal(true);
            setLoading(false);
            return;
          }
        } else {
          setIsKYCVerified(false);
          setShowKYCModal(true);
          setLoading(false);
          return;
        }

        const jobBoard = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.JobBoard as `0x${string}`,
        });

        /* ----------------------- JOB ----------------------- */
        const rawJob = await readContract({
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
          hired,
          escrow,
          created,
          updated,
          expires,
          tagBytes,
        ] = rawJob as any;

        const tags: string[] = (tagBytes as string[]).map(hexToText).filter(Boolean);

        setJob({
          jobId: Number(jobId),
          client: clientAddr,
          title,
          descriptionURI: descUri,
          budgetUSDC: budget,
          status,
          hiredFreelancer: hired,
          escrow,
          createdAt: created,
          updatedAt: updated,
          expiresAt: expires,
          tags,
        });

        /* ----------------------- DESCRIPTION ----------------------- */
        if (descUri) {
          try {
            const j = await (await fetch(ipfsToHttp(descUri))).json();
            setDescription(j.description ?? descUri);
          } catch {
            setDescription(descUri);
          }
        }

        /* ----------------------- PROPOSAL ----------------------- */
        try {
          const rawP = await readContract({
            contract: jobBoard,
            method:
              "function getApplicantDetails(uint256,address) view returns (address,uint64,string,uint256,uint64)",
            params: [jobId, walletAccount.address as `0x${string}`],
          });

          const [_f, appliedAt, propUri, bidAmt, deliveryDays] = rawP as any;

          let txt = propUri;
          try {
            const j = await (await fetch(ipfsToHttp(propUri))).json();
            txt = j.proposal ?? propUri;
          } catch { }

          setProposal({
            appliedAt,
            proposalText: txt,
            bidAmount: bidAmt,
            deliveryDays,
          });
        } catch { }

        /* ----------------------- ESCROW ----------------------- */
        if (escrow && escrow !== "0x0000000000000000000000000000000000000000") {
          const escrowC = getContract({
            client,
            chain: CHAIN,
            address: escrow as `0x${string}`,
          });

          const [cancelEnd, deliveryDue, reviewDue] = await readContract({
            contract: escrowC,
            method: "function currentDeadlines() view returns (uint64,uint64,uint64)",
          });

          const [delivered, terminal, cancelRequestedBy] = await Promise.all([
            readContract({
              contract: escrowC,
              method: "function delivered() view returns (bool)",
            }),
            readContract({
              contract: escrowC,
              method: "function terminal() view returns (bool)",
            }),
            readContract({
              contract: escrowC,
              method: "function cancelRequestedBy() view returns (address)",
            }),
          ]);

          setEscrowData({
            escrowAddr: escrow,
            cancelEnd,
            deliveryDue,
            reviewDue,
            delivered,
            terminal,
            cancelRequestedBy,
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [walletAccount.address, jobId]);

  /* ============================================================
     ACTION HELPERS
  ============================================================ */

  async function uploadJSON(data: any, suffix = "delivery"): Promise<string> {
    const walletPrefix = walletAccount.address
      .replace("0x", "")
      .toLowerCase()
      .slice(0, 10);

    return uploadMetadata(data, {
      name: `${walletPrefix}_${suffix}`,
    });
  }

  async function requestCancel() {
    if (!escrowData) return;
    try {
      setCancelLoading(true);

      const escrow = getContract({
        client,
        chain: CHAIN,
        address: escrowData.escrowAddr as `0x${string}`,
      });

      const tx = await prepareContractCall({
        contract: escrow,
        method: "function requestCancel()",
        params: [],
      });

      await sendTransaction({ account: walletAccount, transaction: tx });

      setCancelModal(false);
      router.refresh();
    } catch (err) {
      console.error("requestCancel error:", err);
      alert(getFriendlyError(err));
    } finally {
      setCancelLoading(false);
    }
  }

  async function acceptCancel() {
    if (!escrowData) return;
    try {
      setCancelLoading(true);

      const escrow = getContract({
        client,
        chain: CHAIN,
        address: escrowData.escrowAddr as `0x${string}`,
      });

      const tx = await prepareContractCall({
        contract: escrow,
        method: "function acceptCancel()",
        params: [],
      });

      await sendTransaction({ account: walletAccount, transaction: tx });

      router.refresh();
    } catch (err) {
      console.error("acceptCancel error:", err);
      alert(getFriendlyError(err));
    } finally {
      setCancelLoading(false);
    }
  }

  async function submitDelivery() {
    if (!escrowData) return;

    if (!deliverLink) {
      alert("Delivery link required");
      return;
    }

    try {
      setDeliverLoading(true);

      const metadataUri = await uploadJSON({
        deliveryLink: deliverLink,
        notes: deliverNotes,
      });

      const escrow = getContract({
        client,
        chain: CHAIN,
        address: escrowData.escrowAddr as `0x${string}`,
      });

      const tx = await prepareContractCall({
        contract: escrow,
        method: "function deliverWork(string)",
        params: [metadataUri],
      });

      await sendTransaction({ account: walletAccount, transaction: tx });

      setDeliverModal(false);
      router.refresh();
    } catch (err) {
      console.error("submitDelivery error:", err);
      alert(getFriendlyError(err));
    } finally {
      setDeliverLoading(false);
    }
  }

  async function raiseDispute() {
    if (!escrowData) return;

    const reason = prompt("Describe dispute reason:");
    if (!reason) return;

    try {
      const uri = await uploadJSON({ reason });

      const escrow = getContract({
        client,
        chain: CHAIN,
        address: escrowData.escrowAddr as `0x${string}`,
      });

      const tx = await prepareContractCall({
        contract: escrow,
        method: "function raiseDispute(string)",
        params: [uri],
      });

      await sendTransaction({ account: walletAccount, transaction: tx });

      router.refresh();
    } catch (err) {
      console.error("raiseDispute error:", err);
      alert(getFriendlyError(err));
    }
  }

  /* ============================================================
     RENDER
  ============================================================ */

  if (loading || !job) {
    return (
      <main className="p-8 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </main>
    );
  }

  const jobStatus = JOB_STATUS[job.status as keyof typeof JOB_STATUS];
  const statusColor = STATUS_COLORS[jobStatus as keyof typeof STATUS_COLORS];

  const nowBn = BigInt(Math.floor(Date.now() / 1000));
  const canDeliver =
    job.status === 2 &&
    escrowData &&
    !escrowData.delivered &&
    !escrowData.terminal &&
    escrowData.cancelEnd > nowBn &&
    escrowData.deliveryDue > nowBn;

  const isHired =
    job.status === 2 &&
    job.hiredFreelancer.toLowerCase() === walletAccount.address.toLowerCase();

  return (
    <>
      <main className="max-w-4xl mx-auto p-4 space-y-8">

        {/* BACK BUTTON */}
        <button
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* JOB CARD */}
        <section className="p-6 border rounded-2xl bg-surface-secondary space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h1 className="text-2xl md:text-3xl font-bold">{job.title}</h1>

            <span className={`px-3 py-1 text-xs border rounded-full ${statusColor}`}>
              {jobStatus}
              {isHired && " • You’re hired"}
            </span>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <DollarSign className="w-4 h-4" />
              {(Number(job.budgetUSDC) / 1e6).toFixed(2)} USDT
            </span>

            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Posted: {fmt(job.createdAt)}
            </span>
          </div>

          {job.tags.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {job.tags.map((t, i) => (
                <span
                  key={i}
                  className="px-2 py-1 text-xs bg-primary/10 border border-primary/30 rounded-full text-primary flex items-center gap-1"
                >
                  <Tag className="w-3 h-3" />
                  {t}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* DESCRIPTION */}
        <section className="p-6 border rounded-2xl bg-surface space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" /> Job Description
          </h2>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">{description}</p>
        </section>

        {/* PROPOSAL */}
        {proposal && (
          <section className="p-6 border rounded-2xl bg-surface space-y-3">
            <h2 className="text-lg font-semibold">Your Proposal</h2>

            <p className="text-xs text-muted-foreground">
              Applied: {fmt(proposal.appliedAt)}
            </p>

            <p className="text-sm whitespace-pre-wrap">{proposal.proposalText}</p>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-3">
              <span>
                Bid: <strong>{(Number(proposal.bidAmount) / 1e6).toFixed(2)} USDT</strong>
              </span>
              <span>
                Delivery: <strong>{proposal.deliveryDays.toString()} days</strong>
              </span>
            </div>
          </section>
        )}

        {/* ESCROW */}
        {isHired && escrowData && (
          <section className="p-6 border rounded-2xl bg-surface space-y-6">
            <h2 className="text-lg font-bold">Escrow Timeline</h2>

            <div className="grid sm:grid-cols-2 gap-4">
              <TimelineCard label="Cancel Window Ends" value={fmt(escrowData.cancelEnd)} />
              <TimelineCard label="Delivery Due" value={fmt(escrowData.deliveryDue)} />
              <TimelineCard
                label="Review Window Ends"
                value={escrowData.reviewDue === 0n ? "Not delivered" : fmt(escrowData.reviewDue)}
              />
            </div>

            {/* CANCEL STATUS */}
            {escrowData.cancelRequestedBy !==
              "0x0000000000000000000000000000000000000000" && (
                <div className="p-4 rounded-xl border bg-amber-500/10 text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {escrowData.cancelRequestedBy.toLowerCase() ===
                    walletAccount.address.toLowerCase()
                    ? "You requested cancellation. Waiting for client."
                    : "Client requested cancellation. You must accept or reject."}
                </div>
              )}

            {/* ACTION BUTTONS */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* DELIVER */}
              {canDeliver ? (
                <button
                  onClick={() => setDeliverModal(true)}
                  className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground"
                >
                  Deliver Work
                </button>
              ) : (
                <div className="flex-1 px-4 py-3 rounded-xl border border-border text-sm text-muted-foreground flex items-center justify-center">
                  {escrowData.delivered
                    ? "Already delivered"
                    : escrowData.terminal
                      ? "Escrow closed"
                      : "Delivery window has passed"}
                </div>
              )}

              {/* REQUEST CANCEL - Commented out for future implementation */}
              {/* {!escrowData.terminal &&
                escrowData.cancelRequestedBy ===
                "0x0000000000000000000000000000000000000000" && (
                  <button
                    onClick={() => setCancelModal(true)}
                    className="flex-1 px-4 py-3 rounded-xl bg-surface-secondary border"
                  >
                    Request Cancel
                  </button>
                )} */}

              {/* ACCEPT CANCEL - Commented out for future implementation */}
              {/* {!escrowData.terminal &&
                escrowData.cancelRequestedBy &&
                escrowData.cancelRequestedBy.toLowerCase() !==
                walletAccount.address.toLowerCase() &&
                escrowData.cancelRequestedBy !==
                "0x0000000000000000000000000000000000000000" && (
                  <button
                    onClick={acceptCancel}
                    className="flex-1 px-4 py-3 rounded-xl bg-amber-600 text-white"
                  >
                    Accept Cancel
                  </button>
                )} */}

              {/* DISPUTE - Commented out for future implementation */}
              {/* {!escrowData.terminal && (
                <button
                  onClick={raiseDispute}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20"
                >
                  Raise Dispute
                </button>
              )} */}
            </div>
          </section>
        )}
      </main>

      {/* MODALS */}
      <DeliverModal
        open={deliverModal}
        onClose={() => setDeliverModal(false)}
        onSubmit={submitDelivery}
        deliverLink={deliverLink}
        setDeliverLink={setDeliverLink}
        deliverNotes={deliverNotes}
        setDeliverNotes={setDeliverNotes}
        loading={deliverLoading}
      />

      <CancelModal
        open={cancelModal}
        onClose={() => setCancelModal(false)}
        onSubmit={requestCancel}
        loading={cancelLoading}
      />

      {/* KYC VERIFICATION MODAL */}
      {showKYCModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-amber-500/30 p-6 rounded-xl w-full max-w-md space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <ShieldAlert className="w-8 h-8" />
              <h2 className="text-xl font-semibold">KYC Verification Required</h2>
            </div>

            <p className="text-sm text-muted-foreground">
              You need to complete KYC verification before you can access job details.
            </p>

            <p className="text-sm text-muted-foreground">
              Please complete your KYC verification in your profile settings to access all freelancer features.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => router.push("/freelancer")}
                className="px-4 py-2 border rounded-lg hover:bg-surface-secondary transition"
              >
                Back to Dashboard
              </button>

              <button
                onClick={() => router.push("/freelancer/Profile")}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
              >
                Go to Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ============================================================
   TIMELINE CARD
============================================================ */
function TimelineCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-xl border bg-surface-secondary space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

/* ============================================================
   DELIVER MODAL
============================================================ */
function DeliverModal({
  open,
  onClose,
  onSubmit,
  deliverLink,
  setDeliverLink,
  deliverNotes,
  setDeliverNotes,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  deliverLink: string;
  setDeliverLink: (v: string) => void;
  deliverNotes: string;
  setDeliverNotes: (v: string) => void;
  loading: boolean;
}) {
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="w-full max-w-lg bg-surface p-6 rounded-2xl border shadow-xl space-y-6"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
        >
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Send className="w-5 h-5" />
            Deliver Work
          </h2>

          <div>
            <label className="text-sm font-medium">Delivery Link</label>
            <input
              value={deliverLink}
              onChange={(e) => setDeliverLink(e.target.value)}
              placeholder="https://..."
              className="w-full mt-1 px-3 py-2 rounded-md border bg-background"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Notes (optional)</label>
            <textarea
              rows={4}
              value={deliverNotes}
              onChange={(e) => setDeliverNotes(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-md border bg-background resize-none"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md border bg-surface-secondary"
            >
              Close
            </button>

            <button
              disabled={loading}
              onClick={onSubmit}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground"
            >
              {loading ? "Submitting..." : "Submit Work"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ============================================================
   CANCEL MODAL
============================================================ */
function CancelModal({
  open,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  loading: boolean;
}) {
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="w-full max-w-md bg-surface p-6 rounded-2xl border shadow-xl space-y-6"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
        >
          <h2 className="text-xl font-semibold">Request Cancellation</h2>

          <p className="text-sm text-muted-foreground">
            You are requesting a cancellation.
            The client must accept it before the job is fully cancelled.
          </p>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md border bg-surface-secondary"
            >
              Close
            </button>

            <button
              disabled={loading}
              onClick={onSubmit}
              className="px-4 py-2 rounded-md bg-amber-600 text-white"
            >
              {loading ? "Requesting..." : "Request Cancel"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
