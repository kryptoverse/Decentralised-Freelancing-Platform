"use client";

import { useState, useEffect } from "react";
import { Wallet, CheckCircle2, X } from "lucide-react";
import { useActiveWallet, useActiveAccount, useDisconnect } from "thirdweb/react";
import { ConnectButton } from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";
import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";

interface MetaMaskConnectorProps {
  onAccountChange?: (address: string | null) => void;
}

export function MetaMaskConnector({ onAccountChange }: MetaMaskConnectorProps) {
  const activeWallet = useActiveWallet();
  const activeAccount = useActiveAccount();
  const { disconnect } = useDisconnect();
  const [metamaskAddress, setMetamaskAddress] = useState<string | null>(null);

  // Check if MetaMask is available
  const [isMetaMaskAvailable, setIsMetaMaskAvailable] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ethereum = (window as any).ethereum;
      setIsMetaMaskAvailable(
        typeof ethereum !== "undefined" &&
        ethereum.isMetaMask === true
      );
    }
  }, []);

  // Monitor MetaMask wallet connection
  useEffect(() => {
    const checkMetaMaskConnection = async () => {
      if (activeWallet?.id === "io.metamask") {
        try {
          const account = await activeWallet.getAccount();
          if (account) {
            setMetamaskAddress(account.address);
            if (onAccountChange) {
              onAccountChange(account.address);
            }
          }
        } catch (e) {
          console.error("Error getting MetaMask account:", e);
        }
      } else {
        setMetamaskAddress(null);
        if (onAccountChange) {
          onAccountChange(null);
        }
      }
    };

    checkMetaMaskConnection();
  }, [activeWallet, onAccountChange]);

  const handleDisconnect = async () => {
    if (activeWallet && activeWallet.id === "io.metamask") {
      await disconnect(activeWallet);
      setMetamaskAddress(null);
      if (onAccountChange) {
        onAccountChange(null);
      }
    }
  };

  const metamaskWalletConfig = createWallet("io.metamask");
  const isConnected = activeWallet?.id === "io.metamask" && metamaskAddress !== null;

  if (!isMetaMaskAvailable) {
    return (
      <div className="p-4 border border-yellow-500/50 rounded-xl glass-effect bg-yellow-500/10">
        <div className="flex items-center gap-2 text-yellow-400">
          <X className="w-5 h-5" />
          <p className="text-sm">
            MetaMask is not installed. Please install{" "}
            <a
              href="https://metamask.io"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-yellow-300"
            >
              MetaMask
            </a>{" "}
            to use this feature.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border border-border rounded-xl glass-effect">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">MetaMask Wallet (Admin Only)</h3>
        </div>
        {isConnected && (
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm">Connected</span>
          </div>
        )}
      </div>

      {isConnected ? (
        <div className="space-y-3">
          <div className="p-3 bg-surface-secondary rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Connected Address:</p>
            <p className="text-sm font-mono break-all">{metamaskAddress}</p>
          </div>
          <button
            onClick={handleDisconnect}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
          >
            Disconnect MetaMask
          </button>
          <p className="text-xs text-muted-foreground">
            ⚠️ This MetaMask connection is only for admin deployment and won't affect other pages.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect your MetaMask wallet to deploy contracts. This connection is
            isolated and won't affect other pages.
          </p>
          <ConnectButton
            client={client}
            wallets={[metamaskWalletConfig]}
            chain={CHAIN}
            connectModal={{
              size: "compact",
            }}
          />
        </div>
      )}
    </div>
  );
}

