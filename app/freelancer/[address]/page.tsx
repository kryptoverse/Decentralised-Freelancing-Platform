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
import { Loader2, Copy, Check, DollarSign, Briefcase, TrendingUp, Star, Send, User as UserIcon } from "lucide-react";
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
  totalEarnings: number;
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
    totalEarnings: 0,
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

        const [name, bio, uri, completedJobsRaw, ratingRaw, totalPointsRaw, levelRaw] = await Promise.all([
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

        const stars = Math.max(1, level);

        let rating = Number(ratingRaw || 0);
        if (rating === 0 && completedJobs > 0 && totalPoints > 0) {
          rating = Math.round((totalPoints / (completedJobs * 5)) * 100);
        }

        // Fetch platform fee and calculate earnings
        let totalEarnings = 0;
        try {
          const escrowFactory = getContract({
            client,
            chain: CHAIN,
            address: DEPLOYED_CONTRACTS.addresses.EscrowFactory,
          });

          const platformFeeBps = await readContract({
            contract: escrowFactory,
            method: "function platformFeeBps() view returns (uint16)",
          }).catch(() => 0);

          const jobBoard = getContract({
            client,
            chain: CHAIN,
            address: DEPLOYED_CONTRACTS.addresses.JobBoard,
          });

          const jobIds = await readContract({
            contract: jobBoard,
            method: "function getJobsAppliedBy(address) view returns (uint256[])",
            params: [walletAddress as `0x${string}`],
          }).catch(() => []);

          if (jobIds && jobIds.length > 0) {
            const jobPromises = (jobIds as bigint[]).map(async (idBig) => {
              try {
                const data = await readContract({
                  contract: jobBoard,
                  method: "function getJob(uint256) view returns (address,string,string,uint256,uint8,address,address,uint64,uint64,uint64,bytes32[],uint256)",
                  params: [idBig],
                }) as any;

                const budgetUSDC = data[3];
                const status = Number(data[4]);
                const hiredFreelancer = data[5];

                // Only count completed jobs for this freelancer
                if (status === 4 && hiredFreelancer?.toLowerCase() === walletAddress.toLowerCase()) {
                  return Number(budgetUSDC);
                }
                return 0;
              } catch {
                return 0;
              }
            });

            const budgets = await Promise.all(jobPromises);
            const totalBudget = budgets.reduce((sum, b) => sum + b, 0);

            // Calculate net earnings after platform fee
            const feeMultiplier = (10000 - Number(platformFeeBps)) / 10000;
            totalEarnings = (totalBudget / 1e6) * feeMultiplier;
          }
        } catch (err) {
          console.error("Failed to calculate earnings:", err);
        }

        setStats({
          totalEarnings,
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
    <section
      className="
        max-w-4xl mx-auto 
        px-4 sm:px-6 lg:px-8 
        py-10 
        w-full overflow-x-hidden space-y-10
      "
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start w-full">
        {metadata.profileImage ? (
          <img
            src={ipfsToHttp(metadata.profileImage)}
            alt={metadata.name}
            className="
              w-28 h-28 sm:w-40 sm:h-40
              rounded-full object-cover border border-border
            "
          />
        ) : (
          <div className="w-28 h-28 sm:w-40 sm:h-40 rounded-full bg-muted flex items-center justify-center text-xl text-muted-foreground">
            {metadata.name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="flex-1 text-center sm:text-left w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-primary">{metadata.name}</h1>

              {metadata.headline && (
                <p className="text-lg text-foreground-secondary">
                  {metadata.headline}
                </p>
              )}

              <p className="text-sm text-muted-foreground mt-1 break-all">
                Wallet: {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
            </div>

            {/* ACTIONS */}
            <div className="flex gap-2 w-full sm:w-auto">
              {/* COPY LINK */}
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border hover:bg-surface-secondary transition flex-1 sm:flex-none justify-center"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                <span className="text-sm">{copied ? "Copied" : "Copy Link"}</span>
              </button>

              {/* HIRE BUTTON LOGIC */}
              {!account ? (
                <Button disabled className="flex-1 sm:flex-none gap-2 bg-muted text-muted-foreground">
                  Connect to Hire
                </Button>
              ) : account.address.toLowerCase() === address?.toString().toLowerCase() ? (
                <Button variant="outline" className="flex-1 sm:flex-none gap-2 border-primary text-primary" disabled>
                  <UserIcon className="w-4 h-4" />
                  Your Profile
                </Button>
              ) : (
                <Dialog open={isHireModalOpen} onOpenChange={setIsHireModalOpen}>
                  <DialogTrigger asChild>
                    <Button className="flex-1 sm:flex-none gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                      <Send className="w-4 h-4" />
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
            </div>
          </div>
        </div>
      </div>

      {/* STATS SECTION */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl glass-effect border border-border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-foreground-secondary">Total Earnings</p>
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <p className="text-2xl font-bold">{stats.totalEarnings.toFixed(2)} USDT</p>
        </div>

        <div className="p-5 rounded-xl glass-effect border border-border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-foreground-secondary">Completed Jobs</p>
            <Briefcase className="w-5 h-5 text-primary" />
          </div>
          <p className="text-2xl font-bold">{stats.completedJobs}</p>
        </div>

        <div className="p-5 rounded-xl glass-effect border border-border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-foreground-secondary">Success Rate</p>
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <p className="text-2xl font-bold">{stats.rating > 0 ? `${stats.rating}%` : "N/A"}</p>
        </div>

        <div className="p-5 rounded-xl glass-effect border border-border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-foreground-secondary">Level</p>
            <div className="flex">
              {Array.from({ length: stats.stars }).map((_, i) => (
                <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              ))}
            </div>
          </div>
          <p className="text-2xl font-bold">Level {stats.level}</p>
        </div>
      </div>

      {/* About */}
      <div>
        <h3 className="text-xl font-semibold text-primary mb-2">About</h3>
        <p className="text-base whitespace-pre-line leading-relaxed">{metadata.bio}</p>
      </div>

      {/* Skills */}
      {skills.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold text-primary mb-2">Skills</h3>
          <div className="flex flex-wrap gap-2">
            {skills.map((s, i) => (
              <span
                key={i}
                className="
                  px-3 py-1 rounded-full 
                  bg-primary/10 border border-primary 
                  text-sm text-primary
                "
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Experience */}
      {experience.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold text-primary mb-4">Work Experience</h3>
          <div className="space-y-4">
            {experience.map((exp, i) => (
              <div
                key={i}
                className="
                  border border-border rounded-xl p-5 
                  bg-surface-secondary 
                  hover:border-primary/50 transition
                "
              >
                <h4 className="text-lg font-semibold">{exp.title}</h4>

                <p className="text-sm text-foreground-secondary mt-1">
                  {exp.company} {exp.duration && `• ${exp.duration}`}
                </p>

                {exp.description && (
                  <p className="text-sm text-foreground-secondary mt-3 whitespace-pre-line leading-relaxed">
                    {exp.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {education.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold text-primary mb-4">Education</h3>
          <div className="space-y-3">
            {education.map((edu, i) => (
              <div
                key={i}
                className="
                  flex items-start gap-3 p-3 
                  rounded-lg border border-border 
                  bg-surface-secondary
                "
              >
                <div className="text-2xl">🎓</div>
                <div>
                  <p className="font-medium">{edu.degree}</p>
                  <p className="text-sm text-foreground-secondary">
                    {edu.institution} {edu.year && `• ${edu.year}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Certificates */}
      {certificates.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold text-primary mb-4">
            Certificates & Credentials
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {certificates.map((c, i) => (
              <div
                key={i}
                className="
                  p-4 rounded-lg border border-border 
                  bg-surface-secondary 
                  hover:border-primary/50 transition
                "
              >
                <div className="text-2xl mb-2">🏅</div>
                <p className="font-medium">{c.title}</p>
                <p className="text-sm text-foreground-secondary">
                  {c.issuer} {c.year && `• ${c.year}`}
                </p>

                {c.file && (
                  <a
                    href={ipfsToHttp(c.file)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline mt-2 inline-block"
                  >
                    View Certificate →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Portfolio */}
      {portfolio.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold text-primary mb-4">Portfolio Projects</h3>
          <div className="grid sm:grid-cols-2 gap-6">
            {portfolio.map((p, i) => (
              <div
                key={i}
                className="
                  rounded-xl border border-border overflow-hidden 
                  bg-surface-secondary hover:shadow-xl
                  hover:border-primary/50 transition-all group
                "
              >
                {p.image && (
                  <div className="relative w-full h-48 overflow-hidden bg-muted">
                    <img
                      src={ipfsToHttp(p.image)}
                      alt={p.title}
                      className="
                        w-full h-full object-cover 
                        group-hover:scale-105 transition-transform duration-300
                      "
                    />
                  </div>
                )}

                <div className="p-4">
                  <h4 className="text-lg font-semibold mb-2">{p.title}</h4>

                  <p className="text-sm text-foreground-secondary mb-3 line-clamp-3">
                    {p.description}
                  </p>

                  {p.link && (
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="
                        inline-flex items-center gap-2 
                        text-sm text-primary hover:underline font-medium
                      "
                    >
                      View Live Project
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Intro Video */}
      {metadata.introVideo && (
        <div>
          <h3 className="text-xl font-semibold text-primary mb-2">Intro Video</h3>

          <video
            src={ipfsToHttp(metadata.introVideo)}
            controls
            className="rounded-xl border border-border w-full max-h-[400px]"
          />
        </div>
      )}
    </section>
  );
}
