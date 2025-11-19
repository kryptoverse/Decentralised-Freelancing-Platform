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

import { Copy, Check } from "lucide-react";

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

export default function FreelancerProfilePage() {
  const account = useActiveAccount();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<LoadedProfile | null>(null);
  const [metadata, setMetadata] = useState<ProfileMetadata | null>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");

  const [copiedWallet, setCopiedWallet] = useState(false);
  const [copiedPublicLink, setCopiedPublicLink] = useState(false);
  const [copiedProfileAddr, setCopiedProfileAddr] = useState(false);

  // ---------------------------
  // LOAD PROFILE
  // ---------------------------
  useEffect(() => {
    const address = account?.address;
    if (!address) return;

    async function fetchProfile() {
      try {
        setLoading(true);

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

        const [name, bio, profileURI] = await Promise.all([
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
      }
    }

    fetchProfile();
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
      <section className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3">
          <h1 className="text-3xl font-bold">
            {profile ? "Edit Your Profile" : "Create Your Profile"}
          </h1>

          {profile && (
            <button
              onClick={() => setMode("view")}
              className="
                px-4 py-2 rounded-lg 
                bg-surface border border-border 
                hover:bg-surface-secondary transition
              "
            >
              Back to Profile
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
    <section className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-10">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-center md:text-left w-full">
          My Freelancer Profile
        </h1>

        <div className="flex flex-row gap-3 w-full md:w-auto justify-center md:justify-end">
          <button
            onClick={() => router.push(`/freelancer/${account.address}`)}
            className="
              px-5 py-2.5 rounded-full border border-border 
              bg-surface hover:bg-surface-secondary 
              text-sm font-medium transition flex items-center gap-2
            "
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            View Public Profile
          </button>

          <button
            onClick={() => setMode("edit")}
            className="
              px-5 py-2.5 rounded-full 
              bg-primary text-primary-foreground 
              hover:opacity-90 text-sm font-medium transition
            "
          >
            Edit Profile
          </button>
        </div>
      </div>

      {/* PROFILE HEADER SECTION */}
      <div className="flex flex-col items-center text-center space-y-4">
        {/* IMAGE */}
        {merged.profileImage ? (
          <img
            src={ipfsToHttp(merged.profileImage)}
            className="w-32 h-32 rounded-full object-cover border border-border"
            alt="Profile"
          />
        ) : (
          <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center text-2xl text-muted-foreground">
            {merged.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
        )}

        {/* NAME */}
        <h2 className="text-3xl font-bold">{merged.name}</h2>

        {/* HEADLINE */}
        {merged.headline && (
          <p className="text-lg text-foreground-secondary max-w-xs">
            {merged.headline}
          </p>
        )}

        {/* ADDRESSES */}
        <p className="text-xs text-muted-foreground break-all">
          Wallet: {account.address.slice(0, 6)}...{account.address.slice(-4)}
        </p>

        {profile?.profileAddress && (
          <p className="text-xs text-muted-foreground break-all">
            Contract: {profile.profileAddress.slice(0, 10)}...
            {profile.profileAddress.slice(-6)}
          </p>
        )}

        {/* COPY BUTTONS */}
        <div className="flex flex-wrap justify-center gap-3 mt-2">
          <button
            onClick={handleCopyWallet}
            className="
              px-3 py-1.5 rounded-full border border-border 
              bg-surface-secondary hover:bg-surface transition 
              text-xs flex items-center gap-2
            "
          >
            {copiedWallet ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            Copy wallet
          </button>

          <button
            onClick={handleCopyPublicLink}
            className="
              px-3 py-1.5 rounded-full border border-border 
              bg-surface-secondary hover:bg-surface transition 
              text-xs flex items-center gap-2
            "
          >
            {copiedPublicLink ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            Copy public URL
          </button>

          {profile?.profileAddress && (
            <button
              onClick={handleCopyProfileAddress}
              className="
                px-3 py-1.5 rounded-full border border-border 
                bg-surface-secondary hover:bg-surface transition 
                text-xs flex items-center gap-2
              "
            >
              {copiedProfileAddr ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              Copy contract
            </button>
          )}
        </div>
      </div>

      {/* ABOUT */}
      <div>
        <h3 className="text-xl font-semibold mb-2">About</h3>
        <p className="text-base whitespace-pre-line leading-relaxed">
          {merged.bio}
        </p>
      </div>

      {/* SKILLS */}
      {skills.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold mb-2">Skills</h3>
          <div className="flex flex-wrap gap-2">
            {skills.map((s, i) => (
              <span
                key={i}
                className="
                  px-3 py-1 text-sm rounded-full 
                  bg-primary/10 border border-primary text-primary
                "
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* EXPERIENCE */}
      {experience.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold mb-4">Experience</h3>
          <div className="space-y-4">
            {experience.map((exp, i) => (
              <div
                key={i}
                className="
                  border border-border rounded-xl p-4
                  bg-surface-secondary hover:border-primary/50 transition
                "
              >
                <h4 className="text-lg font-semibold">{exp.title}</h4>
                <p className="text-sm text-foreground-secondary">
                  {exp.company} • {exp.duration}
                </p>
                <p className="text-sm text-foreground-secondary mt-2 whitespace-pre-line">
                  {exp.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EDUCATION */}
      {education.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold mb-4">Education</h3>
          <div className="space-y-3">
            {education.map((edu, i) => (
              <div
                key={i}
                className="
                  flex gap-3 items-start p-3 rounded-lg 
                  border border-border bg-surface-secondary
                "
              >
                <div className="text-2xl">🎓</div>
                <div>
                  <p className="font-medium">{edu.degree}</p>
                  <p className="text-sm text-foreground-secondary">
                    {edu.institution} • {edu.year}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CERTIFICATES */}
      {certificates.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold mb-4">Certificates</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {certificates.map((c, i) => (
              <div
                key={i}
                className="
                  p-4 rounded-lg border border-border 
                  bg-surface-secondary hover:border-primary/50 transition
                "
              >
                <div className="text-2xl mb-1">🏅</div>
                <p className="font-medium">{c.title}</p>
                <p className="text-sm text-foreground-secondary">
                  {c.issuer} • {c.year}
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

      {/* PORTFOLIO */}
      {portfolio.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold mb-4">Portfolio</h3>
          <div className="grid sm:grid-cols-2 gap-6">
            {portfolio.map((p, i) => (
              <div
                key={i}
                className="
                  rounded-xl border border-border bg-surface-secondary 
                  overflow-hidden hover:border-primary/50 transition group
                "
              >
                {p.image && (
                  <div className="h-44 overflow-hidden">
                    <img
                      src={ipfsToHttp(p.image)}
                      alt={p.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                  </div>
                )}

                <div className="p-4">
                  <h4 className="text-lg font-semibold">{p.title}</h4>
                  <p className="text-sm text-foreground-secondary whitespace-pre-line mt-2">
                    {p.description}
                  </p>

                  {p.link && (
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline mt-3 inline-flex items-center gap-2"
                    >
                      View Project →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIDEO */}
      {merged.introVideo && (
        <div>
          <h3 className="text-xl font-semibold mb-2">Intro Video</h3>
          <video
            src={ipfsToHttp(merged.introVideo)}
            controls
            className="rounded-xl border border-border max-w-full max-h-[350px]"
          />
        </div>
      )}
    </section>
  );
}
