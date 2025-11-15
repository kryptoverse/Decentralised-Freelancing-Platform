"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { getContract, readContract } from "thirdweb";
import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { ipfsToHttp } from "@/utils/ipfs";

interface ClientProfile {
  name: string;
  bio: string;
  company: string;
  profileImage: string;
  profileAddress: string;
}

export default function ClientProfilePage() {
  const account = useActiveAccount();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ClientProfile | null>(null);

  // -----------------------------
  // SAFE ADDRESS NARROWING
  // -----------------------------
  const walletAddress =
    account?.address && typeof account.address === "string"
      ? (account.address as `0x${string}`)
      : null;

  // -----------------------------
  // LOAD PROFILE
  // -----------------------------
  useEffect(() => {
    if (!walletAddress) return;

    async function loadProfile() {
      try {
        setLoading(true);

        const factory = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.ClientFactory,
        });

        if (!walletAddress) return;          // runtime check
const addr = walletAddress;          // TS narrowing → addr is now only `0x${string}`

const profileAddr = await readContract({
  contract: factory,
  method: "function clientProfiles(address) view returns (address)",
  params: [addr],                     // no more error
});


        if (
          !profileAddr ||
          profileAddr === "0x0000000000000000000000000000000000000000"
        ) {
          setProfile(null);
          return;
        }

        const profileContract = getContract({
          client,
          chain: CHAIN,
          address: profileAddr as `0x${string}`,
        });

        const [name, bio, company, profileImage] = await Promise.all([
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
            method: "function company() view returns (string)",
          }),
          readContract({
            contract: profileContract,
            method: "function profileImage() view returns (string)",
          }),
        ]);

        setProfile({
          name,
          bio,
          company,
          profileImage,
          profileAddress: profileAddr,
        });
      } catch (e) {
        console.error("❌ Load client profile error:", e);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [walletAddress]);

  // -----------------------------
  // NO WALLET
  // -----------------------------
  if (!account)
    return (
      <section className="p-4 md:p-6">
        <p className="text-lg font-medium">Please connect your wallet.</p>
      </section>
    );

  // -----------------------------
  // LOADING
  // -----------------------------
  if (loading)
    return (
      <section className="p-4 md:p-6">
        <p className="text-lg opacity-70 animate-pulse">Loading profile...</p>
      </section>
    );

  // -----------------------------
  // NO PROFILE → CREATE
  // -----------------------------
  if (!profile) {
    return (
      <section className="p-4 md:p-6 space-y-4">
        <p className="text-lg font-medium">You have no client profile yet.</p>
        <button
          onClick={() => router.push("/client/profile/create")}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-xl"
        >
          Create Profile
        </button>
      </section>
    );
  }

  // -----------------------------
  // PROFILE VIEW
  // -----------------------------
  return (
    <section className="p-4 md:p-6 lg:p-8 space-y-6 max-w-3xl w-full mx-auto overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
        <h1 className="text-3xl font-bold">My Client Profile</h1>

        <button
          onClick={() => router.push("/client/profile/create")}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-xl w-full sm:w-auto"
        >
          Edit Profile
        </button>
      </div>

      {/* Profile Card */}
      <div
        className="
          p-4 sm:p-6
          border rounded-xl glass-effect
          flex flex-col sm:flex-row
          gap-6 sm:gap-8 w-full
        "
      >
        {/* Profile Image */}
        <img
          src={
            profile.profileImage
              ? ipfsToHttp(profile.profileImage) // 🔥 FIXED IPFS PREVIEW
              : "/placeholder.png"
          }
          alt="Profile"
          className="
            w-28 h-28 sm:w-32 sm:h-32
            rounded-xl object-cover border border-border
            mx-auto sm:mx-0 shadow
          "
        />

        {/* Text Info */}
        <div className="flex-1">
          <h2 className="text-2xl font-semibold">{profile.name}</h2>

          <p className="text-muted-foreground mt-1 whitespace-pre-line">
            {profile.bio}
          </p>

          <p className="mt-3 text-base">
            <span className="font-semibold">Company:</span> {profile.company}
          </p>

          <p className="text-xs opacity-60 mt-3 break-all">
            Contract: {profile.profileAddress}
          </p>
        </div>
      </div>
    </section>
  );
}
