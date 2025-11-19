"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { getContract, readContract } from "thirdweb";
import { client } from "@/lib/thirdweb-client";
import { polygonAmoy } from "thirdweb/chains";
import { motion } from "framer-motion";

const USDT_ADDRESS = "0x4eC3e0BeCEC0054397f140eF2501191bE93A19cA";

export default function SettingsPage() {
  const account = useActiveAccount();
  const router = useRouter();

  const [usdtBalance, setUsdtBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);

  // ================================
  // Fetch USDT Balance (inline, no hooks)
  // ================================
  useEffect(() => {
    async function loadBalance() {
      if (!account?.address) return;

      try {
        setLoading(true);

        const usdt = getContract({
          client,
          chain: polygonAmoy,
          address: USDT_ADDRESS,
        });

        const bal = await readContract({
          contract: usdt,
          method: "function balanceOf(address) view returns (uint256)",
          params: [account.address],
        });

        setUsdtBalance(BigInt(bal));
      } catch (err) {
        console.error("USDT Balance Error:", err);
        setUsdtBalance(0n);
      } finally {
        setLoading(false);
      }
    }

    loadBalance();
  }, [account]);

  // ================================
  // Require Wallet Connection
  // ================================
  if (!account) {
    return (
      <section className="p-8 text-lg font-medium">
        Please connect your wallet to access settings.
      </section>
    );
  }

  // ================================
  // Main UI
  // ================================
  return (
    <section className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">Settings</h1>

      {/* Wallet Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="rounded-2xl p-6 border border-border glass-effect shadow-md"
      >
        <h2 className="text-xl font-semibold mb-3">Wallet Information</h2>

        <p className="text-sm text-muted-foreground mb-1">
          Smart Account Address:
        </p>

        <p className="font-mono text-primary mb-4 break-all">
          {account?.address}
        </p>

        {/* USDT Balance */}
        <div className="mt-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">USDT Balance:</span>{" "}
            {loading || usdtBalance === null
              ? "Loading..."
              : `${(Number(usdtBalance) / 1_000_000).toLocaleString()} USDT`}
          </p>
        </div>
      </motion.div>

      {/* Account Actions */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.1 }}
        className="rounded-2xl p-6 border border-border glass-effect shadow-md"
      >
        <h2 className="text-xl font-semibold mb-4">Account Actions</h2>

        <div className="space-y-3">
          <button
            onClick={() => router.push("/profile")}
            className="w-full px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition"
          >
            Edit Profile
          </button>

          <button
            disabled={loading}
            className="w-full px-4 py-2 rounded-xl bg-destructive text-destructive-foreground hover:opacity-90 transition"
          >
            Disconnect Wallet
          </button>
        </div>
      </motion.div>
    </section>
  );
}
