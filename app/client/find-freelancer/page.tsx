"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getContract, readContract } from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { AlertCircle, User } from "lucide-react";

import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";

export default function FindFreelancerPage() {
  const account = useActiveAccount();
  const router = useRouter();

  const [freelancers, setFreelancers] = useState<
    {
      address: string;
      name: string;
      bio: string;
      profileURI: string;
      rating: number;
      completedJobs: number;
      totalPoints: number;
      isKYCVerified: boolean;
      level: number;
    }[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // ================================
  // CHECK CLIENT PROFILE
  // ================================
  useEffect(() => {
    if (!account) {
      setHasProfile(false);
      return;
    }

    async function checkProfile() {
      if (!account) return;
      
      try {
        const factory = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.ClientFactory,
        });

        const profileAddr = await readContract({
          contract: factory,
          method: "function clientProfiles(address) view returns (address)",
          params: [account.address],
        });

        const ZERO = "0x0000000000000000000000000000000000000000";
        const hasProfileValue = profileAddr !== ZERO && profileAddr !== null;
        setHasProfile(hasProfileValue);
        
        if (!hasProfileValue) {
          setShowProfileModal(true);
        }
      } catch (err) {
        console.error("Error checking profile:", err);
        setHasProfile(false);
        setShowProfileModal(true);
      }
    }

    checkProfile();
  }, [account]);

  // ================================
  // LOAD FREELANCERS
  // ================================
  useEffect(() => {
    if (hasProfile === false) {
      // Don't load freelancers if no profile
      setLoading(false);
      return;
    }

    async function fetchFreelancers() {
      try {
        setLoading(true);
        setError(null);

        // 1️⃣ Get factory
        const factory = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory,
        });

        // 2️⃣ Fetch all freelancer wallets
        const freelancerWallets = await readContract({
          contract: factory,
          method: "function getAllFreelancers() view returns (address[])",
        });

        if (!freelancerWallets || freelancerWallets.length === 0) {
          setFreelancers([]);
          return;
        }

        // 3️⃣ Fetch each freelancer details
        const results = await Promise.all(
          freelancerWallets.map(async (wallet: string) => {
            try {
              if (!wallet || !wallet.startsWith("0x")) return null;

              const profileAddr = await readContract({
                contract: factory,
                method: "function freelancerProfile(address) view returns (address)",
                params: [wallet as `0x${string}`],
              });

              if (
                !profileAddr ||
                profileAddr === "0x0000000000000000000000000000000000000000"
              ) {
                return null;
              }

              const profile = getContract({
                client,
                chain: CHAIN,
                address: profileAddr as `0x${string}`,
              });

              const [
                name,
                bio,
                profileURI,
                totalPoints,
                completedJobs,
                level,
                isKYCVerified,
              ] = await Promise.all([
                readContract({
                  contract: profile,
                  method: "function name() view returns (string)",
                }),
                readContract({
                  contract: profile,
                  method: "function bio() view returns (string)",
                }),
                readContract({
                  contract: profile,
                  method: "function profileURI() view returns (string)",
                }),
                readContract({
                  contract: profile,
                  method: "function totalPoints() view returns (uint256)",
                }),
                readContract({
                  contract: profile,
                  method: "function completedJobs() view returns (uint256)",
                }),
                readContract({
                  contract: profile,
                  method: "function level() view returns (uint8)",
                }),
                readContract({
                  contract: profile,
                  method: "function isKYCVerified() view returns (bool)",
                }),
              ]);

              // Derived Rating
              const rating =
                Number(completedJobs) > 0
                  ? Math.min(
                      100,
                      Math.round((Number(totalPoints) / Number(completedJobs)) * 20)
                    )
                  : 0;

              return {
                address: wallet,
                name,
                bio,
                profileURI,
                rating,
                completedJobs: Number(completedJobs),
                totalPoints: Number(totalPoints),
                isKYCVerified: Boolean(isKYCVerified),
                level: Number(level),
              };
            } catch (err) {
              console.warn("Failed to load freelancer:", wallet, err);
              return null;
            }
          })
        );

        setFreelancers(results.filter(Boolean) as any[]);
      } catch (err: any) {
        console.error("Fetch error:", err);
        setError(err?.message || "Failed to load freelancers");
      } finally {
        setLoading(false);
      }
    }

    if (hasProfile === true) {
      fetchFreelancers();
    }
  }, [hasProfile]);

  // ================================
  // UI STATES
  // ================================

  if (!account) {
    return (
      <section className="p-8 text-lg font-medium">
        Please connect your wallet to browse freelancers.
      </section>
    );
  }

  if (hasProfile === false && showProfileModal) {
    return (
      <section className="p-8">
        <div className="max-w-md mx-auto bg-surface rounded-2xl p-6 border border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <AlertCircle className="w-6 h-6 text-yellow-400" />
            </div>
            <h2 className="text-xl font-bold">Profile Required</h2>
          </div>
          
          <p className="text-muted-foreground mb-6">
            You need to create a client profile before you can browse freelancers. This helps establish your identity and build trust.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => setShowProfileModal(false)}
              className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-surface-secondary transition"
            >
              Cancel
            </button>
            <button
              onClick={() => router.push("/client/profile/create")}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition flex items-center justify-center gap-2"
            >
              <User className="w-4 h-4" />
              Create Profile
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="p-8 text-lg animate-pulse">
        Fetching freelancers from blockchain...
      </section>
    );
  }

  if (error) {
    return (
      <section className="p-8 text-red-500">
        <h2 className="text-xl font-semibold mb-2">Error</h2>
        <p>{error}</p>
      </section>
    );
  }

  // ================================
  // MAIN CONTENT
  // ================================
  return (
    <section className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">Available Freelancers</h1>

      {freelancers.length === 0 ? (
        <p className="text-muted-foreground">
          No freelancers have created profiles yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {freelancers.map((f, i) => (
            <motion.div
              key={f.address}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="rounded-2xl glass-effect border border-border p-6 shadow-md hover:shadow-lg transition group"
            >
              {/* Avatar + Name */}
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-gradient-primary flex items-center justify-center text-sm font-semibold text-white">
                  {f.name?.[0]?.toUpperCase() || "F"}
                </div>
                <div>
                  <h2 className="font-semibold text-lg">
                    {f.name || "Unnamed Freelancer"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {f.address.slice(0, 6)}...{f.address.slice(-4)}
                  </p>
                </div>
              </div>

              {/* Bio */}
              <p className="text-sm text-foreground-secondary line-clamp-3 mb-3">
                {f.bio || "No bio available."}
              </p>

              {/* Profile URI */}
              {f.profileURI && (
                <p className="text-xs text-muted-foreground truncate mb-3">
                  <span className="font-medium">Profile Data:</span>{" "}
                  <a
                    href={
                      f.profileURI.startsWith("ipfs://")
                        ? f.profileURI.replace("ipfs://", "https://ipfs.io/ipfs/")
                        : f.profileURI
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    View on IPFS
                  </a>
                </p>
              )}

              {/* Stats */}
              <div className="text-xs flex justify-between mb-3 text-muted-foreground">
                <span>{f.completedJobs} jobs</span>
                <span>{f.rating}% rating</span>
                <span>Lvl {f.level}</span>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-4">
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    f.isKYCVerified
                      ? "bg-green-500/20 text-green-500"
                      : "bg-yellow-500/20 text-yellow-500"
                  }`}
                >
                  {f.isKYCVerified ? "KYC Verified" : "Not Verified"}
                </span>

                <button
                  onClick={() => router.push(`/freelancer/${f.address}`)}
                  className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-sm hover:opacity-90 transition"
                >
                  View Profile
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
