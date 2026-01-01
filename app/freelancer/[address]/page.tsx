"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getContract, readContract, prepareContractCall, sendTransaction } from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { ipfsToHttp } from "@/utils/ipfs";
import { uploadToIPFS } from "@/utils/ipfs-upload";
import { Loader2, Copy, Check, DollarSign, Briefcase, TrendingUp, Star, Send, User as UserIcon, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

// ... (Metadata interface)

// ... (FreelancerStats interface)

// ... (component start)

// ... (component start)

interface Metadata {
  name: string;
  headline?: string;
  bio: string;
  profileImage?: string;
  introVideo?: string;
  skills?: string[];
  education?: { degree: string; institution: string; year: string }[];
  experience?: { title: string; company: string; duration: string; description: string }[];
  certificates?: { title: string; issuer: string; year: string; file?: string }[];
  portfolio?: { title: string; description: string; link?: string; image?: string }[];
}

interface FreelancerStats {
  completedJobs: number;
  rating: number;
  level: number;
  stars: number;
}

export default function PublicFreelancerProfile() {
  const params = useParams();
  const address = Array.isArray(params.address) ? params.address[0] : params.address;

  const [loading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [copied, setCopied] = useState(false);

  const { toast } = useToast();
  const account = useActiveAccount();
  const router = useRouter();

  // Hire Modal State
  const [isHireModalOpen, setIsHireModalOpen] = useState(false);
  const [hiring, setHiring] = useState(false);
  const [offerForm, setOfferForm] = useState({
    title: "",
    description: "",
    budget: "",
    days: "",
  });

  const [stats, setStats] = useState<FreelancerStats>({
    completedJobs: 0,
    rating: 0,
    level: 0,
    stars: 1,
  });

  useEffect(() => {
    if (!address || typeof address !== "string") return;

    async function fetchPublicProfile() {
      try {
        setLoading(true);

        const rawAddress = Array.isArray(params.address) ? params.address[0] : params.address;
        const address = typeof rawAddress === "string" ? rawAddress : "";

        // Create a valid wallet address (0x-prefixed)
        const walletAddress =
          address.startsWith("0x") ? address : `0x${address}`;


        const factory = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory,
        });

        const profileAddr = await readContract({
          contract: factory,
          method: "function freelancerProfile(address) view returns (address)",
          params: [walletAddress as `0x${string}`],
        });

        if (
          !profileAddr ||
          profileAddr === "0x0000000000000000000000000000000000000000"
        ) {
          setMetadata(null);
          setLoading(false);
          return;
        }

        const profileContract = getContract({
          client,
          chain: CHAIN,
          address: profileAddr as `0x${string}`,
        });

        const [name, bio, uri, completedJobsRaw, ratingRaw, totalPointsRaw, levelRaw, totalEarningsRaw] = await Promise.all([
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

        if (level === 0) {
          if (completedJobs >= 25 && totalPoints >= 120) level = 5;
          else if (completedJobs >= 20 && totalPoints >= 95) level = 4;
          else if (completedJobs >= 15 && totalPoints >= 70) level = 3;
          else if (completedJobs >= 10 && totalPoints >= 45) level = 2;
          else if (completedJobs >= 5 && totalPoints >= 20) level = 1;
        }

        // Calculate average star rating from actual job ratings
        // totalPoints is the sum of all ratings (1-5 per job)
        // So average rating = totalPoints / completedJobs
        let stars = 0;
        if (completedJobs > 0 && totalPoints > 0) {
          const avgRating = totalPoints / completedJobs;
          stars = Math.round(avgRating); // Round to nearest star (1-5)
          stars = Math.max(1, Math.min(5, stars)); // Clamp between 1-5
        } else {
          stars = 0; // No ratings yet
        }

        // Calculate success rate percentage
        let rating = Number(ratingRaw || 0);
        if (rating === 0 && completedJobs > 0 && totalPoints > 0) {
          rating = Math.round((totalPoints / (completedJobs * 5)) * 100);
        }


        setStats({
          completedJobs,
          rating,
          level,
          stars,
        });

        if (uri && uri.trim() !== "") {
          const res = await fetch(ipfsToHttp(uri));
          const data = await res.json();
          setMetadata(data);
        } else {
          setMetadata({
            name,
            bio,
            headline: "Freelancer",
            skills: [],
            education: [],
            experience: [],
            certificates: [],
            portfolio: [],
          });
        }
      } catch (err) {
        console.error("❌ Failed to load public profile:", err);
        setMetadata(null);
      } finally {
        setLoading(false);
      }
    }

    fetchPublicProfile();
  }, [address]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!metadata) {
    return (
      <div className="text-center text-foreground-secondary p-6">
        <h2 className="text-2xl font-bold">Freelancer not found</h2>
        <p className="text-sm mt-2">
          This wallet does not have a registered freelancer profile yet.
        </p>
      </div>
    );
  }

  /** FIX: Guarantee arrays so TS never complains */
  const skills = metadata.skills ?? [];
  const experience = metadata.experience ?? [];
  const education = metadata.education ?? [];
  const certificates = metadata.certificates ?? [];
  const portfolio = metadata.portfolio ?? [];

  const handleCopyLink = async () => {
    if (typeof window !== "undefined" && address) {
      const url = `${window.location.origin}/freelancer/${address}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendOffer = async () => {
    if (!account) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to send an offer.",
        variant: "destructive",
      });
      return;
    }

    if (!offerForm.title || !offerForm.description || !offerForm.budget || !offerForm.days) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      setHiring(true);

      // 1. Upload description to IPFS
      let uri = "";
      try {
        uri = await uploadToIPFS({
          title: offerForm.title,
          description: offerForm.description,
          budget: offerForm.budget,
          duration: offerForm.days
        });
      } catch (e) {
        console.error("IPFS Upload Error", e);
        toast({ title: "Failed to upload offer details", variant: "destructive" });
        setHiring(false);
        return;
      }

      const budgetUSDT = BigInt(Math.floor(Number(offerForm.budget) * 1e6)); // USDC/USDT is 6 decimals
      const durationDays = BigInt(offerForm.days);
      const expiry = BigInt(0); // No expiry for now, or could set 7 days

      const jobBoard = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.JobBoard,
      });

      // 2. Check Allowance (USDC)
      // If allowance < budget, approve first?
      // Contract: createDirectOffer checks allowance but DOES NOT transfer yet.
      // So we just need to make sure we HAVE allowance.

      const usdc = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.MockUSDT,
      });

      const allowance = await readContract({
        contract: usdc,
        method: "function allowance(address owner, address spender) view returns (uint256)",
        params: [account.address, DEPLOYED_CONTRACTS.addresses.JobBoard]
      });

      if (allowance < budgetUSDT) {
        const approveTx = prepareContractCall({
          contract: usdc,
          method: "function approve(address spender, uint256 amount) returns (bool)",
          params: [DEPLOYED_CONTRACTS.addresses.JobBoard, budgetUSDT]
        });
        await sendTransaction({ transaction: approveTx, account });
      }

      // 3. Create Direct Offer
      const transaction = prepareContractCall({
        contract: jobBoard,
        method: "function createDirectOffer(address freelancer, string title, string descriptionURI, uint256 budgetUSDT, uint64 deliveryDays, uint64 expiresAt) returns (uint256)",
        params: [
          address as `0x${string}`,
          offerForm.title,
          uri,
          budgetUSDT,
          durationDays,
          expiry
        ],
      });

      const { transactionHash } = await sendTransaction({
        transaction,
        account,
      });

      toast({
        title: "Offer Sent!",
        description: "The freelancer has been notified of your proposal.",
      });

      setIsHireModalOpen(false);
      setOfferForm({ title: "", description: "", budget: "", days: "" });

    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error sending offer",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setHiring(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* LEFT SIDEBAR (Profile Info) */}
        <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
          <div className="p-6 rounded-2xl glass-effect border border-border shadow-lg flex flex-col items-center text-center">

            {/* Profile Image */}
            <div className="relative mb-4">
              {metadata.profileImage ? (
                <img
                  src={ipfsToHttp(metadata.profileImage)}
                  alt={metadata.name}
                  className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover border-4 border-surface shadow-md"
                />
              ) : (
                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-muted flex items-center justify-center text-2xl text-muted-foreground border-4 border-surface shadow-md">
                  {metadata.name.charAt(0).toUpperCase()}
                </div>
              )}
              {/* Level Badge */}
              <div className="absolute bottom-0 right-0 bg-surface border border-border text-foreground px-2 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                Lvl {stats.level}
              </div>
            </div>

            <h1 className="text-2xl font-bold text-primary mb-1">{metadata.name}</h1>

            {metadata.headline && (
              <p className="text-sm font-medium text-foreground-secondary mb-3">
                {metadata.headline}
              </p>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-surface-secondary px-3 py-1 rounded-full mb-6">
              <span>Wallet:</span>
              <span className="font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-col gap-3 w-full">
              {!account ? (
                <Button disabled className="w-full bg-muted text-muted-foreground">
                  Connect to Hire
                </Button>
              ) : account.address.toLowerCase() === address?.toString().toLowerCase() ? (
                <Button variant="outline" className="w-full border-primary text-primary" disabled>
                  <UserIcon className="w-4 h-4 mr-2" />
                  Your Profile
                </Button>
              ) : (
                <Dialog open={isHireModalOpen} onOpenChange={setIsHireModalOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all hover:scale-[1.02]">
                      <Send className="w-4 h-4 mr-2" />
                      Hire Directly
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px] bg-background border-border text-foreground">
                    <DialogHeader>
                      <DialogTitle>Hire {metadata.name}</DialogTitle>
                      <DialogDescription>
                        Send a direct proposal to this freelancer.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="title">Job Title</Label>
                        <Input
                          id="title"
                          placeholder="e.g. Build landing page"
                          value={offerForm.title}
                          onChange={(e) => setOfferForm({ ...offerForm, title: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="desc">Description</Label>
                        <Textarea
                          id="desc"
                          placeholder="Describe the work..."
                          value={offerForm.description}
                          onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="budget">Budget (USDT)</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="budget"
                              type="number"
                              className="pl-8"
                              placeholder="500"
                              value={offerForm.budget}
                              onChange={(e) => setOfferForm({ ...offerForm, budget: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="days">Duration (Days)</Label>
                          <Input
                            id="days"
                            type="number"
                            placeholder="7"
                            value={offerForm.days}
                            onChange={(e) => setOfferForm({ ...offerForm, days: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleSendOffer} disabled={hiring}>
                        {hiring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {hiring ? "Sending..." : "Send Proposal"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}

              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-border hover:bg-surface-secondary transition w-full"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {copied ? "Link Copied" : "Copy Profile Link"}
              </button>
            </div>
          </div>

          {/* SIDEBAR SKILLS */}
          {skills.length > 0 && (
            <div className="p-6 rounded-2xl glass-effect border border-border">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {skills.map((s, i) => (
                  <span
                    key={i}
                    className="
                      px-3 py-1.5 rounded-lg 
                      bg-surface hover:bg-surface-secondary border border-border 
                      text-xs font-medium text-foreground-secondary transition
                    "
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* SIDEBAR EDUCATION */}
          {education.length > 0 && (
            <div className="p-6 rounded-2xl glass-effect border border-border">
              <h3 className="text-lg font-semibold text-foreground mb-4">Education</h3>
              <div className="space-y-4">
                {education.map((edu, i) => (
                  <div key={i} className="pb-3 border-b border-border/50 last:border-0 last:pb-0">
                    <p className="font-semibold text-sm">{edu.degree}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {edu.institution}
                    </p>
                    {edu.year && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mt-1 block">
                        {edu.year}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SIDEBAR CERTIFICATES */}
          {certificates.length > 0 && (
            <div className="p-6 rounded-2xl glass-effect border border-border">
              <h3 className="text-lg font-semibold text-foreground mb-4">Certifications</h3>
              <div className="space-y-3">
                {certificates.map((c, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-1 p-1.5 bg-primary/10 rounded-full">
                      <div className="text-lg">🏅</div>
                    </div>
                    <div>
                      <p className="text-sm font-medium leading-tight">{c.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{c.issuer} • {c.year}</p>
                      {c.file && (
                        <a
                          href={ipfsToHttp(c.file)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline mt-1 inline-block"
                        >
                          View Credential
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* RIGHT MAIN CONTENT */}
        <div className="lg:col-span-8 space-y-8">

          {/* STATS STRIP */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl glass-effect border border-border text-center">
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Jobs Done</p>
              <p className="text-xl font-bold">{stats.completedJobs}</p>
            </div>
            <div className="p-4 rounded-xl glass-effect border border-border text-center">
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Success</p>
              <p className="text-xl font-bold">{stats.rating > 0 ? `${stats.rating}%` : "N/A"}</p>
            </div>
            <div className="p-4 rounded-xl glass-effect border border-border text-center">
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Rating</p>
              <div className="flex justify-center mt-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${i < stats.stars ? "text-yellow-400 fill-yellow-400" : "text-border"}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ABOUT SECTION */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              About Me
            </h2>
            <div className="p-6 rounded-2xl glass-effect border border-border leading-relaxed text-foreground-secondary whitespace-pre-line">
              {metadata.bio}
            </div>
          </section>

          {/* WORK EXPERIENCE (Main Timeline) */}
          {experience.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-2xl font-bold">Work Experience</h2>
              <div className="relative border-l-2 border-border ml-3 space-y-8 py-2">
                {experience.map((exp, i) => (
                  <div key={i} className="pl-6 relative">
                    {/* Timeline Dot */}
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-primary/20 border-2 border-primary"></div>

                    <div className="p-5 rounded-xl bg-surface-secondary border border-border hover:border-primary/30 transition">
                      <h3 className="text-xl font-semibold text-foreground">{exp.title}</h3>
                      <div className="flex flex-wrap items-center gap-x-2 text-sm text-primary mb-3">
                        <span className="font-medium">{exp.company}</span>
                        {exp.duration && <span className="text-muted-foreground">• {exp.duration}</span>}
                      </div>
                      {exp.description && (
                        <p className="text-sm text-foreground-secondary leading-relaxed whitespace-pre-line">
                          {exp.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* PORTFOLIO GRID */}
          {portfolio.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-2xl font-bold">Portfolio</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {portfolio.map((p, i) => (
                  <div
                    key={i}
                    className="group rounded-2xl border border-border overflow-hidden bg-surface-secondary hover:shadow-xl transition-all hover:-translate-y-1 block"
                  >
                    {p.image ? (
                      <div className="relative w-full h-56 overflow-hidden bg-black/5">
                        <img
                          src={ipfsToHttp(p.image)}
                          alt={p.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        {/* Overlay with Link if exists */}
                        {p.link && (
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <a
                              href={p.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-6 py-2 bg-white text-black rounded-full font-bold text-sm hover:scale-105 transition-transform"
                            >
                              View Project
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-56 bg-muted flex items-center justify-center text-muted-foreground">
                        <span className="text-4xl opacity-20">🖼️</span>
                      </div>
                    )}

                    <div className="p-5">
                      <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors">{p.title}</h3>
                      <p className="text-sm text-foreground-secondary line-clamp-3 mb-4">
                        {p.description}
                      </p>

                      {p.link && (
                        <a
                          href={p.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-xs font-semibold text-primary hover:underline"
                        >
                          External Link <ArrowUpRight className="w-3 h-3 ml-1" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* INTRO VIDEO */}
          {metadata.introVideo && (
            <section className="space-y-4">
              <h2 className="text-2xl font-bold">Introduction</h2>
              <div className="rounded-2xl border border-border overflow-hidden bg-black">
                <video
                  src={ipfsToHttp(metadata.introVideo)}
                  controls
                  className="w-full max-h-[500px]"
                />
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  );
}
