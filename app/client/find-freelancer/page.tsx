"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getContract, readContract } from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { Star } from "lucide-react";

import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { ipfsToHttp } from "@/utils/ipfs";

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
      profileData?: any;
    }[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ================================
  // LOAD FREELANCERS
  // ================================
  useEffect(() => {
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

              // Fetch profile metadata from IPFS if it exists
              let profileData = null;
              if (profileURI && (profileURI as string).trim() !== "") {
                try {
                  const res = await fetch(ipfsToHttp(profileURI as string));
                  profileData = await res.json();
                } catch (e) {
                  console.warn("Could not fetch profile metadata for", wallet);
                }
              }

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
                profileData,
              };
            } catch (err) {
              console.warn("Failed to load freelancer:", wallet, err);
              return null;
            }
          })
        );

        // Filter to show only KYC-verified freelancers
        const verified = results.filter((f) => f && f.isKYCVerified) as any[];
        setFreelancers(verified);
      } catch (err: any) {
        console.error("Fetch error:", err);
        setError(err?.message || "Failed to load freelancers");
      } finally {
        setLoading(false);
      }
    }

    fetchFreelancers();
  }, []);

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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="group relative rounded-2xl bg-card border border-border/40 p-5 hover:border-border transition-all duration-300 flex flex-col"
            >
              <div className="flex gap-4">
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-muted border border-border/50 flex items-center justify-center">
                    {f.profileData?.profileImage ? (
                      <img
                        src={ipfsToHttp(f.profileData.profileImage)}
                        alt={f.name || "Freelancer Avatar"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-semibold text-muted-foreground">
                        {f.name?.[0]?.toUpperCase() || "F"}
                      </span>
                    )}
                  </div>
                  {f.isKYCVerified && (
                    <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5" title="KYC Verified">
                      <div className="bg-green-500/20 text-green-500 rounded-full p-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>

                {/* Header Info */}
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex justify-between items-start gap-2">
                    <h2 className="text-base font-semibold text-foreground truncate">
                      {f.name || "Anonymous"}
                    </h2>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full whitespace-nowrap">
                      <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                      <span className="font-medium text-foreground">{f.rating}%</span>
                      <span className="opacity-50 mx-1">•</span>
                      <span>Lvl {f.level}</span>
                    </div>
                  </div>
                  {f.profileData?.headline ? (
                    <p className="text-xs text-primary font-medium mt-0.5 truncate pr-2">
                      {f.profileData.headline}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                      {f.address.slice(0, 6)}...{f.address.slice(-4)}
                    </p>
                  )}
                </div>
              </div>

              {/* Bio */}
              <p className="text-sm text-muted-foreground line-clamp-2 mt-4 flex-1">
                {f.bio || "Available for freelance work."}
              </p>

              {/* Skills (if available) */}
              {f.profileData?.skills && f.profileData.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {f.profileData.skills.slice(0, 3).map((skill: string, idx: number) => (
                    <span key={idx} className="text-[10px] bg-muted/50 px-2 py-0.5 rounded text-foreground-secondary truncate max-w-[100px]">
                      {skill}
                    </span>
                  ))}
                  {f.profileData.skills.length > 3 && (
                    <span className="text-[10px] bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground">
                      +{f.profileData.skills.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Footer / Action */}
              <div className="mt-5 flex items-center justify-between pt-4 border-t border-border/40">
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{f.completedJobs}</span> jobs completed
                </div>
                <button
                  onClick={() => router.push(`/freelancer/${f.address}`)}
                  className="text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1 group/btn"
                >
                  View Profile
                  <svg className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
