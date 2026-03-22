"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { getContract, readContract } from "thirdweb";
import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { ipfsToHttp } from "@/utils/ipfs";

import { ProfileLoader } from "@/components/freelancer/profile/ProfileLoader";
import { FreelancerProfileForm } from "@/components/freelancer/profile/ProfileForm";

import { Copy, Check, DollarSign, Briefcase, TrendingUp, Star, RefreshCw, ExternalLink, Pencil, Link2, FileText, Award, GraduationCap, FolderOpen, Play, User } from "lucide-react";
import { motion } from "framer-motion";

// 👇 This matches the Metadata interface inside ProfileForm.tsx
interface ProfileMetadata {
  name: string;
  headline: string;
  bio: string;
  profileImage?: string;
  introVideo?: string;
  skills: string[];
  education: { degree: string; institution: string; year: string }[];
  experience: { title: string; company: string; duration: string; description: string }[];
  certificates: { title: string; issuer: string; year: string; file?: string }[];
  portfolio: { title: string; description: string; link?: string; image?: string }[];
}

interface LoadedProfile {
  name: string;
  bio: string;
  profileURI: string;
  profileAddress: string;
}

interface FreelancerStats {
  totalEarnings: number;
  completedJobs: number;
  rating: number;
  level: number;
  stars: number;
}

export default function FreelancerProfilePage() {
  const account = useActiveAccount();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<LoadedProfile | null>(null);
  const [metadata, setMetadata] = useState<ProfileMetadata | null>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");

  const [stats, setStats] = useState<FreelancerStats>({
    totalEarnings: 0,
    completedJobs: 0,
    rating: 0,
    level: 0,
    stars: 1,
  });

  const [copiedWallet, setCopiedWallet] = useState(false);
  const [copiedPublicLink, setCopiedPublicLink] = useState(false);
  const [copiedProfileAddr, setCopiedProfileAddr] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);

  // ---------------------------
  // LOAD PROFILE
  // ---------------------------
  const fetchProfile = async (address: string) => {
    try {
      setLoadingStats(true);

      const factory = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory,
      });

      const profileAddr = await readContract({
        contract: factory,
        method: "function freelancerProfile(address) view returns (address)",
        params: [address as `0x${string}`],
      });

      if (
        !profileAddr ||
        profileAddr === "0x0000000000000000000000000000000000000000"
      ) {
        setProfile(null);
        setMetadata(null);
        setMode("edit");
        return;
      }

      const profileContract = getContract({
        client,
        chain: CHAIN,
        address: profileAddr as `0x${string}`,
      });

      const [name, bio, profileURI, completedJobsRaw, ratingRaw, totalPointsRaw, levelRaw, totalEarningsRaw] = await Promise.all([
        readContract({
          contract: profileContract,
          method: "function name() view returns (string)",
        }),
        readContract({
          contract: profileContract,
          method: "function bio() view returns (string)",
        }),
        readContract({
          contract: profileContract,
          method: "function profileURI() view returns (string)",
        }),
        readContract({
          contract: profileContract,
          method: "function completedJobs() view returns (uint256)",
        }).catch(() => 0n),
        readContract({
          contract: profileContract,
          method: "function rating() view returns (uint256)",
        }).catch(() => 0n),
        readContract({
          contract: profileContract,
          method: "function totalPoints() view returns (uint256)",
        }).catch(() => 0n),
        readContract({
          contract: profileContract,
          method: "function level() view returns (uint8)",
        }).catch(() => 0),
        readContract({
          contract: profileContract,
          method: "function totalEarnings() view returns (uint256)",
        }).catch(() => 0n),
      ]);

      // Calculate stats
      const completedJobs = Number(completedJobsRaw || 0);
      const totalPoints = Number(totalPointsRaw || 0);
      let level = Number(levelRaw || 0);

      // Fallback level calculation
      if (level === 0) {
        if (completedJobs >= 25 && totalPoints >= 120) level = 5;
        else if (completedJobs >= 20 && totalPoints >= 95) level = 4;
        else if (completedJobs >= 15 && totalPoints >= 70) level = 3;
        else if (completedJobs >= 10 && totalPoints >= 45) level = 2;
        else if (completedJobs >= 5 && totalPoints >= 20) level = 1;
      }

      const stars = Math.max(1, level);

      let rating = Number(ratingRaw || 0);
      if (rating === 0 && completedJobs > 0 && totalPoints > 0) {
        rating = Math.round((totalPoints / (completedJobs * 5)) * 100);
      }

      // totalEarnings stored in USDT with 6 decimals
      const totalEarnings = Number(totalEarningsRaw || 0n) / 1e6;

      setStats({
        totalEarnings,
        completedJobs,
        rating,
        level,
        stars,
      });

      setProfile({
        name,
        bio,
        profileURI,
        profileAddress: profileAddr as string,
      });

      if (profileURI && profileURI.trim() !== "") {
        try {
          const res = await fetch(ipfsToHttp(profileURI));
          const raw = (await res.json()) as Partial<ProfileMetadata>;

          const normalized: ProfileMetadata = {
            name: raw.name ?? name ?? "",
            headline: raw.headline ?? "",
            bio: raw.bio ?? bio ?? "",
            profileImage: raw.profileImage,
            introVideo: raw.introVideo,
            skills: raw.skills ?? [],
            education: raw.education ?? [],
            experience: raw.experience ?? [],
            certificates: raw.certificates ?? [],
            portfolio: raw.portfolio ?? [],
          };

          setMetadata(normalized);
        } catch (e) {
          console.warn("Failed to fetch/parse profile metadata JSON:", e);
          // fallback: build metadata from on-chain name/bio
          setMetadata({
            name,
            headline: "",
            bio,
            profileImage: undefined,
            introVideo: undefined,
            skills: [],
            education: [],
            experience: [],
            certificates: [],
            portfolio: [],
          });
        }
      } else {
        // no profileURI → build from on-chain data only
        setMetadata({
          name,
          headline: "",
          bio,
          profileImage: undefined,
          introVideo: undefined,
          skills: [],
          education: [],
          experience: [],
          certificates: [],
          portfolio: [],
        });
      }

      setMode("view");
    } catch (err) {
      console.error("❌ Failed to load profile:", err);
      setProfile(null);
      setMetadata(null);
      setMode("edit");
    } finally {
      setLoading(false);
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    const address = account?.address;
    if (!address) return;
    setLoading(true);
    fetchProfile(address).finally(() => setLoading(false));
  }, [account?.address]);

  // ---------------------------
  // COPY HELPERS
  // ---------------------------
  const handleCopyWallet = async () => {
    if (!account?.address) return;
    await navigator.clipboard.writeText(account.address);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 1500);
  };

  const handleCopyPublicLink = async () => {
    if (!account?.address || typeof window === "undefined") return;
    const url = `${window.location.origin}/freelancer/${account.address}`;
    await navigator.clipboard.writeText(url);
    setCopiedPublicLink(true);
    setTimeout(() => setCopiedPublicLink(false), 1500);
  };

  const handleCopyProfileAddress = async () => {
    if (!profile?.profileAddress) return;
    await navigator.clipboard.writeText(profile.profileAddress);
    setCopiedProfileAddr(true);
    setTimeout(() => setCopiedProfileAddr(false), 1500);
  };

  // ---------------------------
  // NOT CONNECTED
  // ---------------------------
  if (!account?.address) {
    return (
      <section className="p-6 text-center">
        <p className="text-lg font-semibold">
          Please connect your wallet to manage your freelancer profile.
        </p>
      </section>
    );
  }

  // ---------------------------
  // LOADING
  // ---------------------------
  if (loading) return <ProfileLoader />;

  // ---------------------------
  // EDIT MODE
  // ---------------------------
  if (mode === "edit") {
    return (
      <section className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <div className="flex items-center justify-between mb-5 gap-3">
          <h1 className="text-xl sm:text-2xl font-bold">
            {profile ? "Edit Your Profile" : "Create Your Profile"}
          </h1>

          {profile && (
            <button
              onClick={() => setMode("view")}
              className="px-4 py-2 rounded-xl bg-surface border border-border hover:bg-surface-secondary transition text-sm font-medium flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back to Profile</span>
              <span className="sm:hidden">Back</span>
            </button>
          )}
        </div>

        <FreelancerProfileForm
          profileAddress={profile?.profileAddress}
          existingMetadata={metadata ?? undefined}
          onSaved={() => window.location.reload()}
        />
      </section>
    );
  }

  // ---------------------------
  // VIEW MODE
  // ---------------------------

  const merged: ProfileMetadata =
    metadata ??
    ({
      name: profile?.name ?? "",
      headline: "",
      bio: profile?.bio ?? "",
      profileImage: undefined,
      introVideo: undefined,
      skills: [],
      education: [],
      experience: [],
      certificates: [],
      portfolio: [],
    } as ProfileMetadata);

  const skills = merged.skills ?? [];
  const experience = merged.experience ?? [];
  const education = merged.education ?? [];
  const certificates = merged.certificates ?? [];
  const portfolio = merged.portfolio ?? [];

  return (
    <section className="max-w-5xl mx-auto px-3 sm:px-6 py-4 md:py-8 space-y-5 md:space-y-8">

      {/* ========== HERO PROFILE CARD ========== */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="rounded-2xl border border-border overflow-hidden shadow-md"
      >
        {/* Gradient Banner */}
        <div
          className="h-28 sm:h-36 md:h-44 relative"
          style={{
            background: "linear-gradient(135deg, var(--brand-deep) 0%, var(--brand-secondary) 40%, var(--muted-green) 100%)",
          }}
        >
          {/* Action buttons floating on banner */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex gap-2">
            <button
              onClick={() => router.push(`/freelancer/${account.address}`)}
              className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-white/15 backdrop-blur-md text-white text-xs sm:text-sm font-medium hover:bg-white/25 transition-all border border-white/20 flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Public View</span>
              <span className="sm:hidden">Public</span>
            </button>
            <button
              onClick={() => setMode("edit")}
              className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-white/90 text-[var(--brand-deep)] text-xs sm:text-sm font-semibold hover:bg-white transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Edit Profile</span>
              <span className="sm:hidden">Edit</span>
            </button>
          </div>
        </div>

        {/* Profile Info Section */}
        <div className="relative bg-surface px-4 sm:px-6 md:px-8 pb-5 sm:pb-6 pt-0">
          {/* Avatar - overlapping the banner */}
          <div className="-mt-12 sm:-mt-14 md:-mt-16 mb-4 flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-shrink-0">
              {merged.profileImage ? (
                <img
                  src={ipfsToHttp(merged.profileImage)}
                  className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-2xl object-cover border-4 border-surface shadow-lg"
                  alt="Profile"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-2xl bg-primary/10 border-4 border-surface shadow-lg flex items-center justify-center">
                  <User className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-primary/60" />
                </div>
              )}
            </div>

            {/* Name & Headline - beside avatar on sm+ */}
            <div className="flex-1 min-w-0 sm:pb-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight truncate">
                {merged.name}
              </h1>
              {merged.headline && (
                <p className="text-sm sm:text-base text-foreground-secondary mt-0.5 line-clamp-2">
                  {merged.headline}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: Math.max(stats.stars, 1) }).map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                  ))}
                </div>
                <span className="text-xs font-medium text-muted-foreground bg-primary/8 px-2 py-0.5 rounded-full">
                  Level {stats.level}
                </span>
                {stats.completedJobs > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {stats.completedJobs} job{stats.completedJobs !== 1 ? "s" : ""} completed
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Wallet & Contract Row */}
          <div className="flex flex-wrap gap-2 mt-1">
            <button
              onClick={handleCopyWallet}
              className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-secondary border border-border hover:border-primary/40 transition-all text-xs text-muted-foreground hover:text-foreground"
            >
              {copiedWallet ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />}
              <span className="font-mono">{account.address.slice(0, 6)}...{account.address.slice(-4)}</span>
            </button>
            {profile?.profileAddress && (
              <button
                onClick={handleCopyProfileAddress}
                className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-secondary border border-border hover:border-primary/40 transition-all text-xs text-muted-foreground hover:text-foreground"
              >
                {copiedProfileAddr ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <FileText className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />}
                <span className="font-mono">Contract: {profile.profileAddress.slice(0, 6)}...{profile.profileAddress.slice(-4)}</span>
              </button>
            )}
            <button
              onClick={handleCopyPublicLink}
              className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-secondary border border-border hover:border-primary/40 transition-all text-xs text-muted-foreground hover:text-foreground"
            >
              {copiedPublicLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Link2 className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />}
              <span>Copy Profile Link</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* ========== STATS GRID ========== */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Performance
          </h3>
          <button
            onClick={() => account?.address && fetchProfile(account.address)}
            disabled={loadingStats}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-surface-secondary border border-transparent hover:border-border transition-all disabled:opacity-50"
            title="Refresh stats"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: "Total Earnings",
              value: `${stats.totalEarnings.toFixed(2)}`,
              suffix: "USDT",
              icon: DollarSign,
              accent: "from-emerald-500/10 to-emerald-500/5",
              iconColor: "text-emerald-600 dark:text-emerald-400",
            },
            {
              label: "Completed Jobs",
              value: `${stats.completedJobs}`,
              suffix: "",
              icon: Briefcase,
              accent: "from-blue-500/10 to-blue-500/5",
              iconColor: "text-blue-600 dark:text-blue-400",
            },
            {
              label: "Success Rate",
              value: stats.rating > 0 ? `${stats.rating}%` : "N/A",
              suffix: "",
              icon: TrendingUp,
              accent: "from-violet-500/10 to-violet-500/5",
              iconColor: "text-violet-600 dark:text-violet-400",
            },
            {
              label: "Level",
              value: `Level ${stats.level}`,
              suffix: "",
              icon: Star,
              accent: "from-amber-500/10 to-amber-500/5",
              iconColor: "text-amber-500",
              showStars: true,
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="relative p-4 sm:p-5 rounded-xl border border-border bg-surface overflow-hidden transition-all hover:shadow-md hover:border-primary/30"
            >
              {/* Subtle gradient accent */}
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.accent} pointer-events-none`} />
              <div className="relative">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <p className="text-[11px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-surface-secondary flex items-center justify-center ${stat.iconColor}`}>
                    <stat.icon className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                  </div>
                </div>
                <p className="text-lg sm:text-2xl font-bold tracking-tight">
                  {stat.value}
                  {stat.suffix && <span className="text-xs sm:text-sm font-medium text-muted-foreground ml-1">{stat.suffix}</span>}
                </p>
                {stat.showStars && (
                  <div className="flex gap-0.5 mt-1.5">
                    {Array.from({ length: 5 }).map((_, si) => (
                      <Star
                        key={si}
                        className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${si < stats.stars ? "text-yellow-500 fill-yellow-500" : "text-border"}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ========== ABOUT SECTION ========== */}
      {merged.bio && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="rounded-2xl border border-border bg-surface p-5 sm:p-6"
        >
          <h3 className="text-base sm:text-lg font-semibold mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            About
          </h3>
          <p className="text-sm sm:text-base whitespace-pre-line leading-relaxed text-foreground-secondary">
            {merged.bio}
          </p>
        </motion.div>
      )}

      {/* ========== SKILLS SECTION ========== */}
      {skills.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="rounded-2xl border border-border bg-surface p-5 sm:p-6"
        >
          <h3 className="text-base sm:text-lg font-semibold mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" />
            Skills
          </h3>
          <div className="flex flex-wrap gap-2">
            {skills.map((s, i) => (
              <span
                key={i}
                className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-primary/8 border border-primary/20 text-primary hover:bg-primary/15 transition-colors"
              >
                {s}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* ========== EXPERIENCE SECTION ========== */}
      {experience.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="rounded-2xl border border-border bg-surface p-5 sm:p-6"
        >
          <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary" />
            Experience
          </h3>
          <div className="space-y-4">
            {experience.map((exp, i) => (
              <div
                key={i}
                className="relative pl-4 sm:pl-5 border-l-2 border-primary/20 hover:border-primary/50 transition-colors"
              >
                <div className="absolute left-0 top-1 w-2 h-2 rounded-full bg-primary -translate-x-[5px]" />
                <h4 className="text-sm sm:text-base font-semibold">{exp.title}</h4>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  {exp.company} &middot; {exp.duration}
                </p>
                {exp.description && (
                  <p className="text-xs sm:text-sm text-foreground-secondary mt-2 whitespace-pre-line leading-relaxed">
                    {exp.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ========== EDUCATION SECTION ========== */}
      {education.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="rounded-2xl border border-border bg-surface p-5 sm:p-6"
        >
          <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary" />
            Education
          </h3>
          <div className="space-y-3">
            {education.map((edu, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-surface-secondary/50 border border-border/50 hover:border-primary/30 transition-colors"
              >
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm sm:text-base font-semibold truncate">{edu.degree}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {edu.institution} &middot; {edu.year}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ========== CERTIFICATES SECTION ========== */}
      {certificates.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="rounded-2xl border border-border bg-surface p-5 sm:p-6"
        >
          <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" />
            Certificates
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {certificates.map((c, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-surface-secondary/50 border border-border/50 hover:border-primary/30 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <Award className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{c.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.issuer} &middot; {c.year}
                    </p>
                    {c.file && (
                      <a
                        href={ipfsToHttp(c.file)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2 font-medium"
                      >
                        View Certificate <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ========== PORTFOLIO SECTION ========== */}
      {portfolio.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="rounded-2xl border border-border bg-surface p-5 sm:p-6"
        >
          <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-primary" />
            Portfolio
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {portfolio.map((p, i) => (
              <div
                key={i}
                className="rounded-xl border border-border/50 bg-surface-secondary/30 overflow-hidden hover:border-primary/30 hover:shadow-md transition-all group"
              >
                {p.image && (
                  <div className="h-40 sm:h-44 overflow-hidden bg-muted">
                    <img
                      src={ipfsToHttp(p.image)}
                      alt={p.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                )}
                <div className="p-4">
                  <h4 className="text-sm sm:text-base font-semibold">{p.title}</h4>
                  <p className="text-xs sm:text-sm text-foreground-secondary whitespace-pre-line mt-1.5 line-clamp-3">
                    {p.description}
                  </p>
                  {p.link && (
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-primary hover:underline mt-3 font-medium"
                    >
                      View Project <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ========== INTRO VIDEO SECTION ========== */}
      {merged.introVideo && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="rounded-2xl border border-border bg-surface p-5 sm:p-6"
        >
          <h3 className="text-base sm:text-lg font-semibold mb-3 flex items-center gap-2">
            <Play className="w-4 h-4 text-primary" />
            Intro Video
          </h3>
          <div className="rounded-xl overflow-hidden border border-border bg-black/5">
            <video
              src={ipfsToHttp(merged.introVideo)}
              controls
              className="w-full max-h-[400px] object-contain"
            />
          </div>
        </motion.div>
      )}
    </section>
  );
}
