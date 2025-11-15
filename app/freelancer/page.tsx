"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Wallet,
  User,
  Briefcase,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  Star,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { getContract, readContract } from "thirdweb";
import { getWalletBalance } from "thirdweb/wallets";
import { polygonAmoy } from "thirdweb/chains";
import { client } from "@/lib/thirdweb";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { CHAIN } from "@/lib/chains";

export default function FreelancerHome() {
  const router = useRouter();
  const account = useActiveAccount();

  const [balance, setBalance] = useState<{ displayValue: string; symbol: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    totalEarnings: 0,
    completedJobs: 0,
    rating: 0,
    isKYCVerified: false,
    level: 1,
    stars: 1,
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
    const interval = setInterval(fetchBalance, 15000);
    return () => clearInterval(interval);
  }, [account?.address]);

  // ===== Fetch Profile Data =====
  useEffect(() => {
    if (!account?.address) return;

    const loadProfile = async () => {
      try {
        const factory = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory,
        });

        const profileAddr = await readContract({
          contract: factory as any,
          method: `function freelancerProfile(address) view returns (address)`,
          params: [account.address],
        });

        if (!profileAddr || profileAddr === "0x0000000000000000000000000000000000000000") return;

        const profileContract = getContract({
          client,
          chain: CHAIN,
          address: profileAddr as `0x${string}`,
        });

        const safeRead = async (method: `function ${string}`) => {
          try {
            return await readContract<any, any>({ contract: profileContract as any, method });
          } catch {
            console.warn("Missing field:", method);
            return null;
          }
        };

        const [name, bio, totalEarnings, completedJobs, rating, isKYCVerified] = await Promise.all([
          safeRead(`function name() view returns (string)`),
          safeRead(`function bio() view returns (string)`),
          safeRead(`function totalEarnings() view returns (uint256)`),
          safeRead(`function completedJobs() view returns (uint256)`),
          safeRead(`function rating() view returns (uint256)`),
          safeRead(`function isKYCVerified() view returns (bool)`),
        ]);

        const completed = Number(completedJobs || 0);
        let level = 1;
        let stars = 1;
        if (completed >= 3 && completed < 6) { level = 2; stars = 2; }
        else if (completed >= 6 && completed < 11) { level = 3; stars = 3; }
        else if (completed >= 11 && completed < 21) { level = 4; stars = 4; }
        else if (completed >= 21) { level = 5; stars = 5; }

        setProfile({ name: name || "Unnamed", bio: bio || "No bio yet", profileAddress: profileAddr });

        setStats({
          totalEarnings: Number(totalEarnings || 0) / 1e18,
          completedJobs: completed,
          rating: Number(rating || 0),
          isKYCVerified: Boolean(isKYCVerified),
          level,
          stars,
        });
      } catch (err) {
        console.error("Failed to load profile data:", err);
      }
    };

    loadProfile();
  }, [account?.address]);

  if (!account)
    return <div className="p-4 md:p-8">Please connect your wallet to view dashboard.</div>;

  return (
    <main className="flex-1 p-4 md:p-8 overflow-y-auto space-y-8">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 w-full">
        <div className="w-full">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground break-words">
            Welcome Back, {profile?.name || "Freelancer"} 👋
          </h1>

          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
            {stats.isKYCVerified ? (
              <span className="flex items-center gap-1 text-green-500">
                <ShieldCheck className="w-4 h-4" /> KYC Verified
              </span>
            ) : (
              <span className="text-yellow-400">KYC Pending</span>
            )}

            <span className="ml-2">Level {stats.level}</span>

            <span className="flex ml-1">
              {Array.from({ length: stats.stars }).map((_, i) => (
                <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              ))}
            </span>
          </div>
        </div>

        <button
          onClick={() => router.push("/freelancer/Profile")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition w-full md:w-auto justify-center"
        >
          <User className="w-4 h-4" />
          Profile
        </button>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full">
        {[
          { icon: DollarSign, label: "Total Earnings", value: `${stats.totalEarnings.toFixed(2)} USDT` },
          { icon: Briefcase, label: "Completed Jobs", value: stats.completedJobs.toString() },
          { icon: TrendingUp, label: "Job Success Rate", value: stats.rating ? `${stats.rating}%` : "N/A" },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className="p-6 rounded-2xl glass-effect border border-border shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="w-full">
              <p className="text-sm text-foreground-secondary">{stat.label}</p>
              <h2 className="text-2xl font-semibold break-words">{stat.value}</h2>
            </div>
            <stat.icon className="w-6 h-6 text-primary flex-shrink-0" />
          </motion.div>
        ))}
      </div>

      {/* WALLET + SMART ACCOUNT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl p-6 glass-effect border border-border shadow-md break-words"
        >
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Smart Account
          </h2>
          <p className="text-sm text-foreground-secondary">
            {`${account.address.slice(0, 6)}...${account.address.slice(-4)}`}
          </p>
          <p className="text-[10px] text-foreground-secondary break-all mt-1">
            {account.address}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-2xl p-6 glass-effect border border-border shadow-md break-words"
        >
          <h2 className="text-xl font-bold mb-3">Wallet Balance</h2>

          {loading ? (
            <p className="text-foreground-secondary">Fetching balance…</p>
          ) : balance ? (
            <p className="text-3xl font-bold text-primary break-words">
              {balance.displayValue} {balance.symbol}
            </p>
          ) : (
            <p className="text-foreground-secondary break-words">
              {account?.address ? "0 POL or failed to load balance" : "Connect your wallet"}
            </p>
          )}
        </motion.div>
      </div>
    </main>
  );
}
