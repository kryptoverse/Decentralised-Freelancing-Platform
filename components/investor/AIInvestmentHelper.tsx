"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Sparkles, Loader2, TrendingUp, DollarSign, 
  BarChart3, ChevronDown, ChevronUp, AlertCircle,
  BrainCircuit, Coins, Users, Briefcase
} from "lucide-react";
import { 
  getContract, readContract, prepareEvent, getContractEvents 
} from "thirdweb";
import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
interface Company {
  id: bigint;
  owner: string;
  token: string;
  sale: string;
  vault: string;
  sector: string;
  meta: any;
  round: {
    pricePerShare: bigint;
    active: boolean;
  };
}

interface CompanyMetrics extends Company {
  tokenSupply: bigint;
  sharesSold: bigint;
  raisedTotal: bigint;
  totalDistributed: bigint;
  investorCount: number;
  jobsCompleted: number;
  vaultBalance: bigint;
}

export function AIInvestmentHelper({ 
  selectedCompanies, 
  onRemove 
}: { 
  selectedCompanies: Company[];
  onRemove: (id: bigint) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState("");
  const [metrics, setMetrics] = useState<CompanyMetrics[]>([]);

  const fetchAllMetrics = async () => {
    setAnalyzing(true);
    setAnalysisResult("");
    const results: CompanyMetrics[] = [];

    try {
      for (const company of selectedCompanies) {
        // Parallelized fetching for each company
        const tokenC = getContract({ client, chain: CHAIN, address: company.token as any });
        const saleC  = getContract({ client, chain: CHAIN, address: company.sale as any });
        const vaultC = company.vault ? getContract({ client, chain: CHAIN, address: company.vault as any }) : null;

        const [totalSupply, saleBalance, vaultStatus] = await Promise.all([
          readContract({ contract: tokenC, method: "function totalSupply() view returns (uint256)" }).catch(() => 0n),
          readContract({ contract: tokenC, method: "function balanceOf(address) view returns (uint256)", params: [company.sale] }).catch(() => 0n),
          vaultC
            ? readContract({ contract: vaultC, method: "function getVaultStatus() view returns (uint256, uint256, uint256, uint256, uint256, uint256)" }).catch(() => [0n,0n,0n,0n,0n,0n])
            : Promise.resolve([0n,0n,0n,0n,0n,0n]),
        ]);

        const sharesSold = totalSupply > 0n ? totalSupply - saleBalance : 0n;

        // Investor count
        let investorCount = 0;
        try {
          const sharesBoughtEvent = prepareEvent({ signature: "event SharesBought(uint256 indexed roundId, address indexed buyer, uint256 usdtPaid, uint256 sharesReceived)" });
          const events = await getContractEvents({ contract: saleC, events: [sharesBoughtEvent] });
          const uniqueBuyers = new Set<string>();
          events.forEach((ev: any) => { if (ev.args?.buyer) uniqueBuyers.add(ev.args.buyer.toLowerCase()); });
          investorCount = uniqueBuyers.size;
        } catch {}

        // Jobs completed
        let jobsCompleted = 0;
        try {
          const jobReg = getContract({
            client, chain: CHAIN,
            address: (DEPLOYED_CONTRACTS.addresses as any).JobEscrowFactory as `0x${string}`,
          });
          const jobCompletedEvent = prepareEvent({ signature: "event EscrowDeployed(address indexed escrow, address indexed client, address indexed freelancer)" });
          const jobEvents = await getContractEvents({ contract: jobReg, events: [jobCompletedEvent] }).catch(() => []);
          jobsCompleted = jobEvents.filter((ev: any) => ev.args?.client?.toLowerCase() === company.owner.toLowerCase()).length;
        } catch {}

        // Vault balance
        let vaultBalance = 0n;
        if (company.vault) {
          try {
            const usdt = getContract({ client, chain: CHAIN, address: DEPLOYED_CONTRACTS.addresses.MockUSDT as any });
            vaultBalance = await readContract({ contract: usdt, method: "function balanceOf(address) view returns (uint256)", params: [company.vault] }) as bigint;
          } catch {}
        }

        results.push({
          ...company,
          tokenSupply: totalSupply as bigint,
          sharesSold: sharesSold as bigint,
          raisedTotal: vaultStatus[0] as bigint,
          totalDistributed: vaultStatus[3] as bigint,
          investorCount,
          jobsCompleted,
          vaultBalance,
        });
      }

      setMetrics(results);
      startAIAnalysis(results);
    } catch (err) {
      console.error("Failed to fetch metrics for AI:", err);
      setAnalyzing(false);
    }
  };

  const startAIAnalysis = async (data: CompanyMetrics[]) => {
    const formattedData = data.map(c => `
Company: ${c.meta?.name || 'Unknown'}
Sector: ${c.sector}
Description: ${c.meta?.description}
Total Supply: ${Number(c.tokenSupply) / 1e18} shares
Circulating: ${Number(c.sharesSold) / 1e18} shares
Total Raised: ${Number(c.raisedTotal) / 1e6} USDT
Dividends Paid: ${Number(c.totalDistributed) / 1e6} USDT
Vault Balance: ${Number(c.vaultBalance) / 1e6} USDT
Investors: ${c.investorCount}
Jobs Completed: ${c.jobsCompleted}
Round Price: ${Number(c.round.pricePerShare) / 1e6} USDT
Status: ${c.round.active ? 'Funding Active' : 'Closed'}
    `).join("\n---\n");

    const systemPrompt = `You are a sophisticated Web3 Venture Analyst. 
Compare the provided freelancer companies for an investor.
Deliver a clear, data-driven analysis covering:
1. Performance: Who has the highest dividend-to-raised ratio?
2. Traction: Who has completed the most jobs relative to their funding?
3. Market Fit: Analyze their sector and description.
4. Recommendation: Provide a ranked list (1st, 2nd, etc.) with brief reasoning for each.
Be objective and highlight potential risks (e.g., low dividends despite high funding).
Use markdown formatting with bold headers.`;

    try {
      setAnalyzing(true);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `Analyze these companies for investment:\n${formattedData}` }],
          systemContext: systemPrompt
        }),
      });

      if (!response.ok) throw new Error("AI Request Failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let done = false;
      let text = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value);
        text += chunkValue;
        setAnalysisResult(text);
      }
    } catch (err) {
      console.error("AI Analysis Error:", err);
      setAnalysisResult("Error generating analysis. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="w-full space-y-4 mb-8">
      <motion.div 
        layout
        className={`bg-[#0c0c0c]/60 backdrop-blur-xl border-2 transition-all rounded-[2rem] overflow-hidden ${selectedCompanies.length > 0 ? 'border-primary/40 shadow-[0_0_30px_rgba(var(--primary-rgb),0.2)]' : 'border-border opacity-60'}`}
      >
        {/* Header / Bar */}
        <div className="p-4 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-colors ${selectedCompanies.length > 0 ? 'bg-primary/20 border-primary/30' : 'bg-surface border-border'}`}>
              <Sparkles className={`w-6 h-6 ${selectedCompanies.length > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <h4 className="font-bold text-base">AI Investment Analyst</h4>
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                {selectedCompanies.length > 0 ? `${selectedCompanies.length} / 4 Companies Selected` : "Select up to 4 companies to compare"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 md:pb-0 no-scrollbar">
            {selectedCompanies.length === 0 ? (
               <p className="text-xs text-muted-foreground italic px-4">Click the scale icon on company cards to add them here.</p>
            ) : (
              selectedCompanies.map(c => (
                <div key={c.id.toString()} className="flex items-center gap-2 bg-surface border border-border px-4 py-2 rounded-full shrink-0 shadow-sm">
                  <span className="text-xs font-bold whitespace-nowrap">{c.meta?.name || `Co. #${c.id.toString()}`}</span>
                  <button onClick={() => onRemove(c.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {selectedCompanies.length > 0 && (
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-3 rounded-2xl hover:bg-white/5 text-muted-foreground transition-colors border border-border"
              >
                {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
              </button>
            )}
            <button 
              onClick={() => { setIsExpanded(true); fetchAllMetrics(); }}
              disabled={analyzing || selectedCompanies.length === 0}
              className="px-8 py-3.5 bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:opacity-90 transition-all flex items-center gap-2 shadow-[0_10px_20px_rgba(var(--primary-rgb),0.3)] active:scale-95 disabled:opacity-30 disabled:grayscale disabled:scale-100"
            >
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
              {analyzing ? "Analyzing..." : "Compare with AI"}
            </button>
          </div>
        </div>

        {/* Expanded Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-white/5 overflow-hidden"
            >
              <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {!analyzing && !analysisResult ? (
                  <div className="py-12 text-center space-y-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20">
                      <TrendingUp className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <h5 className="font-bold text-lg text-foreground">Ready for Comparative Insight?</h5>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        We'll compile real-time metrics for each selected business and run an expert AI evaluation to rank their potential.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Comparative Stats Table */}
                    <div className="overflow-x-auto rounded-2xl border border-border bg-background/30 custom-scrollbar">
                      <table className="w-full min-w-[500px] text-left border-collapse">
                        <thead>
                          <tr className="bg-surface-secondary border-b border-border">
                            <th className="px-4 py-3 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">Metric</th>
                            {metrics.map(m => (
                              <th key={m.id.toString()} className="px-4 py-3 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-primary whitespace-nowrap">
                                {m.meta?.name || `ID ${m.id}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="text-[10px] sm:text-xs">
                          <tr className="border-b border-white/5">
                            <td className="px-4 py-3 font-medium text-muted-foreground">Raised</td>
                            {metrics.map(m => <td key={m.id.toString()} className="px-4 py-3 font-mono">{(Number(m.raisedTotal)/1e6).toFixed(0)} USDT</td>)}
                          </tr>
                          <tr className="border-b border-white/5">
                            <td className="px-4 py-3 font-medium text-muted-foreground">Dividends</td>
                            {metrics.map(m => <td key={m.id.toString()} className="px-4 py-3 font-mono text-amber-500 font-bold">{(Number(m.totalDistributed)/1e6).toFixed(0)} USDT</td>)}
                          </tr>
                          <tr className="border-b border-white/5">
                            <td className="px-4 py-3 font-medium text-muted-foreground">Jobs</td>
                            {metrics.map(m => <td key={m.id.toString()} className="px-4 py-3 font-mono text-teal-500 font-bold">{m.jobsCompleted}</td>)}
                          </tr>
                          <tr>
                            <td className="px-4 py-3 font-medium text-muted-foreground">Price</td>
                            {metrics.map(m => <td key={m.id.toString()} className="px-4 py-3 font-mono">{(Number(m.round.pricePerShare)/1e6).toFixed(2)}</td>)}
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* AI Output */}
                    <div className="relative group">
                      <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-blue-500/10 to-primary/20 blur opacity-40 rounded-2xl"></div>
                      <div className="relative bg-[#0c0c0c]/80 border border-white/10 rounded-2xl p-6 sm:p-8">
                         <div className="flex items-center gap-3 mb-6">
                            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                            <h5 className="font-black text-xs uppercase tracking-[0.3em] text-primary">AI Strategy Advisor</h5>
                         </div>
                         
                         <div className="prose prose-invert prose-sm max-w-none prose-headings:text-primary prose-headings:font-black prose-headings:uppercase prose-headings:tracking-widest prose-p:text-foreground/80 prose-p:leading-relaxed prose-strong:text-white prose-li:text-foreground/70 text-[13px] sm:text-sm">
                            {analysisResult ? (
                              <div className="whitespace-pre-wrap font-medium leading-relaxed text-slate-200">
                                {analysisResult}
                                {analyzing && <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1 align-middle" />}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" />
                              </div>
                            )}
                         </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
