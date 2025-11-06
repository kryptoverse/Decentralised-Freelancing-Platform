"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getContract, readContract } from "thirdweb";
import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { ipfsToHttp } from "@/utils/ipfs";
import { Loader2, Copy, Check } from "lucide-react";

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

export default function PublicFreelancerProfile() {
  const params = useParams();
  const address = Array.isArray(params.address) ? params.address[0] : params.address;
  const [loading, setLoading] = useState(true);
  const [profileURI, setProfileURI] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [freelancerName, setFreelancerName] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!address || typeof address !== "string") return;

    async function fetchPublicProfile() {
      try {
        setLoading(true);

        // Normalize address (ensure it's a valid address string)
        if (!address || typeof address !== "string") {
          setLoading(false);
          return;
        }
        const walletAddress = address.toLowerCase().startsWith("0x") 
          ? address 
          : `0x${address}`;

        // 1️⃣ Load FreelancerFactory
        const factory = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory,
        });

        // 2️⃣ Get deployed profile address for this wallet
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

        // 3️⃣ Get profile contract
        const profileContract = getContract({
          client,
          chain: CHAIN,
          address: profileAddr as `0x${string}`,
        });

        // 4️⃣ Read basic info + URI
        const [name, bio, uri] = await Promise.all([
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
        ]);

        setFreelancerName(name);
        setProfileURI(uri);

        // 5️⃣ Load metadata JSON
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
      <div className="text-center text-foreground-secondary">
        <h2 className="text-2xl font-bold">Freelancer not found</h2>
        <p className="text-sm mt-2">
          This wallet doesn't have a registered freelancer profile yet.
        </p>
      </div>
    );
  }

  const handleCopyLink = async () => {
    if (typeof window !== "undefined" && address) {
      // Automatically uses current domain (localhost or production)
      const url = `${window.location.origin}/freelancer/${address}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section className="max-w-4xl mx-auto space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
        {metadata.profileImage ? (
          <img
            src={ipfsToHttp(metadata.profileImage)}
            alt={metadata.name}
            className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover border border-border"
          />
        ) : (
          <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-muted flex items-center justify-center text-xl text-muted-foreground">
            {metadata.name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-primary">{metadata.name}</h1>
              {metadata.headline && (
                <p className="text-lg text-foreground-secondary">
                  {metadata.headline}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-1 break-all">
                Wallet: {address && typeof address === "string" ? `${address.slice(0, 6)}...${address.slice(-4)}` : address}
              </p>
            </div>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border hover:bg-surface-secondary transition"
              title="Copy profile link"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span className="text-sm">Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Bio */}
      <div>
        <h3 className="text-xl font-semibold text-primary mb-2">About</h3>
        <p className="text-base whitespace-pre-line">{metadata.bio}</p>
      </div>

      {/* Skills */}
      {metadata.skills && metadata.skills.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold text-primary mb-2">Skills</h3>
          <div className="flex flex-wrap gap-2">
            {metadata.skills.map((s, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-full bg-primary/10 border border-primary text-sm text-primary"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Experience */}
      {metadata.experience && metadata.experience.length > 0 && metadata.experience.some(exp => exp.title || exp.company) && (
        <div>
          <h3 className="text-xl font-semibold text-primary mb-4">
            Work Experience
          </h3>
          <div className="space-y-4">
            {metadata.experience
              .filter(exp => exp.title || exp.company)
              .map((exp, i) => (
                <div key={i} className="border border-border rounded-xl p-5 bg-surface-secondary hover:border-primary/50 transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-foreground">{exp.title || "Position"}</h4>
                      <p className="text-sm text-foreground-secondary mt-1">
                        {exp.company && <span className="font-medium">{exp.company}</span>}
                        {exp.company && exp.duration && <span className="mx-2">•</span>}
                        {exp.duration && <span>{exp.duration}</span>}
                      </p>
                      {exp.description && (
                        <p className="text-sm text-foreground-secondary mt-3 whitespace-pre-line leading-relaxed">
                          {exp.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Education */}
      {metadata.education && metadata.education.length > 0 && metadata.education.some(edu => edu.degree || edu.institution) && (
        <div>
          <h3 className="text-xl font-semibold text-primary mb-4">Education</h3>
          <div className="space-y-3">
            {metadata.education
              .filter(edu => edu.degree || edu.institution)
              .map((edu, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-surface-secondary">
                  <div className="text-2xl">🎓</div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{edu.degree || "Degree"}</p>
                    <p className="text-sm text-foreground-secondary">
                      {edu.institution}
                      {edu.year && ` • ${edu.year}`}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Certificates */}
      {metadata.certificates && metadata.certificates.length > 0 && metadata.certificates.some(c => c.title || c.issuer) && (
        <div>
          <h3 className="text-xl font-semibold text-primary mb-4">
            Certificates & Credentials
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {metadata.certificates
              .filter(c => c.title || c.issuer)
              .map((c, i) => (
                <div key={i} className="p-4 rounded-lg border border-border bg-surface-secondary hover:border-primary/50 transition">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">🏅</div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{c.title || "Certificate"}</p>
                      <p className="text-sm text-foreground-secondary">
                        {c.issuer}
                        {c.year && ` • ${c.year}`}
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
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Portfolio */}
      {metadata.portfolio && metadata.portfolio.length > 0 && metadata.portfolio.some(p => p.title || p.description) && (
        <div>
          <h3 className="text-xl font-semibold text-primary mb-4">
            Portfolio Projects
          </h3>
          <div className="grid sm:grid-cols-2 gap-6">
            {metadata.portfolio
              .filter(p => p.title || p.description)
              .map((p, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border overflow-hidden bg-surface-secondary hover:shadow-xl hover:border-primary/50 transition-all group"
                >
                  {p.image && (
                    <div className="relative w-full h-48 overflow-hidden bg-muted">
                      <img
                        src={ipfsToHttp(p.image)}
                        alt={p.title || "Portfolio project"}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <h4 className="text-lg font-semibold text-foreground mb-2">{p.title || "Project"}</h4>
                    {p.description && (
                      <p className="text-sm text-foreground-secondary mb-3 line-clamp-3">
                        {p.description}
                      </p>
                    )}
                    {p.link && (
                      <a
                        href={p.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
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
          <h3 className="text-xl font-semibold text-primary mb-2">
            Intro Video
          </h3>
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
