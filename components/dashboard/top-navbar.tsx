"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  LogOut,
  UserSearch as UserSwitch,
  Check,
  Copy,
  CheckCheck,
  ChevronDown,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useActiveAccount, useDisconnect, useActiveWallet } from "thirdweb/react"; // ✅ added useActiveWallet
import { useRouter } from "next/navigation";
import { ROLE_ROUTES, ROLE_LABELS } from "@/src/config/roles-config";

interface TopNavbarProps {
  userRole: keyof typeof ROLE_ROUTES | null;
  onLogout: () => void;
  onRoleChange: (role: keyof typeof ROLE_ROUTES) => void;
}

export function TopNavbar({ userRole, onLogout, onRoleChange }: TopNavbarProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [walletDropdown, setWalletDropdown] = useState(false);
  const [showSmartAccount, setShowSmartAccount] = useState(true);
  const [smartAddress, setSmartAddress] = useState<string | null>(null);
  const [eoaAddress, setEoaAddress] = useState<string | null>(null);

  const account = useActiveAccount();
  const wallet = useActiveWallet(); // ✅ get the connected wallet instance
  const disconnect = useDisconnect();
  const router = useRouter();

  // --------------------------------------------------
  // Update wallet display when account changes
  // --------------------------------------------------
  useEffect(() => {
    if (account) {
      setSmartAddress(account.address || null);
      setEoaAddress((account as any)?.walletAddress || null);
    } else {
      setSmartAddress(null);
      setEoaAddress(null);
    }
  }, [account]);

  // --------------------------------------------------
  // Logout handler
  // --------------------------------------------------
  const handleLogout = async () => {
    try {
      if (wallet) {
        // ✅ disconnect the currently active wallet
        await disconnect.disconnect(wallet);
      }

      // ✅ clear any cached Thirdweb auth sessions
      localStorage.removeItem("thirdweb:auth:session");
      localStorage.removeItem("thirdweb:connected_wallet");
    } catch (err) {
      console.error("Logout error:", err);
    }

    onLogout();
    setProfileOpen(false);
    router.push("/"); // ✅ redirect to landing page
  };

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------
  const roleDisplay = userRole
    ? userRole.charAt(0).toUpperCase() + userRole.slice(1)
    : "No Role";

  const selectedAddress = showSmartAccount ? smartAddress : eoaAddress;

  const handleCopy = async () => {
    if (selectedAddress) {
      await navigator.clipboard.writeText(selectedAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shortenAddress = (address: string) =>
    `${address.slice(0, 6)}...${address.slice(-4)}`;

  const handleRoleChange = (role: keyof typeof ROLE_ROUTES) => {
    onRoleChange(role);
    router.push(`/${ROLE_ROUTES[role]}`);
    setProfileOpen(false);
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <nav className="border-b border-border glass-effect-dark sticky top-0 z-10">
      <div className="px-6 md:px-8 py-4 flex items-center justify-between">
        {/* Left: Wallet */}
        <div className="relative flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Wallet className="w-5 h-5 text-primary" />
          </div>

          {selectedAddress ? (
            <div className="flex items-center gap-2 relative">
              <div>
                <button
                  onClick={() => setWalletDropdown(!walletDropdown)}
                  className="flex items-center gap-1 text-left"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-foreground-secondary">
                        {showSmartAccount ? (
                          <span className="text-purple-400 font-medium">
                            Smart Account
                          </span>
                        ) : (
                          <span className="text-blue-400 font-medium">
                            Base Wallet
                          </span>
                        )}
                      </p>
                      <ChevronDown className="w-3 h-3 text-foreground-secondary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {shortenAddress(selectedAddress)}
                    </p>
                  </div>
                </button>

                {/* Wallet Dropdown */}
                <AnimatePresence>
                  {walletDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-full left-0 mt-1 w-48 rounded-xl bg-surface border border-border shadow-lg overflow-hidden z-50"
                    >
                      {smartAddress && (
                        <button
                          onClick={() => {
                            setShowSmartAccount(true);
                            setWalletDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-secondary ${
                            showSmartAccount
                              ? "text-purple-400 font-medium"
                              : "text-foreground"
                          }`}
                        >
                          🟣 Smart Account{" "}
                          <span className="text-xs">
                            ({shortenAddress(smartAddress)})
                          </span>
                        </button>
                      )}
                      {eoaAddress && (
                        <button
                          onClick={() => {
                            setShowSmartAccount(false);
                            setWalletDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-secondary ${
                            !showSmartAccount
                              ? "text-blue-400 font-medium"
                              : "text-foreground"
                          }`}
                        >
                          🔵 Base Wallet{" "}
                          <span className="text-xs">
                            ({shortenAddress(eoaAddress)})
                          </span>
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Copy */}
              <button
                onClick={handleCopy}
                className="p-1 rounded-md hover:bg-surface-secondary transition-all"
              >
                {copied ? (
                  <CheckCheck className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-primary" />
                )}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-xs text-foreground-secondary">Wallet</p>
              <p className="text-sm text-foreground-secondary">Not connected</p>
            </div>
          )}
        </div>

        {/* Right: Theme + Profile */}
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-semibold hover:shadow-lg"
              title="Open profile menu"
            >
              {userRole ? roleDisplay[0] : "?"}
            </button>

            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 mt-2 w-56 rounded-2xl overflow-hidden shadow-xl bg-surface border-2 border-border"
                >
                  {/* Current Role */}
                  <div className="px-4 py-3 border-b border-border bg-surface-secondary">
                    <p className="text-xs text-foreground-secondary font-medium">
                      Current Role
                    </p>
                    <p className="font-bold text-foreground text-lg">
                      {userRole ? roleDisplay : "No Role Selected"}
                    </p>
                  </div>

                  {/* Switch Role */}
                  <div className="border-b border-border">
                    <p className="px-4 pt-3 pb-2 text-xs text-foreground-secondary font-medium">
                      Switch Role
                    </p>
                    {Object.keys(ROLE_ROUTES).map((role) => (
                      <button
                        key={role}
                        onClick={() => handleRoleChange(role as any)}
                        className="w-full px-4 py-2 flex items-center gap-3 text-foreground hover:bg-surface-secondary text-left font-medium"
                      >
                        <UserSwitch className="w-4 h-4 text-primary" />
                        <span className="flex-1">
                          {ROLE_LABELS[role as keyof typeof ROLE_LABELS]}
                        </span>
                        {userRole === role && (
                          <Check className="w-4 h-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Logout */}
                  <button
                    onClick={handleLogout} // ✅ uses activeWallet now
                    className="w-full px-4 py-3 flex items-center gap-3 text-error hover:bg-surface-secondary text-left font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </nav>
  );
}
