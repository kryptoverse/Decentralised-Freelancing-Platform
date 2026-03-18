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
import { getWalletBalance, smartWallet } from "thirdweb/wallets";
import {
  useActiveAccount,
  useActiveWallet,
} from "thirdweb/react";
import { motion, AnimatePresence } from "framer-motion";

import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { ipfsToHttp } from "@/utils/ipfs";
import { useIPFSUpload } from "@/hooks/useIPFSUpload";

import HireSuccessModal from "@/components/client/HireSuccessModal";
import DisputeModal from "@/components/modals/DisputeModal";
import DisputeInfoPanel from "@/components/disputes/DisputeInfoPanel";

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
  lastDisputeURI: string;
  deliveryLink?: string;
  deliveryNotes?: string;
  deliveryHistory: Delivery[];
}

/* ============================================================
   SMALL HELPERS
============================================================ */
function getFriendlyError(err: any): string {
  const msg = err?.message || String(err);
  if (msg.includes("AA21") || msg.includes("AA11") || msg.includes("insufficient funds") || msg.includes("didn't pay prefund")) {
    return "Transaction failed: Your SMART WALLET is low on gas tokens (MATIC). The funds must be inside your Smart Wallet address, not just your personal MetaMask. Please copy your Smart Wallet address and send MATIC to it.";
  }
  if (msg.includes("User denied")) {
    return "Transaction was cancelled by the user.";
  }
  return msg.length > 100 ? msg.substring(0, 100) + "..." : msg;
}

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
  anticipatedDestination,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (rating: number) => Promise<void>;
  loading: boolean;
  anticipatedDestination?: string;
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

          {anticipatedDestination && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-start gap-3">
              <div className="mt-0.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">Funds Release Destination</p>
                <p className="text-xs text-emerald-500/80 mb-1">When approved, funds will automatically route to:</p>
                <a href={`https://amoy.polygonscan.com/address/${anticipatedDestination}`} target="_blank" rel="noopener noreferrer" className="text-sm font-mono text-emerald-300 hover:underline break-all">
                  {anticipatedDestination}
                </a>
              </div>
            </div>
          )}

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

/* ============================================================
   MAIN PAGE
============================================================ */
export default function JobAnalyticsPage() {
  const router = useRouter();
  const { jobSlug } = useParams<{ jobSlug: string }>();

  const activeAccount = useActiveAccount();
  const activeWallet = useActiveWallet();
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
  const [destinationAddress, setDestinationAddress] = useState<string>("");

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
      DYNAMIC EXECUTION ACCOUNT HELPER
      Creates a separate smart wallet instance for current session
      but with sponsorship OFF.
  ============================================================ */
  async function getExecutionAccount() {
    const wallet = activeWallet;
    if (!wallet) throw new Error("No active wallet found. Please reconnect.");

    // For in-app wallets, get the actual underlying personal account
    const personalAccount = (wallet as any).getPersonalWallet?.()?.getAccount?.() || (wallet as any).getAdminAccount?.();

    if (!personalAccount) throw new Error("Could not find underlying personal account. Please log in again.");

    const execWallet = smartWallet({
      chain: CHAIN,
      sponsorGas: false,
    });

    const execAccount = await execWallet.connect({
      client,
      personalAccount,
    });

    return execAccount;
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
      HIRING FLOW
      Uses a non-sponsored execution account (sponsorGas: false)
      built from the same inAppWallet session via getExecutionAccount().
      createAndFundEscrowForJob deploys a Escrow contract internally
      so we keep gas: 4M to cover the CREATE opcode overhead.
  ============================================================ */
  async function handleHire(app: Applicant) {
    if (!job || !isClient) return;

    setHiring(true);

    try {
      const bidAmount = BigInt(app.bidAmount);

      // Verify the connected account exists
      if (!activeAccount) {
        setErrorModal({
          open: true,
          title: "Wallet Not Ready",
          message: "Your smart wallet is not connected. Please refresh the page and try again.",
        });
        return;
      }

      // 2) Use a newly generated execution account with sponsorship OFF
      //    so we can specify explicit gas limits and pay with our own MATIC
      let hireAccount: any;
      try {
        hireAccount = await getExecutionAccount();
      } catch (execErr: any) {
        console.warn("[HIRE] Failed to get execution account. Falling back to activeAccount.", execErr);
        hireAccount = activeAccount;
      }

      // Smart wallet address is the same for both sponsored and non-sponsored accounts
      const walletAddress = hireAccount.address as `0x${string}`;
      console.log("[HIRE] Starting hire flow");
      console.log("[HIRE] Smart wallet address:", walletAddress);
      console.log("[HIRE] Freelancer:", app.freelancer);
      console.log("[HIRE] Bid amount:", bidAmount.toString(), "(raw)", Number(bidAmount) / 1e6, "USDT");
      console.log("[HIRE] JobId:", jobId.toString());

      // 2) Check USDT balance
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
          message: `Your smart wallet does not have enough USDT.\n\nWallet: ${walletAddress}\nRequired: ${Number(bidAmount) / 1e6} USDT\nCurrent: ${(Number(balance) / 1e6).toFixed(2)} USDT`,
        });
        return;
      }

      // 3) Approve USDT to EscrowFactory
      //    Standard ERC-20 approve — ~50k gas, no issue with paymaster
      const approveTx = prepareContractCall({
        contract: usdt,
        method: "function approve(address,uint256)",
        params: [DEPLOYED_CONTRACTS.addresses.EscrowFactory, bidAmount],
        gas: 80000n,   // explicit gas — bypasses paymaster estimation
      });

      try {
        await sendTransaction({ account: hireAccount, transaction: approveTx });
        console.log("[HIRE] USDT approved successfully");
      } catch (err: any) {
        console.error("USDT approve error", err);
        throw err;
      }

      // 4) Create escrow + mark job as hired
      //    This internally deploys a new Escrow contract (CREATE opcode).
      //    Actual gas used ~2.67M. We set gas = 4M to be safe and prevent
      //    the bundler from capping at a stale estimate and causing UserOp failure.
      const escrowFactory = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.EscrowFactory,
      });

      const now = Math.floor(Date.now() / 1000);
      const deliveryDays = Number(app.deliveryDays) > 0 ? Number(app.deliveryDays) : 7;

      const createTx = prepareContractCall({
        contract: escrowFactory,
        method: "function createAndFundEscrowForJob(uint256,address,uint256,string,uint64,uint64,uint64,uint8)",
        params: [
          jobId,
          app.freelancer as `0x${string}`,
          bidAmount,
          "",
          86400n,                                   // 1d cancel window
          BigInt(now + deliveryDays * 86400),       // delivery deadline
          172800n,                                  // 2d review window
          5,                                        // auto-approve rating
        ],
        // Explicit gas limit — prevents bundler under-estimation for CREATE opcode.
        // createAndFundEscrowForJob deploys a Escrow contract which takes ~2.67M gas.
        // Adding headroom so the UserOp succeeds even with EIP-150 overhead.
        gas: 4000000n,
      });

      try {
        const hireTx = await sendTransaction({ account: hireAccount as any, transaction: createTx });
        console.log("[HIRE] Hire tx:", hireTx.transactionHash);
      } catch (err: any) {
        console.error("Hire transaction error", err);
        throw err;
      }

      setSuccessInfo({
        freelancer: app.freelancer,
        amount: Number(app.bidAmount) / 1e6,
      });
      setSuccessOpen(true);
      router.refresh();

    } catch (err: any) {
      console.error("Hire error:", err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      let title = "Hire Failed";
      let message = errorMsg || "We couldn't complete the hire transaction. Please try again.";

      if (errorMsg.includes("user rejected") || errorMsg.includes("denied")) {
        title = "Transaction Cancelled";
        message = "You cancelled the transaction.";
      } else if (errorMsg.includes("AA21") || errorMsg.includes("didn't pay prefund") || errorMsg.includes("insufficient funds")) {
        title = "Smart Wallet Needs MATIC";
        message = `To deploy the Escrow contract, your SMART WALLET needs MATIC for gas.\n\nYou might have MATIC in your personal MetaMask, but it must be sent to your Smart Wallet Address:\n\n${activeAccount?.address}\n\nPlease copy this address from the UI, send MATIC to it, and try again.`;
      }

      setErrorModal({ open: true, title, message });
    } finally {
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
          if (!addr || addr === "0x0000000000000000000000000000000000000000") continue;

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
          ] = details as [string, bigint, string, bigint, bigint];

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
          lastDisputeURI,
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
            method: "function lastDisputeURI() view returns (string)",
            params: [],
          }).catch(() => ""),
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

        // --- Fetch Destination Address ---
        // Try to figure out where the vault routes to. Read the freelancer profile -> vault
        let destAddr = job?.hiredFreelancer || "";
        try {
          if (job?.hiredFreelancer) {
            const profileC = getContract({ client, chain: CHAIN, address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory as any });
            const pAddr = await readContract({
              contract: profileC,
              method: "function freelancerProfile(address) view returns (address)",
              params: [job.hiredFreelancer]
            }) as string;
            if (pAddr && pAddr !== "0x0000000000000000000000000000000000000000") {
               const vaultC = getContract({ client, chain: CHAIN, address: pAddr as any });
               const vAddr = await readContract({
                 contract: vaultC,
                 method: "function companyVault() view returns (address)",
                 params: []
               }) as string;
               if (vAddr && vAddr !== "0x0000000000000000000000000000000000000000") {
                  destAddr = vAddr;
               }
            }
          }
        } catch(e) {}
        setDestinationAddress(destAddr);
        // ---------------------------------

        const data: EscrowData = {
          escrowAddr: assuredEscrowAddr,
          cancelEnd,
          deliveryDue,
          reviewDue,
          delivered,
          disputed,
          terminal,
          cancelRequestedBy,
          lastDeliveryURI: String(lastDeliveryURI || ""),
          lastDisputeURI: String(lastDisputeURI || ""),
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
          data.deliveryLink = latest.deliveryLink || "";
          data.deliveryNotes = latest.notes || "";
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

      const execAccount = await getExecutionAccount();

      if (rating < 1) rating = 1;
      if (rating > 5) rating = 5;

      const escrow = getContract({
        client,
        chain: CHAIN,
        address: escrowData.escrowAddr as `0x${string}`,
      });

      const tx = prepareContractCall({
        contract: escrow,
        method: "function approveWork(uint8)",
        params: [rating],
        gas: 300000n,
      });

      await sendTransaction({
        account: execAccount,
        transaction: tx,
      });

      setReviewOpen(false);
      router.refresh();
    } catch (err) {
      alert(getFriendlyError(err));
    } finally {
      setReviewLoading(false);
    }
  }

  async function handleRequestCancel() {
    if (!escrowData) return;
    try {
      setCancelLoading(true);

      const execAccount = await getExecutionAccount();

      const escrow = getContract({
        client,
        chain: CHAIN,
        address: escrowData.escrowAddr as `0x${string}`,
      });

      const tx = prepareContractCall({
        contract: escrow,
        method: "function requestCancel()",
        params: [],
        gas: 200000n,
      });

      await sendTransaction({ account: execAccount, transaction: tx });
      router.refresh();
    } catch (err) {
      alert(getFriendlyError(err));
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleAcceptCancel() {
    if (!escrowData) return;
    try {
      setCancelLoading(true);

      const execAccount = await getExecutionAccount();

      const escrow = getContract({
        client,
        chain: CHAIN,
        address: escrowData.escrowAddr as `0x${string}`,
      });

      const tx = prepareContractCall({
        contract: escrow,
        method: "function acceptCancel()",
        params: [],
        gas: 200000n,
      });

      await sendTransaction({ account: execAccount, transaction: tx });
      router.refresh();
    } catch (err) {
      alert(getFriendlyError(err));
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleRaiseDispute(reason: string) {
    if (!escrowData) return;

    try {
      setDisputeLoading(true);

      const uri = await uploadJSON({ reason });

      const execAccount = await getExecutionAccount();

      const escrow = getContract({
        client,
        chain: CHAIN,
        address: escrowData.escrowAddr as `0x${string}`,
      });

      const tx = prepareContractCall({
        contract: escrow,
        method: "function raiseDispute(string)",
        params: [uri],
        gas: 300000n,
      });

      const transaction = await sendTransaction({ account: execAccount, transaction: tx });

      setDisputeModal(false);
      router.refresh();
    } catch (err: any) {
      console.error("raiseDispute error:", err);
      if (err.message.includes("0x62e6201d") || JSON.stringify(err).includes("0x62e6201d")) {
        alert("This job has already been disputed.");
      } else {
        alert("Failed to raise dispute.");
      }
      throw err; // Re-throw to let modal handle error state
    } finally {
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
    <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-6 lg:space-y-8">
      {/* Modals placed here */}
      <HireSuccessModal open={successOpen} freelancer={successInfo?.freelancer} amount={successInfo?.amount} onClose={() => setSuccessOpen(false)} />
      <ReviewModal open={reviewOpen} onClose={() => setReviewOpen(false)} onConfirm={handleApproveWork} loading={reviewLoading} anticipatedDestination={destinationAddress} />
      <Modal open={errorModal.open} onClose={() => setErrorModal({ open: false, title: "", message: "" })} title={errorModal.title || "Notice"}>
        <p className="whitespace-pre-line text-sm text-muted-foreground">{errorModal.message}</p>
        <button onClick={() => setErrorModal({ open: false, title: "", message: "" })} className="mt-4 w-full py-2 flex justify-center rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition">Okay</button>
      </Modal>
      <DisputeModal open={disputeModal} onClose={() => setDisputeModal(false)} onSubmit={handleRaiseDispute} />
      <Modal open={!!selectedApplicant} onClose={() => setSelectedApplicant(null)} title="Applicant Proposal">
        {selectedApplicant && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-surface p-3 rounded-xl border border-border">
              <span className="font-mono text-sm font-medium">{selectedApplicant.freelancer}</span>
              <button onClick={() => router.push(`/freelancer/${selectedApplicant.freelancer}`)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition">View Profile</button>
            </div>
            <div className="bg-background border border-border rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar">
              {selectedApplicant.proposalText || "No proposal details provided."}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface p-3 rounded-xl border border-border">
                <p className="text-xs text-muted-foreground mb-1">Bid Amount</p>
                <p className="font-bold text-emerald-400 text-lg">{(Number(selectedApplicant.bidAmount) / 1e6).toFixed(2)} USDT</p>
              </div>
              <div className="bg-surface p-3 rounded-xl border border-border">
                <p className="text-xs text-muted-foreground mb-1">Estimated Delivery</p>
                <p className="font-bold text-foreground text-lg">{selectedApplicant.deliveryDays.toString()} Days</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Page Navigation Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="w-4 h-4" /> Back to Jobs
        </button>
      </div>

      <div className="space-y-6 lg:space-y-8">

        {/* Horizontal Stats Row (Client & Escrow Context) */}
        {(isClient || job.status === 2) && (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {/* Smart Wallet */}
            {isClient && (
              <div className="bg-surface border rounded-xl p-4 shadow-sm flex flex-col justify-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-2 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-emerald-500" /> Your Smart Wallet</p>
                <div className="flex justify-between items-end gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Address</p>
                    <p className="font-mono text-xs text-foreground truncate">{smartAddress}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Balance</p>
                    <p className="text-emerald-400 font-bold text-sm leading-none">{(Number(usdtBalance) / 1e6).toFixed(2)} USDT</p>
                  </div>
                </div>
              </div>
            )}

            {/* Hired Freelancer */}
            {job.status === 2 && job.hiredFreelancer && (
              <div className="bg-surface border rounded-xl p-4 shadow-sm flex flex-col justify-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-2 flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-primary" /> Hired Freelancer</p>
                <div className="flex justify-between items-center gap-2">
                  <p className="font-mono text-xs text-foreground truncate">{job.hiredFreelancer}</p>
                  <button onClick={() => router.push(`/freelancer/${job.hiredFreelancer}`)} className="shrink-0 text-[10px] font-bold uppercase bg-background border px-2.5 py-1.5 rounded-lg hover:bg-muted-foreground/10 transition text-muted-foreground shadow-sm">Profile</button>
                </div>
              </div>
            )}

            {/* Escrow Contract */}
            {job.status === 2 && job.escrowAddress && (
              <div className="bg-surface border rounded-xl p-4 shadow-sm flex flex-col justify-center sm:col-span-2 lg:col-span-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-2 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-blue-500" /> Escrow Contract</p>
                <div className="flex justify-between items-center gap-2">
                  <p className="font-mono text-xs text-foreground truncate">{job.escrowAddress}</p>
                  <button onClick={() => window.open(`https://amoy.polygonscan.com/address/${job.escrowAddress}`, "_blank")} className="shrink-0 text-[10px] font-bold uppercase bg-background border px-2.5 py-1.5 rounded-lg hover:bg-muted-foreground/10 transition text-muted-foreground shadow-sm">Explorer</button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Main Job Details Card */}
        <section className="bg-surface/30 border border-border/60 rounded-2xl p-5 md:p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold tracking-widest uppercase shadow-sm ${isJobOpen ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
              {isJobOpen ? "Open for Bids" : "In Progress"}
            </span>
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Posted {formatTs(job.createdAt)}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground leading-tight tracking-tight mb-5">{job.title}</h1>

          <div className="flex flex-wrap items-center gap-3 mb-8">
            <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl shadow-sm">
              <DollarSign className="w-4 h-4" />
              <span className="font-bold text-base md:text-lg">{(Number(job.budgetUSDC) / 1e6).toFixed(2)} USDT</span>
            </div>
            {job.tags.map((t, i) => (
              <span key={i} className="px-3 py-2 bg-surface text-muted-foreground text-xs md:text-sm font-medium rounded-xl border flex items-center gap-1.5 shadow-sm">
                <Tag className="w-3.5 h-3.5 opacity-70" /> {t}
              </span>
            ))}
          </div>

          <div className="pt-6 border-t border-border/40">
            <h3 className="text-sm font-bold tracking-wide flex items-center gap-2 text-foreground mb-3 opacity-90"><FileText className="w-4 h-4 text-primary opacity-80" /> Project Description</h3>
            <div className="text-sm md:text-base leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {description || "No description provided."}
            </div>
          </div>
        </section>

        {/* Escrow Horizontal Timeline */}
        {job.status === 2 && escrowData && (
          <section className="bg-surface border rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2 bg-background/30">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Escrow Timeline</h3>
            </div>

            <div className="p-5 overflow-x-auto custom-scrollbar">
              <div className="flex items-center min-w-[600px] justify-between relative px-4">
                {/* Connecting Line */}
                <div className="absolute top-3 left-8 right-8 h-0.5 bg-border/60 -z-10" />

                {/* Steps */}
                {[
                  { label: "Cancel Window", value: formatTs(escrowData.cancelEnd), isPast: Date.now() / 1000 > Number(escrowData.cancelEnd) && Number(escrowData.cancelEnd) > 0 },
                  { label: "Delivery Due", value: formatTs(escrowData.deliveryDue), isPast: Date.now() / 1000 > Number(escrowData.deliveryDue) && Number(escrowData.deliveryDue) > 0 },
                  { label: "Review Due", value: escrowData.reviewDue === 0n ? "Pending Delivery" : formatTs(escrowData.reviewDue), isPast: Date.now() / 1000 > Number(escrowData.reviewDue) && Number(escrowData.reviewDue) > 0 }
                ].map((step, i) => (
                  <div key={i} className="flex flex-col items-center text-center bg-surface px-2">
                    <div className={`w-6 h-6 shrink-0 rounded-full border-[3px] flex items-center justify-center mb-3 bg-background shadow-sm transition-colors ${step.isPast ? 'border-primary bg-primary/10' : 'border-border'}`}>
                      {step.isPast && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${step.isPast ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</p>
                    <p className={`text-xs font-medium ${step.isPast ? 'text-muted-foreground line-through opacity-70' : 'text-foreground'}`}>{step.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Dispute / Warning State Banners */}
            {escrowData.cancelRequestedBy !== "0x0000000000000000000000000000000000000000" && !escrowData.disputed && (
              <div className="px-5 pb-5 space-y-3">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-sm font-medium">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <p>{escrowData.cancelRequestedBy.toLowerCase() === smartAddress.toLowerCase() ? "You requested escrow cancellation. Pending freelancer acceptance." : "Freelancer requested cancellation."}</p>
                  </div>
                  {isClient && escrowData.cancelRequestedBy.toLowerCase() !== smartAddress.toLowerCase() && (
                    <button disabled={cancelLoading} onClick={handleAcceptCancel} className="w-full md:w-auto px-5 py-2 whitespace-nowrap bg-amber-500 text-[#1a1a1a] rounded-xl font-bold text-xs uppercase tracking-wider disabled:opacity-50 hover:bg-amber-400 transition shadow-sm">
                      {cancelLoading ? "Accepting..." : "Accept Cancel Request"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Dispute Info Panel */}
        {job.status === 2 && escrowData && (escrowData.disputed || escrowData.terminal) && job.hiredFreelancer && (
          <DisputeInfoPanel
            lastDisputeURI={escrowData.lastDisputeURI}
            clientAddr={smartAddress}
            freelancerAddr={job.hiredFreelancer}
            terminal={escrowData.terminal}
            delivered={escrowData.delivered}
            lastDeliveryURI={escrowData.lastDeliveryURI}
            viewerRole="client"
          />
        )}


        {/* Work Delivery View - Full Span */}
        {job.status === 2 && job.hiredFreelancer && escrowData && (
          <section className="bg-surface/30 border border-border/60 rounded-2xl p-5 md:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
                <Send className="w-5 h-5 text-primary" /> Work Submissions
              </h2>
              {escrowData.deliveryHistory.length > 0 && <span className="text-xs font-semibold bg-surface px-3 py-1 border rounded-lg text-muted-foreground shadow-sm">{escrowData.deliveryHistory.length} Version{escrowData.deliveryHistory.length !== 1 ? 's' : ''}</span>}
            </div>

            <div className="relative">
              {!escrowData.delivered || escrowData.deliveryHistory.length === 0 ? (
                <div className="text-center py-12 bg-background/50 rounded-2xl border border-dashed">
                  <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4 border border-border/50 shadow-sm">
                    <Send className="w-6 h-6 text-muted-foreground opacity-50" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">Awaiting Delivery</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">The freelancer has not submitted any work yet. Check back later to review their submissions.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Version Selector Pills */}
                  {escrowData.deliveryHistory.length > 1 && (
                    <div className="flex gap-2 p-1.5 bg-surface/80 border rounded-xl overflow-x-auto custom-scrollbar shadow-inner">
                      {escrowData.deliveryHistory.map((d, idx) => {
                        const isLatest = idx === escrowData.deliveryHistory.length - 1;
                        const isSelected = selectedDeliveryVersion === idx || (selectedDeliveryVersion === null && isLatest);
                        return (
                          <button key={idx} onClick={() => setSelectedDeliveryVersion(idx)}
                            className={`px-5 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-2 ${isSelected ? 'bg-background shadow-sm border text-foreground' : 'text-muted-foreground hover:text-foreground border border-transparent'}`}>
                            Version {d.version.toString()}
                            {isLatest && <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-500' : 'bg-emerald-500/50'}`}></span>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Version Body */}
                  {(() => {
                    const selectedIdx = selectedDeliveryVersion ?? escrowData.deliveryHistory.length - 1;
                    const selectedDelivery = escrowData.deliveryHistory[selectedIdx];
                    const isLatest = selectedIdx === escrowData.deliveryHistory.length - 1;

                    if (!selectedDelivery) return null;

                    return (
                      <div className="rounded-2xl border bg-background overflow-hidden shadow-sm">
                        <div className={`px-5 md:px-6 py-4 border-b flex flex-wrap items-center justify-between gap-4 ${isLatest ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500' : 'bg-surface/50 border-border text-foreground'}`}>
                          <h4 className="font-bold flex items-center gap-2 text-sm md:text-base tracking-wide">{isLatest ? <><CheckCircle2 className="w-5 h-5" /> Latest Submission</> : `Version ${selectedDelivery.version.toString()}`}</h4>
                          <span className="text-xs font-mono font-medium opacity-80">{formatTs(selectedDelivery.timestamp)}</span>
                        </div>
                        <div className="p-5 md:p-6 space-y-6">
                          {selectedDelivery.deliveryLink && (
                            <div>
                              <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-2">Delivery Link</p>
                              <a href={selectedDelivery.deliveryLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium break-all bg-primary/5 px-4 py-2.5 rounded-xl border border-primary/20 w-auto shadow-sm transition-all hover:bg-primary/10">
                                {selectedDelivery.deliveryLink}
                              </a>
                            </div>
                          )}
                          {selectedDelivery.notes && (
                            <div>
                              <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-2">Freelancer Notes</p>
                              <div className="p-5 rounded-xl bg-surface border text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed shadow-inner">
                                {selectedDelivery.notes}
                              </div>
                            </div>
                          )}
                          <div>
                            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-2">Raw IPFS Metadata</p>
                            <a href={ipfsToHttp(selectedDelivery.uri)} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-muted-foreground hover:text-primary transition break-all">
                              {selectedDelivery.uri}
                            </a>
                          </div>
                        </div>

                        {/* Actions container inside the active delivery card */}
                        <div className="p-5 md:p-6 bg-surface/50 border-t">
                          {isLatest && isClient && !escrowData.terminal && !escrowData.disputed ? (
                            <div className="flex flex-col sm:flex-row gap-3">
                              <button onClick={() => setReviewOpen(true)} className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md transition-all focus:ring-2 focus:ring-primary/50 text-sm md:text-base">
                                Approve & Release Payment
                              </button>
                              <button disabled={disputeLoading} onClick={() => setDisputeModal(true)} className="sm:w-1/3 py-3 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 font-bold shadow-sm transition-all focus:ring-2 focus:ring-red-500/50 disabled:opacity-50 text-sm md:text-base">
                                Raise Dispute
                              </button>
                            </div>
                          ) : (
                            <div className="text-center p-3 rounded-xl border border-dashed bg-background text-muted-foreground text-sm font-medium">
                              {escrowData.terminal ? (
                                escrowData.disputed ? <span className="text-amber-500 flex items-center justify-center gap-2"><AlertTriangle className="w-5 h-5" /> Job Closed (Disputed)</span> : <span className="text-emerald-500 flex items-center justify-center gap-2"><CheckCircle2 className="w-5 h-5" /> Job Completed & Paid</span>
                              ) : escrowData.disputed ? (
                                <span className="text-amber-500 flex items-center justify-center gap-2"><Flag className="w-5 h-5" /> Job is currently in Dispute</span>
                              ) : !isClient ? (
                                "Only the client can take action on deliveries."
                              ) : (
                                "Please view the latest version to take action."
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Applicants List - Full Width */}
        {isJobOpen && (
          <section className="bg-surface/30 border border-border/60 rounded-2xl p-5 md:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
                <Users className="w-5 h-5 text-primary" /> Proposals
              </h2>
              <span className="text-xs font-semibold bg-surface px-3 py-1 border rounded-lg text-muted-foreground shadow-sm">{applicants.length} Total</span>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : applicants.length === 0 ? (
              <div className="bg-background/50 rounded-2xl py-12 text-center border border-dashed">
                <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4 border border-border/50 shadow-sm">
                  <Users className="w-6 h-6 text-muted-foreground opacity-50" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">No Proposals Yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">Freelancers haven't submitted bids for this job yet.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {applicants.map((app, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="group flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl border border-border/60 bg-surface/50 hover:bg-surface hover:shadow-md transition-all gap-5">

                    <div className="flex items-center gap-4 flex-1 overflow-hidden">
                      <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono text-sm md:text-base font-bold text-foreground truncate">{app.freelancer}</p>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mt-1 tracking-widest">Applied {formatTs(app.appliedAt)}</p>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 flex-shrink-0 border-t md:border-t-0 pt-4 md:pt-0 border-border">
                      <div className="flex items-center justify-between md:justify-end gap-6 md:px-4 text-sm">
                        <div className="text-left md:text-right">
                          <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest mb-1">Bid</p>
                          <p className="text-emerald-400 font-bold text-base">{(Number(app.bidAmount) / 1e6).toFixed(2)} USDT</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest mb-1">Delivery</p>
                          <p className="text-foreground font-bold text-base">{app.deliveryDays.toString()} Days</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
                        <button onClick={() => setSelectedApplicant(app)} className="flex-1 md:flex-none px-4 py-2.5 text-xs font-bold bg-background border rounded-xl hover:bg-muted/50 transition text-foreground whitespace-nowrap shadow-sm">View Proposal</button>
                        {isClient && (
                          <button disabled={hiring} onClick={() => handleHire(app)} className="flex-1 md:flex-none px-6 py-2.5 text-xs font-bold bg-primary text-primary-foreground rounded-xl hover:opacity-90 disabled:opacity-50 transition whitespace-nowrap shadow-sm shadow-primary/20">
                            {hiring ? "Hiring..." : "Hire Now"}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        )}

      </div>
    </main>
  );
}
