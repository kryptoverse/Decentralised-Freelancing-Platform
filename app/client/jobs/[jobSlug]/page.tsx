"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  DollarSign,
  Clock,
  Tag,
  Users,
  Loader2,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Send,
  Flag,
} from "lucide-react";

import {
  getContract,
  readContract,
  prepareContractCall,
  sendTransaction,
} from "thirdweb";
import { getWalletBalance } from "thirdweb/wallets";
import {
  useActiveAccount,
  useConnectionManager,
} from "thirdweb/react";
import { motion, AnimatePresence } from "framer-motion";

import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { ipfsToHttp } from "@/utils/ipfs";
import { supabase } from "@/lib/supabase";
import { useIPFSUpload } from "@/hooks/useIPFSUpload";

import HireSuccessModal from "@/components/client/HireSuccessModal";
import DisputeModal from "@/components/modals/DisputeModal";

/* ============================================================
   TYPES
============================================================ */
interface Job {
  jobId: number;
  client: string;
  title: string;
  budgetUSDC: bigint;
  status: number;
  createdAt: bigint;
  expiresAt: bigint;
  tags: string[];
  hiredFreelancer?: string;
  escrowAddress?: string;
}

interface Applicant {
  freelancer: string;
  appliedAt: bigint;
  proposalText: string;
  bidAmount: bigint;
  deliveryDays: bigint;
}

interface Delivery {
  uri: string;
  timestamp: bigint;
  version: bigint;
  deliveryLink?: string;
  notes?: string;
}

interface EscrowData {
  escrowAddr: string;
  cancelEnd: bigint;
  deliveryDue: bigint;
  reviewDue: bigint;
  delivered: boolean;
  disputed: boolean;
  terminal: boolean;
  cancelRequestedBy: string;
  lastDeliveryURI: string;
  deliveryLink?: string;
  deliveryNotes?: string;
  deliveryHistory: Delivery[];
}

/* ============================================================
   SMALL HELPERS
============================================================ */
function formatTs(ts: bigint | number): string {
  if (!ts || Number(ts) === 0) return "—";
  return new Date(Number(ts) * 1000).toLocaleString();
}

function hexToText(hex: string): string {
  try {
    const bytes = new Uint8Array(
      hex
        .slice(2)
        .match(/.{1,2}/g)!
        .map((b) => parseInt(b, 16))
    );
    return new TextDecoder().decode(bytes).replace(/\0/g, "");
  } catch {
    return "";
  }
}

/* ============================================================
   GENERIC MODAL
============================================================ */
function Modal({ open, onClose, title, children }: any) {
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white dark:bg-neutral-900 p-6 rounded-xl max-w-xl w-full border border-neutral-800 shadow-xl"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
        >
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="px-3 py-1 text-sm rounded-md bg-neutral-200 dark:bg-neutral-800 hover:opacity-75"
            >
              Close
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto text-sm">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ============================================================
   SIMPLE TIMELINE CARD
============================================================ */
function TimelineCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-xl border bg-neutral-900/70 space-y-1">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

/* ============================================================
   REVIEW MODAL (Approve Work)
============================================================ */
function ReviewModal({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (rating: number) => Promise<void>;
  loading: boolean;
}) {
  const [rating, setRating] = useState<number>(5);
  const [note, setNote] = useState("");

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white dark:bg-neutral-900 p-6 rounded-2xl max-w-md w-full border border-neutral-800 shadow-xl space-y-5"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
        >
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            Approve Work
          </h2>

          <p className="text-sm text-neutral-400">
            Rate the delivered work (1–5). This rating will be recorded in the
            freelancer’s on-chain reputation.
          </p>

          <div>
            <p className="text-xs text-neutral-400 mb-1">Rating</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`w-10 h-10 rounded-full border flex items-center justify-center text-sm ${rating >= star
                    ? "bg-amber-400 text-black border-amber-300"
                    : "bg-neutral-900 text-neutral-400 border-neutral-700"
                    }`}
                >
                  {star}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-neutral-400 mb-1">
              Optional feedback (off-chain, just for your records)
            </p>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 rounded-md border bg-neutral-900 text-sm resize-none"
              placeholder="What went well? Anything to improve?"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md border bg-neutral-900 text-sm"
            >
              Cancel
            </button>
            <button
              disabled={loading}
              onClick={() => onConfirm(rating)}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-60"
            >
              {loading ? "Approving..." : "Approve & Release Payment"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ============================================================
   HIRED JOB HEADER (basic info & explorer)
============================================================ */
function HiredJobView({ job }: { job: Job }) {
  if (!job.hiredFreelancer || !job.escrowAddress) return null;

  return (
    <section className="p-6 border rounded-2xl bg-neutral-900 text-white space-y-4">
      <h2 className="text-xl font-bold">Job In Progress</h2>

      <p className="text-sm text-neutral-400">
        This job has been assigned and is now in progress.
      </p>

      <div className="space-y-3 mt-2 text-sm">
        <div>
          <p className="text-xs text-neutral-500">Freelancer</p>
          <p className="font-mono break-all">{job.hiredFreelancer}</p>
        </div>

        <div>
          <p className="text-xs text-neutral-500">Escrow Contract</p>
          <p className="font-mono break-all">{job.escrowAddress}</p>
        </div>
      </div>

      <button
        className="w-full py-2 bg-primary rounded-xl text-white hover:opacity-80 mt-4 text-sm"
        onClick={() =>
          window.open(
            `https://amoy.polygonscan.com/address/${job.escrowAddress}`,
            "_blank"
          )
        }
      >
        View Escrow on Explorer
      </button>
    </section>
  );
}

/* ============================================================
   HELPER FUNCTIONS
============================================================ */
// Note: updateAccount might not be available in all thirdweb versions
// We'll try to use it, but if it fails, we'll continue with the current wallet config
async function enableSponsoredGas(connectionManager: any) {
  try {
    if (connectionManager.updateAccount) {
      await connectionManager.updateAccount({
        chain: CHAIN,
        sponsorGas: true,
      });
    }
  } catch (err) {
    console.warn("Could not enable sponsored gas:", err);
    // Continue anyway - wallet might already be configured correctly
  }
}

async function disableSponsoredGas(connectionManager: any) {
  try {
    if (connectionManager.updateAccount) {
      await connectionManager.updateAccount({
        chain: CHAIN,
        sponsorGas: false,
      });
    }
  } catch (err) {
    console.warn("Could not disable sponsored gas:", err);
    // Continue anyway - wallet might need native tokens for gas
  }
}

/* ============================================================
   MAIN PAGE
============================================================ */
export default function JobAnalyticsPage() {
  const router = useRouter();
  const { jobSlug } = useParams<{ jobSlug: string }>();

  const activeAccount = useActiveAccount();
  const connectionManager = useConnectionManager();
  const { uploadMetadata } = useIPFSUpload();

  const [job, setJob] = useState<Job | null>(null);
  const [description, setDescription] = useState("");
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [usdtBalance, setUsdtBalance] = useState<bigint>(0n);

  const [hiring, setHiring] = useState(false);
  const [selectedApplicant, setSelectedApplicant] =
    useState<Applicant | null>(null);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);

  // Escrow-related state
  const [escrowData, setEscrowData] = useState<EscrowData | null>(null);
  const [selectedDeliveryVersion, setSelectedDeliveryVersion] = useState<number | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [disputeModal, setDisputeModal] = useState(false);
  const [errorModal, setErrorModal] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: "", message: "" });

  /** SUCCESS MODAL */
  const [successOpen, setSuccessOpen] = useState(false);
  const [successInfo, setSuccessInfo] = useState<any>(null);

  /** JOB ID from slug */
  const jobId: bigint = useMemo(() => {
    if (!jobSlug) return 0n;
    try {
      return BigInt(jobSlug.split("-")[0]);
    } catch {
      return 0n;
    }
  }, [jobSlug]);

  const smartAddress = activeAccount?.address ?? "";

  const isClient =
    job &&
    smartAddress &&
    smartAddress.toLowerCase() === job.client.toLowerCase();

  const isJobOpen = job && job.status === 1;

  /* ============================================================
      HELPER: upload JSON to IPFS (for dispute reasons)
  ============================================================ */
  async function uploadJSON(data: any, suffix = "dispute"): Promise<string> {
    const walletPrefix = smartAddress
      ? smartAddress.replace("0x", "").toLowerCase().slice(0, 10)
      : "client";

    return uploadMetadata(data, {
      name: `${walletPrefix}_${suffix}`,
    });
  }

  /* ============================================================
      LOAD USDT BALANCE (client smart wallet)
  ============================================================ */
  useEffect(() => {
    if (!smartAddress) return;

    (async () => {
      try {
        const usdt = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.MockUSDT,
        });

        const raw = (await readContract({
          contract: usdt,
          method: "function balanceOf(address) view returns (uint256)",
          params: [smartAddress],
        })) as bigint;

        setUsdtBalance(raw);
      } catch (err) {
        console.error("USDT balance error:", err);
      }
    })();
  }, [smartAddress]);

  /* ============================================================
      HIRING FLOW (same as before)
  ============================================================ */
  async function handleHire(app: Applicant) {
    if (!job || !isClient) return;

    setHiring(true);

    try {
      const bidAmount = BigInt(app.bidAmount);

      const account = activeAccount;
      if (!account) {
        setErrorModal({
          open: true,
          title: "Wallet Not Ready",
          message: "Your smart wallet is not connected. Please refresh the page and try again.",
        });
        return;
      }

      const walletAddress = account.address as `0x${string}`;

      // 1) Check native token balance (MATIC) for gas fees
      try {
        const nativeBalance = await getWalletBalance({
          client,
          chain: CHAIN,
          address: walletAddress,
        });

        // Minimum 0.01 MATIC recommended for transactions
        const minRequired = BigInt("10000000000000000"); // 0.01 MATIC
        if (nativeBalance.value < minRequired) {
          setErrorModal({
            open: true,
            title: "Insufficient Gas (MATIC)",
            message: `Your smart wallet does not have enough MATIC to pay for gas fees.\n\nWallet: ${walletAddress}\nCurrent: ${(Number(nativeBalance.value) / 1e18).toFixed(4)} MATIC\nRecommended: At least 0.01 MATIC\n\nPlease send MATIC to your wallet and try again.`,
          });
          return;
        }
      } catch (err) {
        console.warn("Could not check native balance:", err);
        // Continue anyway - might be gas sponsored
      }

      // 2) Turn OFF gas sponsorship so hiring is paid by user
      await disableSponsoredGas(connectionManager);

      // 3) Check USDT balance
      const usdt = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.MockUSDT,
      });

      const balance = (await readContract({
        contract: usdt,
        method: "function balanceOf(address) view returns (uint256)",
        params: [walletAddress],
      })) as bigint;

      if (balance < bidAmount) {
        setErrorModal({
          open: true,
          title: "Insufficient USDT",
          message: `Your smart wallet does not have enough USDT to hire this freelancer.\n\nWallet: ${walletAddress}\nRequired: ${Number(bidAmount) / 1e6
            } USDT\nCurrent: ${(Number(balance) / 1e6).toFixed(
              2
            )} USDT\n\nPlease send additional USDT to your wallet and try again.`,
        });
        return;
      }

      // 4) Approve USDT
      const approveTx = prepareContractCall({
        contract: usdt,
        method: "function approve(address,uint256)",
        params: [DEPLOYED_CONTRACTS.addresses.EscrowFactory, bidAmount],
      });

      try {
        await sendTransaction({
          account,
          transaction: approveTx,
        });
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        if (errorMsg.includes("insufficient funds") || errorMsg.includes("gas")) {
          setErrorModal({
            open: true,
            title: "Transaction Failed - Insufficient Gas",
            message: `Your wallet does not have enough MATIC to pay for gas fees.\n\nWallet: ${walletAddress}\n\nPlease send MATIC to your wallet and try again.`,
          });
          return;
        }
        throw err;
      }

      // 5) Create escrow + mark job as hired
      const escrowFactory = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.EscrowFactory,
      });

      const now = Math.floor(Date.now() / 1000);

      const createTx = prepareContractCall({
        contract: escrowFactory,
        method:
          "function createAndFundEscrowForJob(uint256,address,uint256,string,uint64,uint64,uint64,uint8)",
        params: [
          jobId,
          app.freelancer,
          bidAmount,
          "",
          86400n, // 1d cancel window
          BigInt(now + Number(app.deliveryDays) * 86400), // delivery from proposal
          172800n, // 2d review window
          5, // default rating for auto-approve
        ],
      });

      try {
        const hireTx = await sendTransaction({
          account,
          transaction: createTx,
        });
        console.log("Hire tx:", hireTx.transactionHash);
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        if (errorMsg.includes("insufficient funds") || errorMsg.includes("gas")) {
          setErrorModal({
            open: true,
            title: "Transaction Failed - Insufficient Gas",
            message: `Your wallet does not have enough MATIC to pay for gas fees.\n\nWallet: ${walletAddress}\n\nPlease send MATIC to your wallet and try again.`,
          });
          return;
        }
        throw err;
      }

      setSuccessInfo({
        freelancer: app.freelancer,
        amount: Number(app.bidAmount) / 1e6,
      });
      setSuccessOpen(true);

      // reload job state (will now be Hired)
      router.refresh();
    } catch (err) {
      console.error("Hire error:", err);
      const errorMsg = err instanceof Error ? err.message : String(err);

      // Check for common error patterns
      let title = "Hire Failed";
      let message = errorMsg || "We couldn't complete the hire transaction. Please try again.";

      if (errorMsg.includes("insufficient funds") || errorMsg.includes("gas")) {
        title = "Insufficient Gas (MATIC)";
        message = `Your wallet does not have enough MATIC to pay for gas fees.\n\nPlease send MATIC to your wallet and try again.`;
      } else if (errorMsg.includes("user rejected") || errorMsg.includes("denied")) {
        title = "Transaction Cancelled";
        message = "You cancelled the transaction. No changes were made.";
      } else if (errorMsg.includes("USDT") || errorMsg.includes("balance")) {
        title = "Insufficient USDT";
        message = `Your wallet does not have enough USDT for this transaction.\n\n${errorMsg}`;
      }

      setErrorModal({
        open: true,
        title,
        message,
      });
    } finally {
      // Restore sponsored gas (if it was changed)
      await enableSponsoredGas(connectionManager);
      setHiring(false);
    }
  }

  /* ============================================================
      LOAD JOB DETAILS
  ============================================================ */
  useEffect(() => {
    if (jobId === 0n) return;

    (async () => {
      try {
        const jobBoard = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.JobBoard,
        });

        const data = await readContract({
          contract: jobBoard,
          method:
            "function getJob(uint256) view returns (address,string,string,uint256,uint8,address,address,uint64,uint64,uint64,bytes32[],uint256)",
          params: [jobId],
        });

        const [
          clientAddr,
          title,
          descriptionURI,
          budgetUSDC,
          status,
          hiredFreelancer,
          escrowAddress,
          createdAt,
          ,
          expiresAt,
          rawTags,
        ] = data as any;

        let desc = "";
        if (descriptionURI) {
          try {
            const r = await fetch(ipfsToHttp(descriptionURI));
            const j = await r.json();
            desc = j.description ?? descriptionURI;
          } catch {
            desc = descriptionURI;
          }
        }

        const tags = (rawTags as string[])
          .map((hex) => hexToText(hex))
          .filter(Boolean);

        setJob({
          jobId: Number(jobId),
          client: clientAddr,
          title,
          budgetUSDC,
          status: Number(status),
          createdAt,
          expiresAt,
          tags,
          hiredFreelancer,
          escrowAddress,
        });

        setDescription(desc);
      } catch (e) {
        console.error("Job load error:", e);
      }
    })();
  }, [jobId]);

  /* ============================================================
      LOAD APPLICANTS
  ============================================================ */
  useEffect(() => {
    if (jobId === 0n) return;

    (async () => {
      try {
        const jobBoard = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.JobBoard,
        });

        const count = Number(
          await readContract({
            contract: jobBoard,
            method: "function getApplicantCount(uint256) view returns (uint256)",
            params: [jobId],
          })
        );

        if (count === 0) {
          setApplicants([]);
          setLoading(false);
          return;
        }

        const [freelancers] = (await readContract({
          contract: jobBoard,
          method:
            "function getApplicants(uint256,uint256,uint256) view returns (address[],uint64[])",
          params: [jobId, 0n, BigInt(count)],
        })) as [string[], bigint[]];

        const enriched: Applicant[] = [];

        for (const addr of freelancers) {
          if (!addr) continue;

          const details = await readContract({
            contract: jobBoard,
            method:
              "function getApplicantDetails(uint256,address) view returns (address,uint64,string,uint256,uint64)",
            params: [jobId, addr],
          });

          const [
            _f,
            appliedAt,
            proposalURI,
            bidAmount,
            deliveryDays,
          ] = details as any;

          let text = proposalURI;
          try {
            const r = await fetch(ipfsToHttp(proposalURI));
            const j = await r.json();
            text = j.proposal ?? proposalURI;
          } catch { }

          enriched.push({
            freelancer: addr,
            appliedAt,
            proposalText: text,
            bidAmount,
            deliveryDays,
          });
        }

        setApplicants(enriched);
      } catch (e) {
        console.error("Applicants error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [jobId]);

  /* ============================================================
      LOAD ESCROW DATA (timeline + delivery)
  ============================================================ */
  useEffect(() => {
    const escrowAddress = job?.escrowAddress;
    if (!escrowAddress) return;
    if (
      escrowAddress === "0x0000000000000000000000000000000000000000"
    )
      return;

    const assuredEscrowAddr = escrowAddress as `0x${string}`;

    let isMounted = true;

    async function fetchEscrow() {
      try {
        const escrow = getContract({
          client,
          chain: CHAIN,
          address: assuredEscrowAddr,
        });

        const [cancelEnd, deliveryDue, reviewDue] = await readContract({
          contract: escrow,
          method:
            "function currentDeadlines() view returns (uint64,uint64,uint64)",
          params: [],
        });

        const [
          delivered,
          disputed,
          terminal,
          cancelRequestedBy,
          lastDeliveryURI,
          rawHistory,
        ] = await Promise.all([
          readContract({
            contract: escrow,
            method: "function delivered() view returns (bool)",
            params: [],
          }),
          readContract({
            contract: escrow,
            method: "function disputed() view returns (bool)",
            params: [],
          }),
          readContract({
            contract: escrow,
            method: "function terminal() view returns (bool)",
            params: [],
          }),
          readContract({
            contract: escrow,
            method: "function cancelRequestedBy() view returns (address)",
            params: [],
          }),
          readContract({
            contract: escrow,
            method: "function lastDeliveryURI() view returns (string)",
            params: [],
          }),
          readContract({
            contract: escrow,
            method: "function getAllDeliveries() view returns ((string,uint64,uint256)[])",
            params: [],
          }).catch(() => []), // Fallback for old escrows without this function
        ]);

        // Parse delivery history
        const deliveryHistory: Delivery[] = [];
        if (Array.isArray(rawHistory) && (rawHistory as any[]).length > 0) {
          // New contract with delivery history
          for (const d of rawHistory) {
            const delivery: Delivery = {
              uri: d[0],
              timestamp: d[1],
              version: d[2],
            };

            // Try to fetch metadata for each delivery
            try {
              const res = await fetch(ipfsToHttp(d[0]));
              const json = await res.json();
              delivery.deliveryLink = json.deliveryLink ?? "";
              delivery.notes = json.notes ?? "";
            } catch (err) {
              console.warn(`Failed to parse delivery ${d[2]} metadata:`, err);
            }

            deliveryHistory.push(delivery);
          }
        }

        const data: EscrowData = {
          escrowAddr: assuredEscrowAddr,
          cancelEnd,
          deliveryDue,
          reviewDue,
          delivered,
          disputed,
          terminal,
          cancelRequestedBy,
          lastDeliveryURI: typeof lastDeliveryURI === 'string' ? lastDeliveryURI : '',
          deliveryHistory,
        };

        // For backward compatibility: if no history but delivered, parse lastDeliveryURI
        if (delivered && deliveryHistory.length === 0 && typeof lastDeliveryURI === 'string' && lastDeliveryURI) {
          try {
            const res = await fetch(ipfsToHttp(lastDeliveryURI as string));
            const json = await res.json();
            data.deliveryLink = json.deliveryLink ?? "";
            data.deliveryNotes = json.notes ?? "";
          } catch (err) {
            console.warn("Failed to parse delivery metadata:", err);
          }
        } else if (deliveryHistory.length > 0) {
          // Use latest delivery for quick access
          const latest = deliveryHistory[deliveryHistory.length - 1];
          data.deliveryLink = latest.deliveryLink;
          data.deliveryNotes = latest.notes;
        }

        if (isMounted) {
          setEscrowData(data);
        }
      } catch (err) {
        if (isMounted) console.error("Escrow load error:", err);
      }
    }

    fetchEscrow();
    const interval = setInterval(fetchEscrow, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [job?.escrowAddress]);

  /* ============================================================
      CLIENT ACTIONS ON ESCROW
  ============================================================ */
  async function handleApproveWork(rating: number) {
    if (!escrowData) return;

    try {
      setReviewLoading(true);

      // Turn OFF gas sponsorship
      await disableSponsoredGas(connectionManager);
      const nonGasAccount = activeAccount;
      if (!nonGasAccount) throw new Error("Smart wallet not ready.");

      if (rating < 1) rating = 1;
      if (rating > 5) rating = 5;

      const escrow = getContract({
        client,
        chain: CHAIN,
        address: escrowData.escrowAddr as `0x${string}`,
      });

      const tx = await prepareContractCall({
        contract: escrow,
        method: "function approveWork(uint8)",
        params: [rating],
      });

      await sendTransaction({
        account: nonGasAccount,
        transaction: tx,
      });

      setReviewOpen(false);
      router.refresh();
    } catch (err) {
      console.error("approveWork error:", err);
      alert("Failed to approve work.");
    } finally {
      // Restore sponsored gas
      await enableSponsoredGas(connectionManager);
      setReviewLoading(false);
    }
  }

  async function handleRequestCancel() {
    if (!escrowData) return;
    try {
      setCancelLoading(true);

      // Turn OFF gas sponsorship
      await disableSponsoredGas(connectionManager);
      const nonGasAccount = activeAccount;
      if (!nonGasAccount) throw new Error("Smart wallet not ready.");

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

      await sendTransaction({ account: nonGasAccount, transaction: tx });
      router.refresh();
    } catch (err) {
      console.error("requestCancel error:", err);
      alert("Failed to request cancel.");
    } finally {
      // Restore sponsored gas
      await enableSponsoredGas(connectionManager);
      setCancelLoading(false);
    }
  }

  async function handleAcceptCancel() {
    if (!escrowData) return;
    try {
      setCancelLoading(true);

      // Turn OFF gas sponsorship
      await disableSponsoredGas(connectionManager);
      const nonGasAccount = activeAccount;
      if (!nonGasAccount) throw new Error("Smart wallet not ready.");

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

      await sendTransaction({ account: nonGasAccount, transaction: tx });
      router.refresh();
    } catch (err) {
      console.error("acceptCancel error:", err);
      alert("Failed to accept cancel.");
    } finally {
      // Restore sponsored gas
      await enableSponsoredGas(connectionManager);
      setCancelLoading(false);
    }
  }

  async function handleRaiseDispute(reason: string) {
    if (!escrowData) return;

    try {
      setDisputeLoading(true);

      const uri = await uploadJSON({ reason });

      // Turn OFF gas sponsorship
      await disableSponsoredGas(connectionManager);
      const nonGasAccount = activeAccount;
      if (!nonGasAccount) throw new Error("Smart wallet not ready.");

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

      const transaction = await sendTransaction({ account: nonGasAccount, transaction: tx });

      // Store in Supabase
      try {
        if (job) {
          const { error: sbError } = await supabase
            .from('disputes')
            .insert({
              job_id: job.jobId.toString(),
              disputer_address: nonGasAccount.address,
              dispute_reason_uri: uri,
              transaction_hash: transaction.transactionHash,
            });

          if (sbError) {
            console.error("Supabase insert error:", sbError);
          }
        }
      } catch (err) {
        console.error("Failed to save dispute to DB:", err);
      }

      setDisputeModal(false);
      router.refresh();
    } catch (err) {
      console.error("raiseDispute error:", err);
      alert("Failed to raise dispute.");
      throw err; // Re-throw to let modal handle error state
    } finally {
      // Restore sponsored gas
      await enableSponsoredGas(connectionManager);
      setDisputeLoading(false);
    }
  }

  /* ============================================================
      RENDER
  ============================================================ */
  if (!activeAccount)
    return <main className="p-8">Connect wallet to continue.</main>;

  if (!job)
    return (
      <main className="p-8 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </main>
    );

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-10">

      {/* Hire Success Popup */}
      <HireSuccessModal
        open={successOpen}
        freelancer={successInfo?.freelancer}
        amount={successInfo?.amount}
        onClose={() => setSuccessOpen(false)}
      />

      {/* Back */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Smart Wallet Info */}
      {isClient && (
        <section className="p-4 border rounded-xl bg-neutral-900 text-white space-y-2">
          <h2 className="text-lg font-semibold">Your Smart Wallet</h2>

          <p className="text-xs text-neutral-400">Address:</p>
          <div className="p-2 bg-neutral-800 rounded-md text-xs font-mono break-all">
            {smartAddress}
          </div>

          <p className="text-xs text-neutral-400 mt-2">USDT Balance:</p>
          <span className="text-sm font-bold">
            {(Number(usdtBalance) / 1e6).toFixed(6)} USDT
          </span>
        </section>
      )}

      {/* Job Overview */}
      <section className="p-6 border rounded-2xl bg-neutral-900/60 space-y-4">
        <h1 className="text-3xl font-bold">{job.title}</h1>

        <div className="flex gap-4 text-sm text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <DollarSign className="w-4 h-4" />
            {(Number(job.budgetUSDC) / 1e6).toFixed(2)} USDT
          </span>

          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            Posted: {formatTs(job.createdAt)}
          </span>
        </div>

        {/* Tags */}
        {job.tags.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {job.tags.map((t, i) => (
              <span
                key={i}
                className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full border border-primary/30 flex items-center gap-1"
              >
                <Tag className="w-3 h-3" />
                {t}
              </span>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowDescriptionModal(true)}
          className="px-3 py-2 bg-neutral-800/70 text-white rounded-md text-sm hover:opacity-80 inline-flex items-center gap-2 mt-2"
        >
          <FileText className="w-4 h-4" />
          View Full Description
        </button>
      </section>

      {/* Hired header card */}
      {job.status === 2 && <HiredJobView job={job} />}

      {/* Escrow Section – timeline + work + actions */}
      {job.status === 2 && escrowData && (
        <section className="p-6 border rounded-2xl bg-neutral-900/80 space-y-6">
          <h2 className="text-xl font-bold">Work & Escrow</h2>

          {/* Timeline */}
          <div className="grid sm:grid-cols-2 gap-4">
            <TimelineCard
              label="Client Cancel Window Ends"
              value={formatTs(escrowData.cancelEnd)}
            />
            <TimelineCard
              label="Delivery Deadline"
              value={formatTs(escrowData.deliveryDue)}
            />
            <TimelineCard
              label="Client Review Deadline"
              value={
                escrowData.reviewDue === 0n
                  ? "Not started (no delivery yet)"
                  : formatTs(escrowData.reviewDue)
              }
            />
          </div>

          {/* Status banners */}
          {escrowData.disputed && (
            <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 flex items-center gap-2 text-sm">
              <Flag className="w-4 h-4" />
              This job is currently in dispute. Further actions might be handled
              by the resolver.
            </div>
          )}

          {escrowData.cancelRequestedBy !==
            "0x0000000000000000000000000000000000000000" && (
              <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4" />
                {escrowData.cancelRequestedBy.toLowerCase() ===
                  smartAddress.toLowerCase()
                  ? "You requested a cancellation. Waiting for the freelancer to accept."
                  : "The freelancer requested to cancel this job. You can accept to refund the remaining funds."}
              </div>
            )}

          {/* Work Delivery */}
          <div className="p-4 rounded-xl border bg-neutral-950/60 space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Send className="w-5 h-5" />
              Work Delivery
              {escrowData.deliveryHistory.length > 0 && (
                <span className="text-sm font-normal text-neutral-400">
                  ({escrowData.deliveryHistory.length} version{escrowData.deliveryHistory.length !== 1 ? 's' : ''})
                </span>
              )}
            </h3>

            {!escrowData.delivered || escrowData.deliveryHistory.length === 0 ? (
              <p className="text-sm text-neutral-400">
                The freelancer has not submitted any work yet. Once they do, the
                delivery details will appear here.
              </p>
            ) : (
              <>
                {/* Version Tabs */}
                {escrowData.deliveryHistory.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {escrowData.deliveryHistory.map((delivery, idx) => {
                      const isLatest = idx === escrowData.deliveryHistory.length - 1;
                      const isSelected = selectedDeliveryVersion === idx || (selectedDeliveryVersion === null && isLatest);

                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedDeliveryVersion(idx)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                            }`}
                        >
                          Version {delivery.version.toString()}
                          {isLatest && (
                            <span className="ml-2 px-1.5 py-0.5 text-xs bg-emerald-500 text-white rounded">
                              Latest
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Selected Delivery Content */}
                {(() => {
                  const selectedIdx = selectedDeliveryVersion ?? escrowData.deliveryHistory.length - 1;
                  const selectedDelivery = escrowData.deliveryHistory[selectedIdx];
                  const isLatest = selectedIdx === escrowData.deliveryHistory.length - 1;

                  if (!selectedDelivery) return null;

                  return (
                    <div className="space-y-3">
                      {/* Version Info Banner */}
                      <div className={`p-3 rounded-lg border ${isLatest
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                        }`}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">
                            {isLatest ? '✓ Latest Submission' : `Previous Version ${selectedDelivery.version.toString()}`}
                          </span>
                          <span className="text-xs">
                            {formatTs(selectedDelivery.timestamp)}
                          </span>
                        </div>
                      </div>

                      {/* Delivery Link */}
                      {selectedDelivery.deliveryLink && (
                        <div>
                          <p className="text-xs text-neutral-500 mb-1">
                            Delivery Link
                          </p>
                          <a
                            href={selectedDelivery.deliveryLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-primary hover:underline break-all"
                          >
                            {selectedDelivery.deliveryLink}
                          </a>
                        </div>
                      )}

                      {/* Delivery Notes */}
                      {selectedDelivery.notes && (
                        <div>
                          <p className="text-xs text-neutral-500 mb-1">Notes</p>
                          <p className="text-sm whitespace-pre-wrap text-neutral-200">
                            {selectedDelivery.notes}
                          </p>
                        </div>
                      )}

                      {/* Raw IPFS Link */}
                      <div>
                        <p className="text-xs text-neutral-500 mb-1">IPFS Metadata</p>
                        <a
                          href={ipfsToHttp(selectedDelivery.uri)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-neutral-400 hover:text-primary hover:underline break-all"
                        >
                          {selectedDelivery.uri}
                        </a>
                      </div>

                      {/* Action Buttons - Only show for latest version */}
                      {isLatest && isClient && !escrowData.terminal && !escrowData.disputed && (
                        <div className="flex flex-col sm:flex-row gap-3 mt-4 pt-4 border-t border-neutral-800">
                          <button
                            onClick={() => setReviewOpen(true)}
                            className="flex-1 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
                          >
                            Approve Work & Release Payment
                          </button>

                          <button
                            disabled={disputeLoading}
                            onClick={() => setDisputeModal(true)}
                            className="flex-1 px-4 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30 text-sm disabled:opacity-60 hover:bg-red-500/20 transition"
                          >
                            Raise Dispute
                          </button>
                        </div>
                      )}

                      {/* Info for viewing older versions */}
                      {!isLatest && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-400">
                          <p className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            You are viewing an older version. Switch to the latest version to approve or dispute.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          {/* Cancellation controls - Commented out for future implementation */}
          {/* {isClient && !escrowData.terminal && (
            <div className="p-4 rounded-xl border bg-neutral-950/60 space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Cancellation
              </h3>

              <p className="text-sm text-neutral-400">
                You can request a mutual cancellation, or accept a cancellation
                requested by the freelancer. Funds will be refunded from escrow
                according to the contract rules.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mt-3">
                {escrowData.cancelRequestedBy ===
                  "0x0000000000000000000000000000000000000000" && (
                    <button
                      disabled={cancelLoading}
                      onClick={handleRequestCancel}
                      className="flex-1 px-4 py-2 rounded-xl bg-neutral-800 text-sm disabled:opacity-60"
                    >
                      {cancelLoading ? "Requesting..." : "Request Cancel"}
                    </button>
                  )}

                {escrowData.cancelRequestedBy &&
                  escrowData.cancelRequestedBy.toLowerCase() !==
                  smartAddress.toLowerCase() &&
                  escrowData.cancelRequestedBy !==
                  "0x0000000000000000000000000000000000000000" && (
                    <button
                      disabled={cancelLoading}
                      onClick={handleAcceptCancel}
                      className="flex-1 px-4 py-2 rounded-xl bg-amber-600 text-white text-sm disabled:opacity-60"
                    >
                      {cancelLoading ? "Accepting..." : "Accept Cancel Request"}
                    </button>
                  )}
              </div>
            </div>
          )} */}
        </section>
      )}

      {/* Applicants (only while job is still open) */}
      {isJobOpen && (
        <section className="p-6 border rounded-2xl bg-neutral-900/60 space-y-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" /> Applicants ({applicants.length})
          </h2>

          {loading ? (
            <div className="flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : applicants.length === 0 ? (
            <p className="text-muted-foreground text-sm">No applicants yet.</p>
          ) : (
            applicants.map((app, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="border p-4 rounded-xl bg-neutral-950/40 space-y-3"
              >
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <span className="font-mono text-xs sm:text-sm">
                    {app.freelancer.slice(0, 8)}...
                    {app.freelancer.slice(-6)}
                  </span>

                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        router.push(`/freelancer/${app.freelancer}`)
                      }
                      className="px-3 py-1 text-xs sm:text-sm rounded-md bg-primary/10 text-primary border border-primary/30 hover:opacity-80"
                    >
                      View Profile
                    </button>

                    <button
                      onClick={() => setSelectedApplicant(app)}
                      className="px-3 py-1 text-xs sm:text-sm bg-neutral-800/70 text-white rounded-md hover:opacity-80"
                    >
                      View Proposal
                    </button>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Applied on: {formatTs(app.appliedAt)}
                </div>

                {isClient && (
                  <button
                    disabled={hiring}
                    onClick={() => handleHire(app)}
                    className="w-full py-2 bg-primary text-white rounded-md hover:opacity-80 disabled:opacity-60 text-sm"
                  >
                    {hiring ? "Hiring..." : "Hire Freelancer"}
                  </button>
                )}
              </motion.div>
            ))
          )}
        </section>
      )}

      {/* Description Modal */}
      <Modal
        open={showDescriptionModal}
        onClose={() => setShowDescriptionModal(false)}
        title="Job Description"
      >
        {description || "No description provided."}
      </Modal>

      {/* Applicant Proposal Modal */}
      <Modal
        open={!!selectedApplicant}
        onClose={() => setSelectedApplicant(null)}
        title="Applicant Proposal"
      >
        {selectedApplicant && (
          <>
            <div className="flex justify-between items-center mb-3">
              <span className="font-mono text-xs">
                {selectedApplicant.freelancer}
              </span>
              <button
                onClick={() =>
                  router.push(`/freelancer/${selectedApplicant.freelancer}`)
                }
                className="px-3 py-1 text-xs rounded-md bg-primary/10 text-primary border border-primary/30 hover:opacity-80"
              >
                View Profile
              </button>
            </div>

            <p className="text-sm whitespace-pre-wrap mb-3">
              {selectedApplicant.proposalText}
            </p>

            <p className="text-sm text-muted-foreground">
              Bid: {(Number(selectedApplicant.bidAmount) / 1e6).toFixed(2)} USDT
            </p>

            <p className="text-sm text-muted-foreground mb-4">
              Delivery: {selectedApplicant.deliveryDays.toString()} days
            </p>
          </>
        )}
      </Modal>

      {/* Review / Approve Modal */}
      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onConfirm={handleApproveWork}
        loading={reviewLoading}
      />

      <Modal
        open={errorModal.open}
        onClose={() => setErrorModal({ open: false, title: "", message: "" })}
        title={errorModal.title || "Notice"}
      >
        <p className="whitespace-pre-line text-sm text-muted-foreground">
          {errorModal.message}
        </p>
        <button
          onClick={() => setErrorModal({ open: false, title: "", message: "" })}
          className="mt-4 w-full py-2 rounded-md bg-primary text-primary-foreground"
        >
          Okay
        </button>
      </Modal>

      <DisputeModal
        open={disputeModal}
        onClose={() => setDisputeModal(false)}
        onSubmit={handleRaiseDispute}
      />
    </main>
  );
}
