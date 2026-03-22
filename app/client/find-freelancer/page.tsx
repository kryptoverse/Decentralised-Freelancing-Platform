"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getContract, readContract } from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { Star, Loader2, Users, Scale, Award } from "lucide-react";

import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { ipfsToHttp } from "@/utils/ipfs";
import { AIFreelancerHelper } from "@/components/client/AIFreelancerHelper";

interface Freelancer {
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
}

export default function FindFreelancerPage() {
  const account = useActiveAccount();
  const router = useRouter();

  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [selectedForAI, setSelectedForAI] = useState<Freelancer[]>([]);

  const [allWallets, setAllWallets] = useState<string[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || isLoadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && processedCount < allWallets.length) {
        loadMoreFreelancers();
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, isLoadingMore, processedCount, allWallets.length]);

  // ================================
  // LOAD FREELANCERS
  // ================================
  useEffect(() => {
    async function fetchInitial() {
      try {
        setLoading(true);
        setError(null);

        const factory = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory,
        });

        const freelancerWallets = await readContract({
          contract: factory,
          method: "function getAllFreelancers() view returns (address[])",
        }) as string[];

        if (!freelancerWallets || freelancerWallets.length === 0) {
          setFreelancers([]);
          setAllWallets([]);
          return;
        }

        const reversedWallets = [...freelancerWallets].reverse();
        setAllWallets(reversedWallets);

        await loadFreelancerDetails(reversedWallets.slice(0, 5), factory, true);
        setProcessedCount(Math.min(5, reversedWallets.length));
      } catch (err: any) {
        console.error("Fetch error:", err);
        setError(err?.message || "Failed to load freelancers");
      } finally {
        setLoading(false);
      }
    }

    fetchInitial();
  }, []);

  const loadFreelancerDetails = async (walletsToLoad: string[], factory: any, isInitial: boolean = false) => {
    const results = await Promise.all(
      walletsToLoad.map(async (wallet: string) => {
        try {
          if (!wallet || !wallet.startsWith("0x")) return null;

          const profileAddr = await readContract({
            contract: factory,
            method: "function freelancerProfile(address) view returns (address)",
            params: [wallet as `0x${string}`],
          });

          if (!profileAddr || profileAddr === "0x0000000000000000000000000000000000000000") {
            return null;
          }

          const profile = getContract({
            client,
            chain: CHAIN,
            address: profileAddr as `0x${string}`,
          });

          const [
            name, bio, profileURI, totalPoints,
            completedJobs, level, isKYCVerified,
          ] = await Promise.all([
            readContract({ contract: profile, method: "function name() view returns (string)" }),
            readContract({ contract: profile, method: "function bio() view returns (string)" }),
            readContract({ contract: profile, method: "function profileURI() view returns (string)" }),
            readContract({ contract: profile, method: "function totalPoints() view returns (uint256)" }),
            readContract({ contract: profile, method: "function completedJobs() view returns (uint256)" }),
            readContract({ contract: profile, method: "function level() view returns (uint8)" }),
            readContract({ contract: profile, method: "function isKYCVerified() view returns (bool)" }),
          ]);

          const rating = Number(completedJobs) > 0
            ? Math.min(100, Math.round((Number(totalPoints) / Number(completedJobs)) * 20))
            : 0;

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
            name, bio, profileURI, rating,
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

    const verified = results.filter((f) => f && f.isKYCVerified) as any[];
    if (isInitial) {
      setFreelancers(verified);
    } else {
      setFreelancers(prev => [...prev, ...verified]);
    }
  };

  const loadMoreFreelancers = async () => {
    if (isLoadingMore || processedCount >= allWallets.length) return;
    setIsLoadingMore(true);
    try {
      const factory = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory,
      });
      const nextBatch = allWallets.slice(processedCount, processedCount + 5);
      await loadFreelancerDetails(nextBatch, factory, false);
      setProcessedCount(prev => prev + nextBatch.length);
    } catch (err) {
      console.error("Error loading more freelancers", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const toggleSelection = (f: Freelancer) => {
    setSelectedForAI(prev => {
      const exists = prev.find(item => item.address === f.address);
      if (exists) return prev.filter(item => item.address !== f.address);
      if (prev.length >= 10) {
        alert("Maximum 10 freelancers can be compared at once.");
        return prev;
      }
      return [...prev, f];
    });
  };

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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Available Freelancers</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Browse and compare top talent for your next project.
          </p>
        </div>
      </div>

      <AIFreelancerHelper 
        selectedFreelancers={selectedForAI}
        onRemove={(addr) => setSelectedForAI(prev => prev.filter(f => f.address !== addr))}
      />

      {freelancers.length === 0 ? (
        <p className="text-muted-foreground">
          No freelancers have created profiles yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {freelancers.map((f, i) => {
              const isSelected = !!selectedForAI.find(item => item.address === f.address);
              return (
                <motion.div
                  ref={freelancers.length === i + 1 ? lastElementRef : null}
                  key={f.address}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className={`group relative rounded-[2rem] bg-card border transition-all duration-300 flex flex-col overflow-hidden ${isSelected ? 'border-primary ring-2 ring-primary/40 shadow-2xl scale-[1.02]' : 'border-border/40 hover:border-primary/50'}`}
                >
                  <div className="p-6 flex-1 flex flex-col space-y-4">
                    <div className="flex gap-4 relative">
                      {/* Selection Toggle */}
                      <button 
                          onClick={(e) => { e.stopPropagation(); toggleSelection(f); }}
                          className={`absolute top-0 right-0 p-2.5 rounded-xl border transition-all z-20 ${isSelected ? 'bg-primary text-white border-primary shadow-lg scale-110 opacity-100' : 'bg-surface/80 text-muted-foreground border-border hover:border-primary/50 opacity-100 sm:opacity-0 group-hover:opacity-100 hover:scale-110'}`}
                          title="Add to AI Comparison"
                      >
                          <Scale className="w-4 h-4" />
                      </button>

                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-muted border border-border/50 flex items-center justify-center">
                          {f.profileData?.profileImage ? (
                            <img
                              src={ipfsToHttp(f.profileData.profileImage)}
                              alt={f.name || "Freelancer Avatar"}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-2xl font-bold text-muted-foreground">
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
                          <h2 className="text-lg font-bold text-foreground truncate pr-6">
                            {f.name || "Anonymous"}
                          </h2>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground bg-muted/30 w-fit px-2 py-0.5 rounded-full">
                          <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                          <span className="font-bold text-foreground">{f.rating}%</span>
                          <span className="opacity-50 mx-1">•</span>
                          <span className="font-medium">Lvl {f.level}</span>
                        </div>
                        {f.profileData?.headline && (
                          <p className="text-xs text-primary font-bold mt-2 truncate pr-2 uppercase tracking-wide">
                            {f.profileData.headline}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bio */}
                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                      {f.bio || "Available for freelance work."}
                    </p>

                    {/* Skills */}
                    {f.profileData?.skills && f.profileData.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {f.profileData.skills.slice(0, 3).map((skill: string, idx: number) => (
                          <span key={idx} className="text-[10px] bg-primary/5 border border-primary/10 px-2.5 py-1 rounded-lg text-foreground-secondary font-medium">
                            {skill}
                          </span>
                        ))}
                        {f.profileData.skills.length > 3 && (
                          <span className="text-[10px] bg-muted/50 px-2 py-1 rounded-lg text-muted-foreground font-medium">
                            +{f.profileData.skills.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer / Action */}
                  <div className="p-6 border-t border-border/40 bg-surface/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-500">
                        <Award className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        <span className="font-bold text-foreground">{f.completedJobs}</span> jobs completed
                      </div>
                    </div>
                    <button
                      onClick={() => router.push(`/freelancer/${f.address}`)}
                      className="px-4 py-2 bg-background border border-border hover:border-primary/50 text-xs font-bold rounded-xl transition-all active:scale-95"
                    >
                      View Profile
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
      
      {isLoadingMore && (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      )}
    </section>
  );
}
