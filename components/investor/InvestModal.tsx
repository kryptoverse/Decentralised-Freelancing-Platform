"use client";

import { useEffect, useState } from "react";
import {
  getContract,
  readContract,
  prepareContractCall,
  sendTransaction,
  waitForReceipt,
} from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  UserPlus
} from "lucide-react";

import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";

interface RoundInfo {
  roundId: bigint;
  pricePerShare: bigint;
  sharesRemaining: bigint;
  active: boolean;
}

interface CompanyWithRound {
  id: bigint;
  sale: string;
  vault: string;
  round: RoundInfo;
  meta?: {
    name?: string;
  };
}

export function InvestModal({
  company,
  open,
  onClose,
  onSuccess
}: {
  company: CompanyWithRound | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const activeAccount = useActiveAccount();
  const [usdtAmount, setUsdtAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkProfile() {
      if (!activeAccount) return;
      try {
        const registry = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.InvestorRegistry as any,
        });
        const profile = await readContract({
          contract: registry,
          method: "function profiles(address) view returns (string, bool)",
          params: [activeAccount.address]
        }) as any;
        setHasProfile(profile[1]);
      } catch (err) {
        setHasProfile(false);
      }
    }
    if (open) checkProfile();
  }, [activeAccount, open]);

  if (!open || !company) return null;

  const handleInvest = async () => {
    if (!activeAccount) {
      setErrorMsg("Please connect your wallet first.");
      return;
    }
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const amt = parseFloat(usdtAmount);
      if (isNaN(amt) || amt <= 0) throw new Error("Invalid investment amount.");

      const usdtWei = BigInt(Math.floor(amt * 1e6)); // 6 decimals for mock USDT

      const usdt = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.MockUSDT as any,
      });

      // 1. Approve USDT to Sale contract
      const approveSaleTx = prepareContractCall({
        contract: usdt,
        method: "function approve(address,uint256)",
        params: [company.sale as any, usdtWei],
      });
      const approveRes = await sendTransaction({ transaction: approveSaleTx, account: activeAccount });
      await waitForReceipt({ client, chain: CHAIN, transactionHash: approveRes.transactionHash });

      // 2. Approve USDT to Vault contract
      const approveVaultTx = prepareContractCall({
        contract: usdt,
        method: "function approve(address,uint256)",
        params: [company.vault as any, usdtWei],
      });
      const approveVaultRes = await sendTransaction({ transaction: approveVaultTx, account: activeAccount });
      await waitForReceipt({ client, chain: CHAIN, transactionHash: approveVaultRes.transactionHash });

      // 3. Buy Shares
      const saleContract = getContract({
        client,
        chain: CHAIN,
        address: company.sale as any,
      });

      const buyTx = prepareContractCall({
        contract: saleContract,
        method: "function buyWithUSDT(uint256)",
        params: [usdtWei],
      });

      await sendTransaction({ transaction: buyTx, account: activeAccount });

      setSuccessMsg("Successfully invested!");
      setTimeout(() => {
        onSuccess();
        onClose();
        setUsdtAmount("");
        setSuccessMsg("");
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Investment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // pricePerShare is in USDT with 6 decimals (1e6), NOT token decimals (1e18)
  const priceUSDT = Number(company.round.pricePerShare) / 1e6;
  const estimatedShares = usdtAmount && priceUSDT > 0 ? parseFloat(usdtAmount) / priceUSDT : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      >
        <motion.div
           initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
           className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl relative"
        >
          <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
            ✕
          </button>
          
          <h2 className="text-xl font-bold mb-1">Invest in {company.meta?.name || "Company"}</h2>
          <p className="text-sm text-muted-foreground mb-6">Purchase shares to earn dividends from future revenue.</p>

          <div className="space-y-4 mb-6">
            {hasProfile === false && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl text-sm flex flex-col gap-3">
                    <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5"/>
                        <p><strong>Profile Required:</strong> You must create an investor profile before purchasing shares.</p>
                    </div>
                    <a href="/investor/profile" className="flex items-center justify-center gap-2 w-full py-2 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors">
                        <UserPlus className="w-4 h-4" /> Create Profile Now
                    </a>
                </div>
            )}

            <div className="flex justify-between items-center p-3 glass-effect rounded-xl border border-border">
              <span className="text-sm text-muted-foreground">Price per Share</span>
              <span className="font-semibold text-primary">
                {(Number(company.round.pricePerShare) / 1e6).toLocaleString("en-US", {
                  minimumFractionDigits: 2, maximumFractionDigits: 6
                })} USDT
              </span>
            </div>

            <div>
              <label className="text-sm font-medium">Investment Amount (USDT)</label>
              <input 
                type="number" step="0.01" value={usdtAmount} onChange={(e) => setUsdtAmount(e.target.value)}
                className="w-full mt-1 bg-background border border-border rounded-xl px-4 py-3 outline-none focus:border-primary transition-colors"
                placeholder="0.00"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-sm text-muted-foreground">Estimated Shares:</span>
              <span className="font-bold">{estimatedShares > 0 ? estimatedShares.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0.00"} Shares</span>
            </div>
          </div>

          {errorMsg && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm flex gap-2"><AlertCircle className="w-5 h-5 shrink-0"/>{errorMsg}</div>}
          {successMsg && <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl text-sm flex gap-2"><CheckCircle2 className="w-5 h-5 shrink-0"/>{successMsg}</div>}

          <button 
             onClick={handleInvest} disabled={loading || !usdtAmount || hasProfile === false}
             className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</> : "Confirm Investment"}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
