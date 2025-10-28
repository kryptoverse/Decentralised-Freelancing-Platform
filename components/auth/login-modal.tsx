"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ConnectEmbed } from "thirdweb/react";
import { client, inAppSmartWallet } from "@/lib/thirdweb";

interface LoginModalProps {
  onLogin: () => void;
  onClose: () => void;
}

export function LoginModal({ onLogin, onClose }: LoginModalProps) {
  const handleConnect = async (account: any) => {
    try {
      // ✅ deploy wallet immediately so it can hold POL
      await account?.sendTransaction?.({
        to: account.address,
        value: 0n,
      });
      console.log("✅ Smart wallet deployed:", account.address);
    } catch (err) {
      console.warn("Deployment skipped:", err);
    }
    onLogin();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex items-center justify-center bg-black/50 z-50"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-surface rounded-2xl p-8 w-[90%] max-w-md shadow-xl text-center"
        >
          <h2 className="text-2xl font-bold mb-4 text-foreground">
            Login to FYP
          </h2>
          <p className="text-foreground-secondary mb-6">
            Sign in with Google or Email to continue.
          </p>

          {/* ✅ Embed handles connection & auto persistence */}
          <ConnectEmbed
            client={client}
            wallets={[inAppSmartWallet]}
            autoConnect={true}
            onConnect={handleConnect}
          />

          <button
            onClick={onClose}
            className="mt-4 text-sm text-foreground-secondary hover:text-foreground"
          >
            Cancel
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
