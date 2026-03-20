"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
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
  Flag,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  Zap,
  ShieldCheck,
  Info,
} from "lucide-react";

import { useChatContext, defaultContext } from "@/components/chat/ChatContext";

import DisputeModal from "@/components/modals/DisputeModal";
import DisputeInfoPanel from "@/components/disputes/DisputeInfoPanel";

import {
  getContract,
  readContract,
  prepareContractCall,
  sendTransaction,
} from "thirdweb";

import { smartWallet } from "thirdweb/wallets";
import { useConnect, useActiveAccount, useActiveWallet } from "thirdweb/react";
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

interface Delivery {
  uri: string;
  timestamp: bigint;
  version: bigint;
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
  lastDisputeURI: string;
  lastDeliveryURI: string;
  deliveryHistory: Delivery[];
  platformFeeBps: number;
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

const USEROP_ERROR_MESSAGES: Array<[string, string]> = [
  ["AA21", "⛽ Your wallet has no MATIC to pay gas fees. Please add a small amount of MATIC (e.g. 0.01) to your smart wallet to cover transaction costs."],
  ["AA25", "⛽ Gas payment failed — your wallet could not pay the required prefund. Please top up your wallet with MATIC."],
  ["AA31", "⛽ Paymaster deposit is too low. Please try again in a moment or contact support."],
  ["didn't pay prefund", "⛽ Your wallet has no MATIC to pay gas fees. Please add a small amount of MATIC (e.g. 0.01) to your smart wallet address to continue."],
  ["insufficient funds", "⛽ Insufficient funds to cover the transaction. Please add MATIC to your wallet."],
  ["UserOperation reverted", "Transaction was rejected by the network. This is often caused by missing gas funds (MATIC). Please check your wallet balance."],
];

function getFundraiseError(err: unknown): string {
  const raw = err && typeof err === "object" && "message" in err
    ? String((err as any).message ?? "")
    : String(err ?? "");
  // Check stringified error too (sometimes nested in JSON)
  const fullStr = raw + JSON.stringify(err ?? "");
  for (const [keyword, friendly] of USEROP_ERROR_MESSAGES) {
    if (fullStr.includes(keyword)) return friendly;
  }
  // Fall back to ABI errors
  for (const [sig, text] of Object.entries(ABI_ERROR_MESSAGES)) {
    if (fullStr.includes(sig)) return text;
  }
  return raw.slice(0, 200) || "Transaction failed. Please try again.";
}

/* ============================================================
   PAGE
============================================================ */
export default function FreelancerJobDetailPage() {
  const router = useRouter();
  const params = useParams<{ jobId: string }>();

  /* ============================================================
     WALLET SETUP
  ============================================================ */
  const { connect, isConnecting } = useConnect();
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { uploadMetadata } = useIPFSUpload();



  if (!account)
    return <main className="p-8">Connecting to your smart wallet...</main>;

  const walletAccount = account;

  // Non-sponsored execution account (same smart wallet, no paymaster)
  async function getExecutionAccount() {
    if (!activeWallet) throw new Error("No active wallet");
    const personal = (activeWallet as any).getAdminAccount?.();
    if (!personal) throw new Error("Could not get personal EOA");
    return await smartWallet({ chain: CHAIN, sponsorGas: false }).connect({ client, personalAccount: personal });
  }

  const [job, setJob] = useState<Job | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [description, setDescription] = useState("");
  const [escrowData, setEscrowData] = useState<EscrowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isKYCVerified, setIsKYCVerified] = useState<boolean | null>(null);
  const [showKYCModal, setShowKYCModal] = useState(false);
  const [freelancerProfile, setFreelancerProfile] = useState<any>(null);

  const [deliverModal, setDeliverModal] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [disputeModal, setDisputeModal] = useState(false);

  const [deliverLink, setDeliverLink] = useState("");
  const [deliverNotes, setDeliverNotes] = useState("");
  const [deliverLoading, setDeliverLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  // ── Fundraise state ──────────────────────────────────
  const [fundraiseAddr, setFundraiseAddr] = useState<string | null>(null);
  const [fundraiseData, setFundraiseData] = useState<{
    targetAmount: bigint; totalRaised: bigint; fundingDeadline: bigint;
    investorProfitShareBps: bigint; isResolved: boolean; isAccepted: boolean;
    payoutDistributed: boolean; freelancerClaimed: boolean; freelancerPoolTotal: bigint;
    raisedFundsWithdrawn: boolean;
  } | null>(null);
  const [frForm, setFrForm] = useState({ targetUSDT: "", profitShare: "30", durationDays: "7" });
  const [frStep, setFrStep] = useState<"idle" | "creating" | "linking" | "done" | "error">("idle");
  const [frError, setFrError] = useState("");
  const [frTxLoading, setFrTxLoading] = useState("");

  const { setChatContext } = useChatContext();

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

            // Fetch metadata for AI context
            const [name, bio, skillsRaw] = await Promise.all([
              readContract({ contract: profileContract, method: "function name() view returns (string)" }),
              readContract({ contract: profileContract, method: "function bio() view returns (string)" }),
              readContract({ contract: profileContract, method: "function skills() view returns (string[])" }).catch(() => []),
            ]);

            setFreelancerProfile({ name, bio, skills: skillsRaw });

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

          const [
            _f,
            appliedAt,
            propUri,
            bidAmt,
            deliveryDays,
          ] = rawP as [string, bigint, string, bigint, bigint];

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

          const [delivered, disputed, terminal, cancelRequestedBy, lastDisputeURI, deliveryHistory] = await Promise.all([
            readContract({
              contract: escrowC,
              method: "function delivered() view returns (bool)",
            }),
            readContract({
              contract: escrowC,
              method: "function disputed() view returns (bool)",
            }),
            readContract({
              contract: escrowC,
              method: "function terminal() view returns (bool)",
            }),
            readContract({
              contract: escrowC,
              method: "function cancelRequestedBy() view returns (address)",
            }),
            readContract({
              contract: escrowC,
              method: "function lastDisputeURI() view returns (string)",
            }).catch(() => ""),
            readContract({
              contract: escrowC,
              method: "function getAllDeliveries() view returns ((string,uint64,uint256)[])",
            }).catch(() => []), // Fallback to empty array for old escrows
          ]);

          const lastDeliveryURI = await readContract({
            contract: escrowC,
            method: "function lastDeliveryURI() view returns (string)",
          }).catch(() => "");

          setEscrowData({
            escrowAddr: escrow,
            cancelEnd,
            deliveryDue,
            reviewDue,
            delivered,
            disputed,
            terminal,
            cancelRequestedBy,
            lastDisputeURI: String(lastDisputeURI || ""),
            lastDeliveryURI: String(lastDeliveryURI || ""),
            deliveryHistory: (deliveryHistory as any[]).map((d: any) => ({
              uri: d[0],
              timestamp: d[1],
              version: d[2],
            })),
            platformFeeBps: await readContract({
              contract: escrowC,
              method: "function platformFeeBps() view returns (uint16)",
            }).then(n => Number(n)).catch(() => 0),
          });

          // ── Load fundraise if linked ──────────────────────
          try {
            const linkedFundraise = await readContract({
              contract: escrowC,
              method: "function fundraiseContract() view returns (address)",
            }) as string;
            const ZERO = "0x0000000000000000000000000000000000000000";
            if (linkedFundraise && linkedFundraise !== ZERO) {
              setFundraiseAddr(linkedFundraise);
              const fc = getContract({ client, chain: CHAIN, address: linkedFundraise as `0x${string}` });
              const [tgt, raised, deadline, bps, isRes, isAcc, payDist, frClaimed, frPool, rwdrawn] = await Promise.all([
                readContract({ contract: fc, method: "function targetAmount() view returns (uint256)" }),
                readContract({ contract: fc, method: "function totalRaised() view returns (uint256)" }),
                readContract({ contract: fc, method: "function fundingDeadline() view returns (uint64)" }),
                readContract({ contract: fc, method: "function investorProfitShareBps() view returns (uint96)" }),
                readContract({ contract: fc, method: "function isResolved() view returns (bool)" }),
                readContract({ contract: fc, method: "function isAccepted() view returns (bool)" }),
                readContract({ contract: fc, method: "function payoutDistributed() view returns (bool)" }),
                readContract({ contract: fc, method: "function freelancerClaimed() view returns (bool)" }),
                readContract({ contract: fc, method: "function freelancerPoolTotal() view returns (uint256)" }),
                readContract({ contract: fc, method: "function raisedFundsWithdrawn() view returns (bool)" }),
              ]);
              setFundraiseData({
                targetAmount: tgt as bigint, totalRaised: raised as bigint,
                fundingDeadline: deadline as bigint, investorProfitShareBps: bps as bigint,
                isResolved: isRes as boolean, isAccepted: isAcc as boolean,
                payoutDistributed: payDist as boolean, freelancerClaimed: frClaimed as boolean,
                freelancerPoolTotal: frPool as bigint, raisedFundsWithdrawn: rwdrawn as boolean,
              });
            }
          } catch { /* no fundraise linked */ }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    load();

    return () => {
      setChatContext(defaultContext);
    };
  }, [walletAccount.address, jobId, setChatContext]);

  /* ============================================================
     AI CONTEXT INJECTION
  ============================================================ */
  useEffect(() => {
    if (job) {
      const jobContext = `
CURRENT HIRED JOB CONTEXT:
- Job ID: ${job.jobId}
- Title: ${job.title}
- Description: ${description}
- Budget: ${Number(job.budgetUSDC) / 1e6} USDT
- Status: ${JOB_STATUS[job.status as keyof typeof JOB_STATUS] || "Unknown"}
- Client: ${job.client}
- Tags: ${job.tags.join(", ")}
${proposal ? `- Your Original Proposal: ${proposal.proposalText}` : ""}
${escrowData ? `- Escrow Address: ${escrowData.escrowAddr}\n- Escrow Status: ${escrowData.delivered ? "Work Delivered" : "Awaiting Delivery"}, ${escrowData.disputed ? "Disputed" : "No active dispute"}` : ""}
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
  }, [job, description, proposal, escrowData, freelancerProfile, isKYCVerified, setChatContext]);

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
      
      // OPTIMISTIC UPDATE: Instantly reveal delivery history without a slow RPC refresh
      setEscrowData((prev) => {
        if (!prev) return prev;
        const newVersion = prev.deliveryHistory.length + 1;
        return {
          ...prev,
          delivered: true,
          deliveryHistory: [
            ...prev.deliveryHistory,
            {
              uri: metadataUri,
              timestamp: BigInt(Math.floor(Date.now() / 1000)),
              version: BigInt(newVersion),
              deliveryLink: deliverLink,
              notes: deliverNotes
            }
          ]
        };
      });
      
      router.refresh();
    } catch (err) {
      console.error("submitDelivery error:", err);
      alert(getFriendlyError(err));
    } finally {
      setDeliverLoading(false);
    }
  }

  async function raiseDispute(reason: string) {
    if (!escrowData) return;

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

      const transaction = await sendTransaction({ account: walletAccount, transaction: tx });

      setDisputeModal(false);
      router.refresh();
    } catch (err: any) {
      console.error("raiseDispute error:", err);
      if (err.message?.includes("0x62e6201d") || JSON.stringify(err).includes("0x62e6201d")) {
        alert("This job has already been disputed.");
      } else {
        alert(getFriendlyError(err));
      }
      throw err; // Re-throw to let modal handle error state
    }
  }

  /* ============================================================
     FUNDRAISE ACTIONS
  ============================================================ */

  async function handleRefreshPage() {
    setRefreshing(true);
    // Re-trigger by invalidating and re-calling load flow
    setFundraiseAddr(null);
    setFundraiseData(null);
    // Trigger load via router.refresh (will re-render server components)
    // For client state, we manually reload:
    window.location.reload();
  }

  async function handleCreateFundraise() {
    if (!escrowData) return;
    const targetRaw = parseFloat(frForm.targetUSDT);
    const profitBps = parseFloat(frForm.profitShare);
    const durationSecs = parseInt(frForm.durationDays) * 86400;

    const jobAmountUSDT = Number(proposal?.bidAmount || 0n) / 1e6;

    if (isNaN(targetRaw) || targetRaw <= 0) { setFrError("Enter a valid target amount"); return; }
    if (targetRaw > jobAmountUSDT) { setFrError(`Target amount must not exceed the job reward (${jobAmountUSDT} USDT)`); return; }
    if (profitBps < 0 || profitBps > 100) { setFrError("Profit share must be 0–100%"); return; }
    if (durationSecs < 86400) { setFrError("Minimum 1 day duration"); return; }

    const targetAmountRaw = BigInt(Math.floor(targetRaw * 1e6));
    const bps = BigInt(Math.floor(profitBps * 100)); // e.g. 50% → 5000

    setFrError(""); setFrStep("creating");
    try {
      const execAccount = await getExecutionAccount();
      const factory = getContract({
        client, chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.FundraiseFactory as `0x${string}`,
      });

      const createTx = prepareContractCall({
        contract: factory,
        method: "function createFundraise(address,uint256,uint96,uint64) returns (address)",
        params: [escrowData.escrowAddr as `0x${string}`, targetAmountRaw, bps, BigInt(durationSecs)],
        gas: 3000000n,
      });

      const receipt = await sendTransaction({ transaction: createTx, account: execAccount });
      // Wait briefly then link
      await new Promise((r) => setTimeout(r, 3000));

      // We need to find the deployed fundraise address from FundraiseFactory
      // Read total fundraises and get the last one
      const total = await readContract({
        contract: factory, method: "function getTotalFundraises() view returns (uint256)",
      }) as bigint;
      const newFundraiseAddr = (await readContract({
        contract: factory,
        method: "function getFundraises(uint256,uint256) view returns (address[])",
        params: [total - 1n, 1n],
      }) as string[])[0];

      // Step 2: Link to escrow
      setFrStep("linking");
      const escrowC = getContract({ client, chain: CHAIN, address: escrowData.escrowAddr as `0x${string}` });
      await sendTransaction({
        transaction: prepareContractCall({
          contract: escrowC,
          method: "function setFundraiseContract(address)",
          params: [newFundraiseAddr as `0x${string}`],
          gas: 150000n,
        }),
        account: execAccount,
      });

      setFundraiseAddr(newFundraiseAddr);
      setFrStep("done");
      // Reload page to get fresh state
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      setFrError(getFundraiseError(err));
      setFrStep("error");
    }
  }

  async function handleWithdrawFunds() {
    if (!fundraiseAddr) return;
    setFrTxLoading("withdraw");
    try {
      const execAccount = await getExecutionAccount();
      const fc = getContract({ client, chain: CHAIN, address: fundraiseAddr as `0x${string}` });
      await sendTransaction({
        transaction: prepareContractCall({ contract: fc, method: "function withdrawRaisedFunds()", params: [], gas: 150000n }),
        account: execAccount,
      });
      window.location.reload();
    } catch (err: any) {
      setFrError(getFundraiseError(err));
      setFrStep("error");
    } finally {
      setFrTxLoading("");
    }
  }

  async function handleClaimFreelancer() {
    if (!fundraiseAddr) return;
    setFrTxLoading("claim");
    try {
      const execAccount = await getExecutionAccount();
      const fc = getContract({ client, chain: CHAIN, address: fundraiseAddr as `0x${string}` });
      await sendTransaction({
        transaction: prepareContractCall({ contract: fc, method: "function claimFreelancer()", params: [], gas: 150000n }),
        account: execAccount,
      });
      window.location.reload();
    } catch (err: any) {
      setFrError(getFundraiseError(err));
      setFrStep("error");
    } finally {
      setFrTxLoading("");
    }
  }

  async function handleResolveFundraise(acceptPartial: boolean) {
    if (!fundraiseAddr) return;
    setFrTxLoading("resolve");
    try {
      const execAccount = await getExecutionAccount();
      const fc = getContract({ client, chain: CHAIN, address: fundraiseAddr as `0x${string}` });
      await sendTransaction({
        transaction: prepareContractCall({
          contract: fc,
          method: "function resolveFundraise(bool)",
          params: [acceptPartial],
          gas: 150000n,
        }),
        account: execAccount,
      });
      window.location.reload();
    } catch (err: any) {
      setFrError(getFundraiseError(err));
      setFrStep("error");
    } finally {
      setFrTxLoading("");
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
    escrowData != null &&
    !escrowData.terminal; // Only terminal state blocks delivery; disputes allow more work submissions

  const isHired =
    job.status >= 2 && job.status !== 5 &&
    job.hiredFreelancer.toLowerCase() === walletAccount.address.toLowerCase();

  const fmtUSDT = (v: bigint) => (Number(v) / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2 });
  const fmtTs = (ts: bigint) => {
    if (!ts || Number(ts) === 0) return "—";
    const diff = Number(ts) - Math.floor(Date.now() / 1000);
    if (diff <= 0) return "Deadline passed";
    const d = Math.floor(diff / 86400);
    const h = Math.floor((diff % 86400) / 3600);
    return d > 0 ? `${d}d ${h}h remaining` : `${h}h remaining`;
  };
  const now = BigInt(Math.floor(Date.now() / 1000));
  const jobAmountUSDT = Number(proposal?.bidAmount || job?.budgetUSDC || 0n) / 1e6;

  return (
    <>
      <div className="max-w-7xl mx-auto p-4 md:p-6">

        {/* BACK */}
        <button
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* TWO-COLUMN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">

          {/* ══════════════ LEFT COLUMN ══════════════ */}
          <div className="space-y-6">

            {/* JOB HEADER */}
            <section className="p-6 border rounded-2xl bg-surface space-y-4">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="space-y-1 flex-1 min-w-0">
                  <h1 className="text-2xl md:text-3xl font-bold leading-tight">{job.title}</h1>
                  <p className="text-xs text-muted-foreground font-mono">
                    Client: {job.client.slice(0, 10)}…{job.client.slice(-8)}
                  </p>
                </div>
                <span className={`px-3 py-1.5 text-xs border rounded-full font-medium shrink-0 ${statusColor}`}>
                  {jobStatus}{isHired && " · You're hired"}
                </span>
              </div>

              {job.tags.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {job.tags.map((t, i) => (
                    <span key={i} className="px-2 py-1 text-xs bg-primary/10 border border-primary/30 rounded-full text-primary flex items-center gap-1">
                      <Tag className="w-3 h-3" />{t}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* DISPUTE INFO PANEL */}
            {isHired && escrowData && (escrowData.disputed || escrowData.terminal) && (
              <DisputeInfoPanel
                lastDisputeURI={escrowData.lastDisputeURI}
                clientAddr={job.client}
                freelancerAddr={walletAccount.address}
                terminal={escrowData.terminal}
                delivered={escrowData.delivered}
                lastDeliveryURI={escrowData.lastDeliveryURI || escrowData.deliveryHistory[escrowData.deliveryHistory.length - 1]?.uri}
                viewerRole="freelancer"
              />
            )}

            {/* DESCRIPTION */}
            <section className="p-6 border rounded-2xl bg-surface space-y-3">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Job Description
              </h2>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">{description}</p>
            </section>

            {/* PROPOSAL */}
            {proposal && (
              <section className="p-6 border rounded-2xl bg-surface space-y-4">
                <h2 className="text-base font-semibold">Your Proposal</h2>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">{proposal.proposalText}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  <div className="bg-surface-secondary rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Applied</p>
                    <p className="text-sm font-medium mt-0.5">{fmt(proposal.appliedAt)}</p>
                  </div>
                  <div className="bg-surface-secondary rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Your Bid</p>
                    <p className="text-sm font-bold text-emerald-400 mt-0.5">{(Number(proposal.bidAmount) / 1e6).toFixed(2)} USDT</p>
                  </div>
                  <div className="bg-surface-secondary rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Delivery</p>
                    <p className="text-sm font-medium mt-0.5">{proposal.deliveryDays.toString()} days</p>
                  </div>
                </div>
              </section>
            )}

            {/* DELIVERY HISTORY */}
            {isHired && escrowData && escrowData.deliveryHistory.length > 0 && (
              <section className="p-6 border rounded-2xl bg-surface space-y-4">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Send className="w-4 h-4 text-primary" />
                  Delivery History
                  <span className="text-xs font-normal text-muted-foreground">
                    ({escrowData.deliveryHistory.length} submission{escrowData.deliveryHistory.length !== 1 ? "s" : ""})
                  </span>
                </h2>
                <div className="space-y-3">
                  {escrowData.deliveryHistory.map((delivery, idx) => {
                    const isLatest = idx === escrowData.deliveryHistory.length - 1;
                    return (
                      <div key={idx} className={`p-4 border rounded-xl flex items-center justify-between gap-4 ${isLatest ? "bg-primary/5 border-primary/30" : "bg-surface-secondary border-border"}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-semibold shrink-0">v{delivery.version.toString()}</span>
                          {isLatest && <span className="px-2 py-0.5 text-[10px] bg-primary text-primary-foreground rounded-full">Latest</span>}
                          <span className="text-xs text-muted-foreground truncate">{fmt(delivery.timestamp)}</span>
                        </div>
                        <a href={ipfsToHttp(delivery.uri)} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0">
                          <Send className="w-3 h-3" /> View
                        </a>
                      </div>
                    );
                  })}
                </div>
                {escrowData.deliveryHistory.length > 1 && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-400 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Client reviews only the latest submission.
                  </div>
                )}
              </section>
            )}

            {/* FUNDRAISE HUB — available for jobs ≥ $1000 or if already linked */}
            {isHired && escrowData && (fundraiseAddr || (!escrowData.terminal && jobAmountUSDT >= 1000)) && (
              <section className="p-6 border border-primary/30 rounded-2xl bg-primary/5 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" /> {fundraiseAddr ? "Fundraise Dashboard" : "Raise Funds"}
                  </h2>
                  <button onClick={handleRefreshPage} disabled={refreshing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-surface-secondary transition-colors">
                    <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} /> Refresh
                  </button>
                </div>

                {!fundraiseAddr ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Need funding? Create a fundraise — investors pool USDT which you withdraw upfront. When the client approves, the escrow rewards flow through the fundraise contract. Investors get principal + profit share; you keep the rest.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Target Amount (USDT)</label>
                        <input type="number" placeholder="e.g. 500" value={frForm.targetUSDT}
                          onChange={e => setFrForm(f => ({ ...f, targetUSDT: e.target.value }))}
                          className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Investor Profit Share (%)</label>
                        <input type="number" placeholder="e.g. 30" min="0" max="50" value={frForm.profitShare}
                          onChange={e => setFrForm(f => ({ ...f, profitShare: e.target.value }))}
                          className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Duration (days)</label>
                        <input type="number" placeholder="e.g. 7" min="1" value={frForm.durationDays}
                          onChange={e => setFrForm(f => ({ ...f, durationDays: e.target.value }))}
                          className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                      </div>
                    </div>

                    {frForm.targetUSDT && frForm.profitShare && (() => {
                      const tgtRaw = parseFloat(frForm.targetUSDT);
                      const profitPct = parseFloat(frForm.profitShare);
                      if (isNaN(tgtRaw) || isNaN(profitPct)) return null;
                      
                      const platformFee = (jobAmountUSDT * (escrowData.platformFeeBps || 0)) / 10000;
                      const netJobAmount = jobAmountUSDT - platformFee;
                      const isValid = tgtRaw > 0 && tgtRaw <= netJobAmount;
                      
                      const investorProfit = netJobAmount > tgtRaw ? (netJobAmount - tgtRaw) * (profitPct / 100) : 0;
                      const freelancerEarnings = netJobAmount - tgtRaw - investorProfit;

                      return (
                        <div className={`text-xs p-5 rounded-2xl border space-y-4 shadow-inner ${isValid ? "bg-surface border-primary/20" : "bg-red-500/10 border-red-500/30"}`}>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center pb-2 border-b border-border/50">
                              <span className="text-muted-foreground">Original Bid:</span>
                              <span className="font-bold">{jobAmountUSDT.toFixed(2)} USDT</span>
                            </div>
                            <div className="flex justify-between items-center text-red-400/80">
                              <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Platform Fee ({(escrowData.platformFeeBps / 100).toFixed(1)}%):</span>
                              <span className="font-medium">-{platformFee.toFixed(2)} USDT</span>
                            </div>
                            <div className="flex justify-between items-center text-primary font-bold pt-1">
                              <span>Net Escrow Payout:</span>
                              <span>{netJobAmount.toFixed(2)} USDT</span>
                            </div>
                            
                            <div className="h-2" />
                            
                            <div className="flex justify-between items-center px-3 py-2 bg-primary/5 rounded-xl border border-primary/10">
                              <span className="text-muted-foreground group relative">
                                Investor Principal:
                                <Info className="w-3 h-3 inline ml-1 opacity-50 cursor-help" />
                              </span>
                              <span className={`font-bold ${isValid ? "text-emerald-400" : "text-red-400"}`}>
                                {tgtRaw.toFixed(2)} USDT
                                {!isValid && tgtRaw > 0 && " ⚠ exceeds payout"}
                              </span>
                            </div>

                            {isValid && (
                              <>
                                <div className="flex justify-between items-center px-3 py-2 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                                  <span className="text-muted-foreground">Total Pool Return:</span>
                                  <span className="font-bold text-emerald-400">{(tgtRaw + investorProfit).toFixed(2)} USDT</span>
                                </div>
                                <div className="flex justify-between items-center p-4 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20">
                                  <div className="space-y-0.5">
                                    <p className="text-[10px] uppercase font-bold opacity-80 letter tracking-widest">Final Freelancer Earnings</p>
                                    <p className="text-xl font-black">{freelancerEarnings.toFixed(2)} USDT</p>
                                  </div>
                                  <TrendingUp className="w-8 h-8 opacity-20" />
                                </div>
                                <p className="text-[10px] text-amber-400/80 italic text-center px-2 pt-1 uppercase font-bold tracking-tighter">
                                  <Zap className="w-3 h-3 inline mr-1" /> Investors receive principal + {profitPct}% of net profit
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {frError && <p className="text-red-400 text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{frError}</p>}

                    {(frStep === "creating" || frStep === "linking" || frStep === "done") && (
                      <div className="flex items-center gap-2 text-sm text-primary">
                        {frStep !== "done" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        {frStep === "creating" && "Deploying fundraise contract..."}
                        {frStep === "linking" && "Linking to your escrow..."}
                        {frStep === "done" && "Fundraise created! Reloading..."}
                      </div>
                    )}

                    <button onClick={handleCreateFundraise}
                      disabled={frStep === "creating" || frStep === "linking" || frStep === "done"}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-purple-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
                      {(frStep === "creating" || frStep === "linking") ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      Create Fundraise
                    </button>
                  </div>
                ) : fundraiseData ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-surface rounded-xl p-3">
                        <p className="text-xs text-muted-foreground mb-1">Raised</p>
                        <p className="font-bold text-emerald-400 text-sm">{fmtUSDT(fundraiseData.totalRaised)} USDT</p>
                      </div>
                      <div className="bg-surface rounded-xl p-3">
                        <p className="text-xs text-muted-foreground mb-1">Target</p>
                        <p className="font-bold text-sm">{fmtUSDT(fundraiseData.targetAmount)} USDT</p>
                      </div>
                      <div className="bg-surface rounded-xl p-3">
                        <p className="text-xs text-muted-foreground mb-1">Profit Share</p>
                        <p className="font-bold text-primary text-sm">{Number(fundraiseData.investorProfitShareBps) / 100}%</p>
                      </div>
                      <div className="bg-surface rounded-xl p-3">
                        <p className="text-xs text-muted-foreground mb-1">Deadline</p>
                        <p className={`font-bold text-xs ${fundraiseData.fundingDeadline <= now ? "text-red-400" : "text-amber-400"}`}>
                          {fmtTs(fundraiseData.fundingDeadline)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Funding Progress</span>
                        <span>{Math.min(100, Math.round(Number(fundraiseData.totalRaised * 10000n / fundraiseData.targetAmount) / 100))}%</span>
                      </div>
                      <div className="h-2 bg-surface rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all"
                          style={{ width: `${Math.min(100, Math.round(Number(fundraiseData.totalRaised * 10000n / fundraiseData.targetAmount) / 100))}%` }} />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground font-mono">Contract: {fundraiseAddr!.slice(0, 12)}…{fundraiseAddr!.slice(-8)}</p>

                    <div className="flex flex-wrap gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${fundraiseData.isResolved ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                        {fundraiseData.isResolved ? (fundraiseData.isAccepted ? "✅ Accepted" : "❌ Rejected") : "⏳ Fundraising Active"}
                      </span>
                      {fundraiseData.raisedFundsWithdrawn && <span className="px-2.5 py-1 rounded-full text-xs bg-amber-500/20 text-amber-400">Funds Withdrawn</span>}
                      {fundraiseData.payoutDistributed && <span className="px-2.5 py-1 rounded-full text-xs bg-purple-500/20 text-purple-400">Payout Distributed</span>}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!fundraiseData.isResolved && (fundraiseData.fundingDeadline <= now || fundraiseData.totalRaised >= fundraiseData.targetAmount) && (
                        <>
                          <button onClick={() => handleResolveFundraise(true)} disabled={!!frTxLoading}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                            {frTxLoading === "resolve" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Accept & Unlock Funds
                          </button>
                          <button onClick={() => handleResolveFundraise(false)} disabled={!!frTxLoading}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-medium hover:bg-red-500/30 disabled:opacity-50">
                            Reject & Refund Investors
                          </button>
                        </>
                      )}
                      {fundraiseData.isResolved && fundraiseData.isAccepted && !fundraiseData.raisedFundsWithdrawn && !fundraiseData.payoutDistributed && (
                        <button onClick={handleWithdrawFunds} disabled={!!frTxLoading}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-purple-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                          {frTxLoading === "withdraw" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
                          Withdraw {fmtUSDT(fundraiseData.totalRaised)} USDT
                        </button>
                      )}
                      {fundraiseData.freelancerClaimed && (
                        <div className="flex items-center gap-1.5 text-sm text-emerald-400"><CheckCircle2 className="w-4 h-4" /> Earnings claimed</div>
                      )}
                    </div>

                    {/* Prominent claim banner — shown when job is done and freelancer has unclaimed earnings */}
                    {fundraiseData.payoutDistributed && !fundraiseData.freelancerClaimed && fundraiseData.freelancerPoolTotal > 0n && (
                      <div className="p-4 bg-amber-500/10 border border-amber-500/40 rounded-xl space-y-3">
                        <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                          <Zap className="w-4 h-4 shrink-0" />
                          Your earnings are ready to claim!
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          The job is complete and your share has been calculated. Your <span className="text-amber-400 font-semibold">{fmtUSDT(fundraiseData.freelancerPoolTotal)} USDT</span> is currently held inside the fundraise contract — it is <strong>not</strong> sent to your wallet automatically. Click below to transfer it.
                        </p>
                        <button
                          onClick={handleClaimFreelancer}
                          disabled={!!frTxLoading}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          {frTxLoading === "claim" ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                          Claim {fmtUSDT(fundraiseData.freelancerPoolTotal)} USDT to My Wallet
                        </button>
                      </div>
                    )}


                    {frError && (
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{frError}</span>
                        <button onClick={() => setFrError("")} className="ml-auto shrink-0 hover:text-red-300">✕</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading fundraise data...
                  </div>
                )}
              </section>
            )}
          </div>

          {/* ══════════════ RIGHT COLUMN ══════════════ */}
          <div className="space-y-4 lg:sticky lg:top-6">

            {/* QUICK STATS */}
            <div className="p-5 border rounded-2xl bg-surface-secondary space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Job Overview</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Budget</span>
                  <span className="text-sm font-bold text-emerald-400">{(Number(job.budgetUSDC) / 1e6).toFixed(2)} USDT</span>
                </div>
                {proposal && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Your Bid</span>
                    <span className="text-sm font-bold text-primary">{(Number(proposal.bidAmount) / 1e6).toFixed(2)} USDT</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Posted</span>
                  <span className="text-xs text-right">{fmt(job.createdAt)}</span>
                </div>
                {job.expiresAt && Number(job.expiresAt) > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Expires</span>
                    <span className="text-xs text-right">{fmt(job.expiresAt)}</span>
                  </div>
                )}
                {isHired && escrowData && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Escrow</span>
                    <a href={`https://sepolia.basescan.org/address/${escrowData.escrowAddr}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline font-mono">
                      {escrowData.escrowAddr.slice(0, 8)}…{escrowData.escrowAddr.slice(-6)}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* ESCROW TIMELINE */}
            {isHired && escrowData && (
              <div className="p-5 border rounded-2xl bg-surface-secondary space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Escrow Timeline</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Cancel Window</span>
                    <span className="font-medium text-right">{fmt(escrowData.cancelEnd)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Delivery Due</span>
                    <span className="font-medium text-right">{fmt(escrowData.deliveryDue)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">Review Ends</span>
                    <span className="font-medium text-right">{escrowData.reviewDue === 0n ? "Not started" : fmt(escrowData.reviewDue)}</span>
                  </div>
                </div>

                {/* Status banners */}
                {escrowData.cancelRequestedBy !== "0x0000000000000000000000000000000000000000" && (
                  <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {escrowData.cancelRequestedBy.toLowerCase() === walletAccount.address.toLowerCase()
                      ? "You requested cancellation. Waiting for client."
                      : "Client requested cancellation."}
                  </div>
                )}
                {escrowData.disputed && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2">
                    <Flag className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Job is in dispute. Actions restricted until admin resolves.
                  </div>
                )}
                {escrowData.delivered && !escrowData.terminal && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    Work delivered — awaiting client review.
                  </div>
                )}
              </div>
            )}

            {/* ACTION BUTTONS */}
            {isHired && escrowData && (
              <div className="p-5 border rounded-2xl bg-surface-secondary space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Actions</h3>

                {canDeliver ? (
                  <button onClick={() => setDeliverModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity">
                    <Send className="w-4 h-4" /> Submit Delivery
                  </button>
                ) : (
                  <div className="w-full px-4 py-3 rounded-xl border border-border text-sm text-muted-foreground text-center">
                    {escrowData.disputed ? "⛔ In dispute" : escrowData.terminal ? "✅ Escrow closed" : "Delivery window passed"}
                  </div>
                )}

                {escrowData.delivered && !escrowData.terminal && escrowData.reviewDue > 0n &&
                  BigInt(Math.floor(Date.now() / 1000)) > escrowData.reviewDue && (
                    <button
                      onClick={async () => {
                        try {
                          const escrow = getContract({ client, chain: CHAIN, address: escrowData.escrowAddr as `0x${string}` });
                          const tx = await prepareContractCall({ contract: escrow, method: "function processTimeouts()", params: [] });
                          await sendTransaction({ account: walletAccount, transaction: tx });
                          router.refresh();
                        } catch (err: any) { alert(getFriendlyError(err)); }
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition animate-pulse">
                      <Zap className="w-4 h-4" /> Claim Auto-Payment
                    </button>
                  )}

                {!escrowData.terminal && !escrowData.disputed && (
                  <button onClick={() => setDisputeModal(true)}
                    className="w-full px-4 py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition text-sm font-medium">
                    Raise Dispute
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODALS */}
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

      <DisputeModal
        open={disputeModal}
        onClose={() => setDisputeModal(false)}
        onSubmit={raiseDispute}
      />

      {showKYCModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-amber-500/30 p-6 rounded-xl w-full max-w-md space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <ShieldAlert className="w-8 h-8" />
              <h2 className="text-xl font-semibold">KYC Verification Required</h2>
            </div>
            <p className="text-sm text-muted-foreground">Complete KYC verification in your profile settings to access all freelancer features.</p>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => router.push("/freelancer")} className="px-4 py-2 border rounded-lg hover:bg-surface-secondary transition">Back to Dashboard</button>
              <button onClick={() => router.push("/freelancer/Profile")} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition">Go to Profile</button>
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
