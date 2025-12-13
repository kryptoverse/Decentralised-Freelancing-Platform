"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Wallet as WalletIcon } from "lucide-react";
import {
  ConnectButton,
  useActiveAccount,
  useActiveWallet, // ✅ added
  useDisconnect,
} from "thirdweb/react";
import { inAppWallet } from "thirdweb/wallets";
import { polygonAmoy } from "thirdweb/chains";
import { client } from "@/lib/thirdweb-client";

interface WalletConnectProps {
  selectedRole: string | null;
  onConnect: () => void;
}

export function WalletConnect({ selectedRole, onConnect }: WalletConnectProps) {
  const account = useActiveAccount();
  const wallet = useActiveWallet(); // ✅ gives Wallet<WalletId> instance
  const { disconnect } = useDisconnect();

  useEffect(() => {
    if (account?.address) onConnect();
  }, [account, onConnect]);

  const wallets = [
    inAppWallet({
      auth: { options: ["google", "email"] },
      executionMode: {
        mode: "EIP4337",
        smartAccount: {
          chain: polygonAmoy,
          sponsorGas: true,
        },
      },
    }),
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-4"
    >
      {/* Wallet Info Box */}
      <div className="p-4 rounded-2xl bg-surface-secondary border border-border">
        <div className="flex items-center gap-3 mb-2">
          <WalletIcon className="w-5 h-5 text-secondary" />
          <span className="font-medium text-foreground">Polygon Amoy Network</span>
        </div>

        {account ? (
          <>
            <p className="text-sm text-foreground-secondary break-words">
              Connected Wallet:{" "}
              <span className="text-primary">{account.address}</span>
            </p>
            <p className="text-xs text-foreground-secondary mt-2">
              Gas sponsored by Decentralized Freelancing 🚀
            </p>
          </>
        ) : (
          <p className="text-sm text-foreground-secondary">
            Sign in with Google or Email to create your in-app wallet.
          </p>
        )}
      </div>

      {/* Connect Wallet Button */}
      <ConnectButton
        client={client}
        wallets={wallets}
        autoConnect={true}
        theme="dark"
        connectModal={{ size: "compact" }}
      />

      {/* Disconnect Button */}
      {wallet && (
        <button
          onClick={() => disconnect(wallet)} // ✅ pass Wallet instance, not Account
          className="w-full text-sm text-red-400 hover:text-red-500 underline"
        >
          Disconnect Wallet
        </button>
      )}
    </motion.div>
  );
}
