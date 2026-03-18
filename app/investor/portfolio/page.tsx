"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getContract,
  readContract,
  prepareContractCall,
  sendTransaction,
} from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Briefcase,
  PieChart,
  DollarSign,
  Wallet
} from "lucide-react";

import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { ipfsToHttp } from "@/utils/ipfs";

/* ============================================================
   TYPES
============================================================ */
interface PortfolioItem {
  companyId: bigint;
  name: string;
  sector: string;
  distributorAddress: string;
  tokenAddress: string;
  totalInvested: bigint;
  totalPayouts: bigint;
  shareBalance: bigint;
  claimableDividend: bigint;
}

function formatUSDT(raw: bigint) {
  return (Number(raw) / 1e6).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatShares(raw: bigint) {
  return (Number(raw) / 1e18).toLocaleString("en-US", {
      maximumFractionDigits: 2
  });
}

/* ============================================================
   PORTFOLIO PAGE
============================================================ */
export default function InvestorPortfolioPage() {
  const activeAccount = useActiveAccount();
  
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [claimingId, setClaimingId] = useState<bigint | null>(null);

  const fetchPortfolio = useCallback(async () => {
    if (!activeAccount) {
      setLoading(false);
      return;
    }

    try {
      const registry = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.InvestorRegistry as any,
      });

      const companyRegistry = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.CompanyRegistry as any,
      });

      // 1. Get Portfolio Company IDs
      const companyIds = (await readContract({
        contract: registry,
        method: "function getPortfolio(address) view returns (uint256[])",
        params: [activeAccount.address],
      })) as bigint[];

      const results: PortfolioItem[] = [];

      for (const cid of companyIds) {
        // 2. Get Investment Stats
        const stats = (await readContract({
            contract: registry,
            method: "function getInvestmentStats(address,uint256) view returns (uint256,uint256)",
            params: [activeAccount.address, cid]
        })) as [bigint, bigint];

        // 3. Get Company Info
        const comp = (await readContract({
          contract: companyRegistry,
          method:
            "function getCompany(uint256) view returns ((address owner, address token, address sale, address vault, address distributor, string metadataURI, string sector, bool exists))",
          params: [cid],
        })) as any;

        if (!comp.exists) continue;

        let name = `Company #${cid.toString()}`;
        if (comp.metadataURI) {
          try {
            const r = await fetch(ipfsToHttp(comp.metadataURI));
            const meta = await r.json();
            if (meta.name) name = meta.name;
          } catch (e) {}
        }

        // 4. Get Share Balance
        const tokenContract = getContract({
            client,
            chain: CHAIN,
            address: comp.token as any
        });
        const bal = (await readContract({
            contract: tokenContract,
            method: "function balanceOf(address) view returns (uint256)",
            params: [activeAccount.address]
        })) as bigint;

        // 5. Get Claimable Dividends
        const distContract = getContract({
            client,
            chain: CHAIN,
            address: comp.distributor as any
        });
        const claimable = (await readContract({
            contract: distContract,
            method: "function withdrawableDividendOf(address) view returns (uint256)",
            params: [activeAccount.address]
        })) as bigint;

        results.push({
            companyId: cid,
            name,
            sector: comp.sector,
            distributorAddress: comp.distributor,
            tokenAddress: comp.token,
            totalInvested: stats[0],
            totalPayouts: stats[1],
            shareBalance: bal,
            claimableDividend: claimable
        });
      }

      setItems(results);
    } catch (err) {
      console.error("Failed to fetch portfolio:", err);
    } finally {
      setLoading(false);
    }
  }, [activeAccount]);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  const handleClaim = async (item: PortfolioItem) => {
      if (!activeAccount) return;
      setErrorMsg("");
      setSuccessMsg("");
      setClaimingId(item.companyId);

      try {
          const distributor = getContract({
              client,
              chain: CHAIN,
              address: item.distributorAddress as any
          });

          const tx = prepareContractCall({
              contract: distributor,
              method: "function claim()",
              params: []
          });

          await sendTransaction({ transaction: tx, account: activeAccount });
          setSuccessMsg(`Successfully claimed dividends from ${item.name}!`);
          fetchPortfolio();
      } catch(err: any) {
          console.error(err);
          setErrorMsg(err.message || "Failed to claim dividends.");
      } finally {
          setClaimingId(null);
      }
  };

  const totalInvestedOverall = items.reduce((acc, curr) => acc + curr.totalInvested, 0n);
  const totalPayoutsOverall = items.reduce((acc, curr) => acc + curr.totalPayouts, 0n);

  if (!activeAccount) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
              <Wallet className="w-12 h-12 text-muted-foreground opacity-50" />
              <h2 className="text-xl font-bold">Wallet Connect Required</h2>
              <p className="text-muted-foreground">Please connect your wallet to view your investment portfolio.</p>
          </div>
      );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold gradient-text">My Portfolio</h1>
        <p className="text-muted-foreground mt-2">
          Track your shareholdings, investment history, and claim your earned dividends.
        </p>
      </div>

      {errorMsg && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl flex gap-2 text-sm"><AlertCircle className="w-5 h-5 shrink-0"/>{errorMsg}</div>}
      {successMsg && <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl flex gap-2 text-sm"><CheckCircle2 className="w-5 h-5 shrink-0"/>{successMsg}</div>}

      {/* Global Stats */}
      {!loading && items.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-effect p-5 rounded-2xl border border-border">
                  <div className="flex justify-between items-start">
                      <p className="text-sm text-muted-foreground">Total Invested</p>
                      <Briefcase className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-2xl font-bold mt-2">{formatUSDT(totalInvestedOverall)} <span className="text-sm font-normal text-muted-foreground">USDT</span></p>
              </div>
              <div className="glass-effect p-5 rounded-2xl border border-border">
                  <div className="flex justify-between items-start">
                      <p className="text-sm text-muted-foreground">Total Dividends Received</p>
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                  <p className="text-2xl font-bold mt-2 text-emerald-400">{formatUSDT(totalPayoutsOverall)} <span className="text-sm font-normal text-emerald-500/50">USDT</span></p>
              </div>
              <div className="glass-effect p-5 rounded-2xl border border-border">
                  <div className="flex justify-between items-start">
                      <p className="text-sm text-muted-foreground">Companies</p>
                      <PieChart className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-2xl font-bold mt-2">{items.length}</p>
              </div>
          </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col flex-1 items-center justify-center min-h-[30vh] space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Loading your investments...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="glass-effect p-12 rounded-3xl border border-border flex flex-col items-center justify-center text-center">
            <Briefcase className="w-16 h-16 text-muted-foreground opacity-50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Investments Yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm mb-6">
                You haven't purchased any company shares yet. Explore available companies to start earning dividends.
            </p>
            <button onClick={() => window.location.href = "/investor/companies"} className="px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-xl hover:opacity-90 transition-opacity">
                Explore Companies
            </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence>
            {items.map((item) => (
              <motion.div 
                key={item.companyId.toString()}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-effect overflow-hidden rounded-2xl border border-border flex flex-col"
              >
                <div className="p-6 flex-1 space-y-6">
                    <div>
                        <span className="inline-block px-2.5 py-1 rounded-full bg-surface text-xs font-medium text-muted-foreground border border-border mb-3">
                            {item.sector}
                        </span>
                        <h3 className="text-xl font-bold">{item.name}</h3>
                    </div>
                    
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm border-b border-border/50 pb-2">
                            <span className="text-muted-foreground">Share Balance</span>
                            <span className="font-semibold">{formatShares(item.shareBalance)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm border-b border-border/50 pb-2">
                            <span className="text-muted-foreground">Total Invested</span>
                            <span className="font-semibold">{formatUSDT(item.totalInvested)} USDT</span>
                        </div>
                        <div className="flex justify-between items-center text-sm pb-1">
                            <span className="text-muted-foreground">Historically Received</span>
                            <span className="font-semibold text-emerald-500">{formatUSDT(item.totalPayouts)} USDT</span>
                        </div>
                    </div>

                    <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                        <p className="text-xs text-emerald-500 font-medium mb-1">Claimable Dividends</p>
                        <p className="text-2xl font-bold text-emerald-400 flex items-center gap-1">
                            {formatUSDT(item.claimableDividend)} <span className="text-sm font-normal text-emerald-500/50">USDT</span>
                        </p>
                    </div>
                </div>

                <div className="p-4 border-t border-border bg-surface/50">
                    <button 
                        onClick={() => handleClaim(item)}
                        disabled={item.claimableDividend === 0n || claimingId === item.companyId}
                        className="w-full py-2.5 bg-background text-foreground hover:bg-surface border border-border font-medium rounded-xl transition-colors disabled:opacity-50 disabled:hover:bg-background flex items-center justify-center gap-2"
                    >
                        {claimingId === item.companyId ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Claiming...</>
                        ) : (
                            <><DollarSign className="w-4 h-4" /> Claim Dividends</>
                        )}
                    </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
