"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { getContract, readContract } from "thirdweb";
import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";

import { ProfileLoader } from "@/components/freelancer/profile/ProfileLoader";
import { ProfileDisplay } from "@/components/freelancer/profile/ProfileDisplay";
import { FreelancerProfileForm } from "@/components/freelancer/profile/ProfileForm";

interface FreelancerProfile {
  name: string;
  bio: string;
  profileURI: string;
  profileAddress: string;
}

export default function FreelancerProfilePage() {
  const account = useActiveAccount();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<FreelancerProfile | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [mode, setMode] = useState<"view" | "form">("view");

  // 🧭 Load freelancer profile data
  useEffect(() => {
    if (!account?.address) return;

    async function fetchProfile() {
      try {
        setLoading(true);

        const factory = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory,
        });

        if (!account?.address) return;

const profileAddr = await readContract({
  contract: factory,
  method: "function freelancerProfile(address) view returns (address)",
  params: [account.address],
});

        if (
          !profileAddr ||
          profileAddr === "0x0000000000000000000000000000000000000000"
        ) {
          // No profile yet → Create mode
          setProfile(null);
          setMode("form");
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

        setProfile({ name, bio, profileURI, profileAddress: profileAddr });

        // Load metadata from IPFS if exists
        if (profileURI && profileURI.trim() !== "") {
          const uri = profileURI.startsWith("ipfs://")
            ? profileURI.replace("ipfs://", "https://ipfs.io/ipfs/")
            : profileURI;
          const res = await fetch(uri);
          const data = await res.json();
          setMetadata(data);
        }

        setMode("view");
      } catch (err) {
        console.error("❌ Failed to load profile:", err);
        setProfile(null);
        setMode("form");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [account?.address]);

  // 🧱 Require wallet
  if (!account?.address) {
    return (
      <section className="p-8">
        <p className="text-lg font-semibold">
          Please connect your wallet to continue.
        </p>
      </section>
    );
  }

  // 🌀 Loading state
  if (loading) return <ProfileLoader />;

  // 🆕 Create or Edit Form
  if (!profile || mode === "form") {
    return (
      <section className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-3xl font-bold">
            {profile ? "Edit Your Freelancer Profile" : "Create Your Freelancer Profile"}
          </h1>
          {profile && account?.address && (
            <button
              onClick={() => {
                router.push(`/freelancer/${account.address}`);
              }}
              className="px-4 py-2 rounded-xl bg-surface border border-border text-foreground hover:bg-surface-secondary transition flex items-center gap-2"
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
              Show Public View
            </button>
          )}
        </div>

        <FreelancerProfileForm
          profileAddress={profile?.profileAddress}
          existingMetadata={metadata}
          onSaved={() => window.location.reload()}
        />
      </section>
    );
  }

  // ✅ Profile exists → Show display view
  return (
    <section className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold">My Profile</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              router.push(`/freelancer/${account.address}`);
            }}
            className="px-4 py-2 rounded-xl bg-surface border border-border text-foreground hover:bg-surface-secondary transition flex items-center gap-2"
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
            Show Public View
          </button>
          <button
            onClick={() => setMode("form")}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition"
          >
            Edit Profile
          </button>
        </div>
      </div>

      <ProfileDisplay
        profile={{
          wallet: account.address,
          name: profile.name,
          bio: profile.bio,
          profileAddress: profile.profileAddress,
          profileURI: profile.profileURI,
        }}
      />
    </section>
  );
}
