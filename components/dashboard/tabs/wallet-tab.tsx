"use client";

import { useState, useEffect } from "react";
import { useActiveAccount, useActiveWallet, useSwitchActiveWalletChain, useSendTransaction, useActiveWalletChain } from "thirdweb/react";
import { getContract, readContract, prepareContractCall, prepareTransaction, toWei } from "thirdweb";
import { client } from "@/lib/thirdweb-client";
import { getWalletBalance } from "thirdweb/wallets";
import { polygon, polygonAmoy } from "thirdweb/chains";
import { motion } from "framer-motion";
import { Wallet, Send, Copy, CheckCircle2, RefreshCw, ArrowRightLeft, CreditCard, Building, ArrowLeftRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

const USDT_MOCK_ADDRESS = "0x4eC3e0BeCEC0054397f140eF2501191bE93A19cA"; // Project Mock USDT

export function WalletTab() {
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const activeChain = useActiveWalletChain();
  const switchChain = useSwitchActiveWalletChain();
  const { mutateAsync: sendTx, isPending: isSending } = useSendTransaction();

  const [usdtBalance, setUsdtBalance] = useState<bigint | null>(null);
  const [maticBalance, setMaticBalance] = useState<string>("0");
  const [loadingBalances, setLoadingBalances] = useState(false);
  
  const [copied, setCopied] = useState(false);

  // Send Form State
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [sendToken, setSendToken] = useState<"MATIC" | "USDT">("MATIC");

  // Cross-wallet state
  const [eoaAddress, setEoaAddress] = useState<string | null>(null);
  const [eoaMaticBal, setEoaMaticBal] = useState<string>("0");
  const [eoaUsdtBal, setEoaUsdtBal] = useState<string>("0");
  const [swUsdtBal, setSwUsdtBal] = useState<string>("0");
  const [crossToken, setCrossToken] = useState<"MATIC" | "USDT">("MATIC");
  const [crossDir, setCrossDir] = useState<"EOA_TO_SW" | "SW_TO_EOA">("EOA_TO_SW");
  const [crossAmt, setCrossAmt] = useState("");
  const [crossLoading, setCrossLoading] = useState(false);

  // Detect EOA address
  useEffect(() => {
    try {
      const pa = (activeWallet as any)?.getAdminAccount?.();
      if (pa?.address) setEoaAddress(pa.address);
    } catch {}
  }, [activeWallet]);

  const isTestnet = activeChain?.id === polygonAmoy.id;

  // Toggle Network
  const handleToggleNetwork = async () => {
    try {
      if (isTestnet) {
        await switchChain(polygon);
        toast.success("Switched to Polygon Mainnet");
      } else {
        await switchChain(polygonAmoy);
        toast.success("Switched to Polygon Amoy Testnet");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to switch network");
    }
  };

  // Ensure default to Testnet on load if connected to something else
  useEffect(() => {
    if (activeChain && activeChain.id !== polygonAmoy.id && activeChain.id !== polygon.id) {
       switchChain(polygonAmoy).catch(console.error);
    }
  }, [activeChain, switchChain]);

  // Fetch Balances
  const loadBalances = async () => {
    if (!account?.address || !activeChain) return;

    try {
      setLoadingBalances(true);

      // 1. Fetch USDT (Smart Wallet)
      if (activeChain.id === polygonAmoy.id) {
        try {
          const usdt = getContract({ client, chain: activeChain, address: USDT_MOCK_ADDRESS });
          const usdtBal = await readContract({ contract: usdt, method: "function balanceOf(address) view returns (uint256)", params: [account.address] });
          setUsdtBalance(BigInt(usdtBal));
          setSwUsdtBal((Number(usdtBal) / 1e6).toFixed(3));
        } catch { setUsdtBalance(0n); setSwUsdtBal("0"); }
      } else {
        setUsdtBalance(0n); setSwUsdtBal("0");
      }

      // 2. Fetch MATIC (Smart Wallet native)
      try {
        const maticResult = await getWalletBalance({ client, chain: activeChain, address: account.address });
        setMaticBalance(Number(maticResult.displayValue).toFixed(3));
      } catch (err) { console.error("MATIC Fetch Error:", err); }

      // 3. Fetch EOA balances if we have EOA address
      if (eoaAddress) {
        try {
          const eoaMatic = await getWalletBalance({ client, chain: polygonAmoy, address: eoaAddress });
          setEoaMaticBal(Number(eoaMatic.displayValue).toFixed(3));
        } catch {}
        if (activeChain.id === polygonAmoy.id) {
          try {
            const usdt = getContract({ client, chain: polygonAmoy, address: USDT_MOCK_ADDRESS });
            const eoaUsdt = await readContract({ contract: usdt, method: "function balanceOf(address) view returns (uint256)", params: [eoaAddress] });
            setEoaUsdtBal((Number(eoaUsdt) / 1e6).toFixed(3));
          } catch {}
        }
      }

    } catch (err) {
      console.error("Balance Fetch Error:", err);
    } finally {
      setLoadingBalances(false);
    }
  };

  useEffect(() => {
    loadBalances();
  }, [account?.address, activeChain?.id, eoaAddress]);

  // Handle Cross-Wallet Transfer
  const handleCrossTransfer = async () => {
    if (!account || !crossAmt || Number(crossAmt) <= 0) return toast.error("Invalid amount");
    const fromEOA = crossDir === "EOA_TO_SW";
    const toAddr = fromEOA ? account.address : (eoaAddress || "");
    if (!toAddr) return toast.error("Could not determine target address");
    const fromAccount = fromEOA
      ? (activeWallet as any)?.getAdminAccount?.()
      : account;
    if (!fromAccount) return toast.error("Could not access source account");

    try {
      setCrossLoading(true);
      if (crossToken === "MATIC") {
        const tx = prepareTransaction({ client, chain: polygonAmoy, to: toAddr, value: toWei(crossAmt) });
        await sendTx({ transaction: tx, account: fromAccount } as any);
      } else {
        const usdt = getContract({ client, chain: polygonAmoy, address: USDT_MOCK_ADDRESS });
        const parsedAmt = BigInt(Math.floor(Number(crossAmt) * 1_000_000));
        const tx = prepareContractCall({ contract: usdt, method: "function transfer(address,uint256) returns (bool)", params: [toAddr, parsedAmt] });
        await sendTx({ transaction: tx, account: fromAccount } as any);
      }
      toast.success(`Sent ${crossAmt} ${crossToken} ${fromEOA ? "from EOA to Smart Wallet" : "from Smart Wallet to EOA"}`);
      setCrossAmt("");
      setTimeout(() => loadBalances(), 3000);
    } catch (err: any) {
      toast.error(`Transfer failed: ${err.message || "Unknown error"}`);
    } finally {
      setCrossLoading(false);
    }
  };


  // Handle Send
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return toast.error("Please connect wallet first");
    if (!recipient || !amount || Number(amount) <= 0) return toast.error("Invalid recipient or amount");

    try {
      if (sendToken === "USDT") {
        const usdt = getContract({
          client,
          chain: activeChain || polygonAmoy,
          address: USDT_MOCK_ADDRESS,
        });

        // Mock USDT usually has 6 decimals
        const parsedAmount = BigInt(Math.floor(Number(amount) * 1_000_000));
        
        const tx = prepareContractCall({
          contract: usdt,
          method: "function transfer(address, uint256) returns (bool)",
          params: [recipient, parsedAmount]
        });

        await sendTx(tx);
        toast.success(`Successfully sent ${amount} USDT`);
      } else {
        // Send Native MATIC/POL
        const tx = prepareTransaction({
          client,
          chain: activeChain || polygonAmoy,
          to: recipient,
          value: toWei(amount),
        });

        await sendTx(tx);
        toast.success(`Successfully sent ${amount} MATIC`);
      }

      // Reset form & reload balances
      setRecipient("");
      setAmount("");
      loadBalances();
    } catch (err: any) {
      console.error(err);
      toast.error(`Transfer Failed: ${err.message || "Unknown error"}`);
    }
  };

  const copyAddress = () => {
    if (account?.address) {
      navigator.clipboard.writeText(account.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Wallet address copied to clipboard");
    }
  };

  if (!account) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-xl text-muted-foreground font-medium">Please connect your wallet to view your Wallet dashboard.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header & Network Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface p-6 rounded-3xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Wallet</h1>
            <p className="text-sm text-foreground-secondary">Manage your funds and send tokens</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-background p-2 rounded-xl border border-border">
          <span className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${isTestnet ? 'text-primary' : 'text-foreground hover:bg-surface'}`}>
            Amoy Testnet
          </span>
          <button 
            onClick={handleToggleNetwork}
            className={`relative flex items-center h-6 w-11 rounded-full transition-colors cursor-pointer ${isTestnet ? 'bg-primary' : 'bg-green-500'}`}
          >
            <motion.div 
              className="absolute left-1 h-4 w-4 rounded-full bg-white shadow-sm"
              animate={{ x: isTestnet ? 0 : 20 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
          <span className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${!isTestnet ? 'text-green-500' : 'text-foreground hover:bg-surface'}`}>
            Mainnet
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Balances & Details */}
        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-3xl bg-surface border border-border shadow-md"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                Your Address
              </h2>
            </div>
            <div className="flex items-center justify-between bg-background p-4 rounded-xl border border-border gap-4">
              <p className="font-mono text-sm text-foreground truncate flex-1">
                {account.address}
              </p>
              <button 
                onClick={copyAddress}
                className="p-2 hover:bg-surface rounded-lg transition-colors text-foreground-secondary hover:text-foreground"
                title="Copy Address"
              >
                {copied ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </motion.div>

          {/* Balances */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="p-6 rounded-3xl bg-surface border border-border shadow-md"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                Assets
              </h2>
              <button 
                onClick={loadBalances} 
                disabled={loadingBalances}
                className="p-1.5 text-foreground-secondary hover:text-foreground hover:bg-background rounded-lg transition-all"
                title="Refresh Balances"
              >
                <RefreshCw className={`w-4 h-4 ${loadingBalances ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="space-y-4">
              {/* MATIC */}
              <div className="flex items-center justify-between p-4 bg-background rounded-xl border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-600 font-bold font-serif text-lg">
                    ∞
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">POL / MATIC</h3>
                    <p className="text-xs text-foreground-secondary">Native Token</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg text-foreground">
                    {loadingBalances && maticBalance === "0" ? "..." : maticBalance}
                  </p>
                </div>
              </div>

              {/* USDT */}
              <div className="flex items-center justify-between p-4 bg-background rounded-xl border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600 font-bold text-lg">
                    $
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">USDT</h3>
                    <p className="text-xs text-foreground-secondary">Project Mock</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg text-foreground">
                    {loadingBalances || usdtBalance === null
                      ? "..."
                      : (Number(usdtBalance) / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Send Form */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="p-6 rounded-3xl bg-surface border border-border shadow-md h-fit"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Send className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold">Send Tokens</h2>
          </div>

          <form onSubmit={handleSend} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Token</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSendToken("MATIC")}
                  className={`py-3 px-4 rounded-xl font-medium border transition-all ${
                    sendToken === "MATIC" 
                    ? "bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-400" 
                    : "bg-background border-border text-foreground-secondary hover:bg-surface-secondary"
                  }`}
                >
                  MATIC
                </button>
                <button
                  type="button"
                  onClick={() => setSendToken("USDT")}
                  className={`py-3 px-4 rounded-xl font-medium border transition-all ${
                    sendToken === "USDT" 
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400" 
                    : "bg-background border-border text-foreground-secondary hover:bg-surface-secondary"
                  }`}
                >
                  USDT
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Recipient Address</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground outline-none focus:border-primary transition-colors"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Amount</label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-background border border-border rounded-xl pl-4 pr-16 py-3 text-foreground placeholder-muted-foreground outline-none focus:border-primary transition-colors"
                  required
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 font-medium text-foreground-secondary">
                  {sendToken}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="w-full py-4 mt-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSending ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Send {sendToken}
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>

      {/* ===== Cross-Wallet Transfer ===== */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="p-6 rounded-3xl bg-surface border border-border shadow-md"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Cross-Wallet Transfer</h2>
            <p className="text-sm text-muted-foreground">Move funds between your Personal EOA and Smart Wallet</p>
          </div>
        </div>

        {/* Wallet Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* EOA */}
          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-amber-400"></div>
              <p className="font-bold text-amber-400 text-sm">Personal EOA</p>
            </div>
            {eoaAddress ? (
              <>
                <p className="font-mono text-xs text-muted-foreground mb-3 truncate">{eoaAddress}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-background rounded-xl p-2.5">
                    <p className="text-[10px] text-muted-foreground">MATIC</p>
                    <p className="font-bold font-mono text-sm text-amber-400">{eoaMaticBal}</p>
                  </div>
                  <div className="bg-background rounded-xl p-2.5">
                    <p className="text-[10px] text-muted-foreground">USDT</p>
                    <p className="font-bold font-mono text-sm text-emerald-400">{eoaUsdtBal}</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground italic">EOA address not detected. Make sure you are connected with an inAppWallet.</p>
            )}
          </div>

          {/* Smart Wallet */}
          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-primary"></div>
              <p className="font-bold text-primary text-sm">Smart Wallet</p>
            </div>
            {account ? (
              <>
                <p className="font-mono text-xs text-muted-foreground mb-3 truncate">{account.address}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-background rounded-xl p-2.5">
                    <p className="text-[10px] text-muted-foreground">MATIC</p>
                    <p className="font-bold font-mono text-sm text-primary">Gasless</p>
                  </div>
                  <div className="bg-background rounded-xl p-2.5">
                    <p className="text-[10px] text-muted-foreground">USDT</p>
                    <p className="font-bold font-mono text-sm text-emerald-400">{swUsdtBal}</p>
                  </div>
                </div>
              </>
            ) : <p className="text-xs text-muted-foreground italic">Not connected.</p>}
          </div>
        </div>

        {/* Direction selector */}
        <div className="flex items-center gap-3 mb-4 bg-background border border-border rounded-xl p-2">
          <button onClick={() => setCrossDir("EOA_TO_SW")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${crossDir === "EOA_TO_SW" ? "bg-amber-500/20 text-amber-400" : "text-muted-foreground hover:text-foreground"}`}>
            EOA → Smart Wallet
          </button>
          <ArrowLeftRight className="w-4 h-4 text-muted-foreground shrink-0 cursor-pointer hover:text-primary transition" onClick={() => setCrossDir(d => d === "EOA_TO_SW" ? "SW_TO_EOA" : "EOA_TO_SW")} />
          <button onClick={() => setCrossDir("SW_TO_EOA")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${crossDir === "SW_TO_EOA" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            Smart Wallet → EOA
          </button>
        </div>

        {/* Token & Amount */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="grid grid-cols-2 gap-2 shrink-0">
            {(["MATIC", "USDT"] as const).map(t => (
              <button key={t} onClick={() => setCrossToken(t)}
                className={`py-2 px-3 rounded-xl text-sm font-semibold border transition ${crossToken === t ? (t === "MATIC" ? "bg-purple-500/10 border-purple-500 text-purple-400" : "bg-emerald-500/10 border-emerald-500 text-emerald-400") : "bg-background border-border text-muted-foreground"}`}>
                {t}
              </button>
            ))}
          </div>
          <input type="number" step="any" placeholder="Amount" value={crossAmt} onChange={e => setCrossAmt(e.target.value)}
            className="flex-1 bg-background border border-border rounded-xl px-4 py-2 outline-none focus:border-primary transition-colors text-sm" />
          <button onClick={handleCrossTransfer} disabled={!crossAmt || crossLoading || !eoaAddress}
            className="px-5 py-2 bg-primary text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition flex items-center gap-2">
            {crossLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
            Send
          </button>
        </div>
      </motion.div>

      {/* Fiat <-> Crypto Showcase Section */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="p-6 rounded-3xl bg-surface border border-border shadow-md"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Convert Funds (Showcase)</h2>
            <p className="text-sm text-foreground-secondary">Convert between Fiat and Crypto easily.</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Buy Crypto Showcase */}
          <div className="p-5 rounded-2xl bg-background border border-border space-y-4 hover:border-emerald-500/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Deposit Fiat</h3>
                <p className="text-xs text-foreground-secondary">Buy Crypto via Credit Card / Bank</p>
              </div>
            </div>
            
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <input 
                  type="number" 
                  placeholder="0.00" 
                  className="w-full bg-background border border-border rounded-xl pl-4 pr-12 py-3 text-sm text-foreground placeholder-muted-foreground outline-none cursor-not-allowed opacity-70" 
                  disabled 
                  readOnly
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-foreground-secondary font-medium">USD</span>
              </div>
              <ArrowRightLeft className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="relative flex-1">
                <input 
                  type="number" 
                  placeholder="0.00" 
                  className="w-full bg-background border border-border rounded-xl pl-4 pr-12 py-3 text-sm text-foreground placeholder-muted-foreground outline-none cursor-not-allowed opacity-70" 
                  disabled 
                  readOnly
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-foreground-secondary font-medium">USDT</span>
              </div>
            </div>
            <button disabled className="w-full py-3 rounded-xl bg-emerald-500 text-white font-semibold text-sm opacity-50 cursor-not-allowed">
              Buy Crypto
            </button>
            <p className="text-[10px] text-center text-foreground-secondary italic">* Mock feature - Integration required</p>
          </div>
          
          {/* Withdraw to Fiat Showcase */}
          <div className="p-5 rounded-2xl bg-background border border-border space-y-4 hover:border-blue-500/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Withdraw to Fiat</h3>
                <p className="text-xs text-foreground-secondary">Send Crypto earnings to Bank Account</p>
              </div>
            </div>
            
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <input 
                  type="number" 
                  placeholder="0.00" 
                  className="w-full bg-background border border-border rounded-xl pl-4 pr-12 py-3 text-sm text-foreground placeholder-muted-foreground outline-none cursor-not-allowed opacity-70" 
                  disabled 
                  readOnly
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-foreground-secondary font-medium">USDT</span>
              </div>
              <ArrowRightLeft className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="relative flex-1">
                <input 
                  type="number" 
                  placeholder="0.00" 
                  className="w-full bg-background border border-border rounded-xl pl-4 pr-12 py-3 text-sm text-foreground placeholder-muted-foreground outline-none cursor-not-allowed opacity-70" 
                  disabled 
                  readOnly
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-foreground-secondary font-medium">USD</span>
              </div>
            </div>
            <button disabled className="w-full py-3 rounded-xl bg-blue-500 text-white font-semibold text-sm opacity-50 cursor-not-allowed">
              Withdraw to Bank
            </button>
            <p className="text-[10px] text-center text-foreground-secondary italic">* Mock feature - Integration required</p>
          </div>
        </div>
      </motion.div>

    </div>
  );
}
