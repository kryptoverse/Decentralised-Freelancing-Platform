"use client";

import { useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { getContract, readContract } from "thirdweb";
import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";

import { ProfileLoader } from "@/components/freelancer/profile/ProfileLoader";
import { ProfileDisplay } from "@/components/freelancer/profile/ProfileDisplay";
import { ProfileForm } from "@/components/freelancer/profile/ProfileForm";
import { ProfileEdit } from "@/components/freelancer/profile/ProfileEdit";
import { ProfileNotFound } from "@/components/freelancer/profile/ProfileNotFound";
import { ProfileSetupWizard } from "@/components/freelancer/profile/ProfileSetupWizard"; // ✅ added

interface FreelancerProfile {
  name: string;
  bio: string;
  profileURI: string;
  profileAddress: string;
}

export default function FreelancerProfilePage() {
  const account = useActiveAccount();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<FreelancerProfile | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | "create">("view");

  useEffect(() => {
    if (!account?.address) return;

    const fetchProfile = async () => {
      try {
        setLoading(true);

        // 🔹 1. Load FreelancerFactory contract
        const factory = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory,
        });

        // 🔹 2. Get profile address for this wallet
        const profileAddr = await readContract({
          contract: factory,
          method:
            "function freelancerProfile(address) view returns (address)",
          params: [account.address],
        });

        // 🔹 3. No profile deployed yet
        if (
          !profileAddr ||
          profileAddr === "0x0000000000000000000000000000000000000000"
        ) {
          setProfile(null);
          setMode("create");
          return;
        }

        // 🔹 4. Load FreelancerProfile contract
        const profileContract = getContract({
          client,
          chain: CHAIN,
          address: profileAddr as `0x${string}`,
        });

        // 🔹 5. Read on-chain fields
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
          profileAddress: profileAddr,
        });
        setMode("view");
      } catch (err: any) {
        console.error("❌ Failed to load profile:", err?.message || err);
        setProfile(null);
        setMode("create");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [account?.address]);

  // 🧱 Guard: must be connected
  if (!account?.address) {
    return (
      <section className="p-8">
        <p className="text-lg font-semibold">
          Please connect your wallet to view your profile.
        </p>
      </section>
    );
  }

  // 🌀 Loading state
  if (loading) return <ProfileLoader />;

  // 🆕 1️⃣ No profile contract → show wizard
  if (!profile) {
    return (
      <section className="space-y-6 max-w-3xl">
        <h1 className="text-3xl font-bold">Create Your Freelancer Profile</h1>
        <ProfileNotFound />
        <ProfileSetupWizard />
      </section>
    );
  }

  // 🆕 2️⃣ Profile contract exists but IPFS URI is empty → show setup wizard
  const isProfileIncomplete =
    !profile.profileURI || profile.profileURI.trim() === "";

  if (isProfileIncomplete) {
    return (
      <section className="space-y-6 max-w-3xl">
        <h1 className="text-3xl font-bold">Complete Your Profile Setup</h1>
        <p className="text-sm text-foreground-secondary">
          Your on-chain profile exists but your IPFS data isn’t set up yet.
        </p>
        <ProfileSetupWizard />
      </section>
    );
  }

  // 🧾 3️⃣ Profile fully set up → view or edit mode
  return (
    <section className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Profile</h1>

        {mode === "view" ? (
          <button
            onClick={() => setMode("edit")}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition"
          >
            Edit Profile
          </button>
        ) : (
          <button
            onClick={() => setMode("view")}
            className="px-4 py-2 rounded-xl border border-border glass-effect hover:bg-background/40 transition"
          >
            Cancel Edit
          </button>
        )}
      </div>

      {mode === "view" ? (
        <ProfileDisplay
          profile={{
            wallet: account.address,
            name: profile.name,
            bio: profile.bio,
            profileAddress: profile.profileAddress,
            profileURI: profile.profileURI,
          }}
        />
      ) : (
        <ProfileEdit
          initialProfile={{
            name: profile.name,
            bio: profile.bio,
            profileURI: profile.profileURI,
          }}
          profileAddress={profile.profileAddress}
          onUpdated={(updated) => {
            setProfile({
              ...profile,
              name: updated.name,
              bio: updated.bio,
              profileURI: updated.profileURI,
            });
            setMode("view");
          }}
        />
      )}
    </section>
  );
}
