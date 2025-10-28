"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { Wallet, Users, FileText, ShieldCheck, Briefcase } from "lucide-react";
import { getWalletBalance } from "thirdweb/wallets";
import { polygonAmoy } from "thirdweb/chains";
import { client } from "@/lib/thirdweb";
import { useEffect, useState } from "react";

export default function ClientHome() {
  const router = useRouter();
  const account = useActiveAccount();
  const [balance, setBalance] = useState<{ displayValue: string; symbol: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeEscrows: 0,
    verified: false,
  });

  // ===== Fetch Wallet Balance =====
  useEffect(() => {
    if (!account?.address) return;

    const fetchBalance = async () => {
      try {
        setLoading(true);
        const result = await getWalletBalance({
          client,
          chain: polygonAmoy,
          address: account.address,
        });
        setBalance({ displayValue: result.displayValue, symbol: result.symbol });
      } catch (err) {
        console.error("Balance fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
  }, [account?.address]);

  if (!account) {
    return <div className="p-8">Please connect your wallet to view client dashboard.</div>;
  }

  return (
    <main className="flex-1 p-8 overflow-y-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome, Client 👋
          </h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
            {stats.verified ? (
              <span className="flex items-center gap-1 text-green-500">
                <ShieldCheck className="w-4 h-4" /> Verified
              </span>
            ) : (
              <span className="text-yellow-400">Verification Pending</span>
            )}
          </div>
        </div>

        <button
          onClick={() => router.push("/client/find-freelancer")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition"
        >
          <Users className="w-4 h-4" />
          <span>Find Freelancers</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: Briefcase, label: "Total Projects", value: stats.totalProjects },
          { icon: FileText, label: "Active Escrows", value: stats.activeEscrows },
          {
            icon: Wallet,
            label: "Wallet Balance",
            value: balance
              ? `${balance.displayValue} ${balance.symbol}`
              : "Fetching...",
          },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className="p-6 rounded-2xl glass-effect border border-border shadow-md flex items-center justify-between"
          >
            <div>
              <p className="text-sm text-foreground-secondary">{stat.label}</p>
              <h2 className="text-2xl font-semibold">{stat.value}</h2>
            </div>
            <stat.icon className="w-6 h-6 text-primary" />
          </motion.div>
        ))}
      </div>
    </main>
  );
}
