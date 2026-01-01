"use client";

import { ipfsToHttp } from "@/utils/ipfs";

interface ProfileDisplayProps {
  profile: {
    wallet: string;
    name: string;
    bio: string;
    profileURI: string;
    profileAddress: string;
  };
}

// ✅ NAMED export (matches: import { ProfileDisplay } from "...")
export function ProfileDisplay({ profile }: ProfileDisplayProps) {
  const metadataUrl = profile.profileURI ? ipfsToHttp(profile.profileURI) : "";

  return (
    <div className="p-6 rounded-2xl glass-effect border border-border shadow-md space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-primary">{profile.name}</h2>
        <p className="text-xs text-foreground-secondary">
          Wallet: {profile.wallet.slice(0, 6)}...{profile.wallet.slice(-4)}
        </p>
        <p className="text-[10px] text-foreground-secondary break-all">
          Profile Contract: {profile.profileAddress}
        </p>
      </div>

      <div>
        <p className="text-sm text-foreground-secondary font-semibold uppercase tracking-wide">
          Bio
        </p>
        <p className="text-base whitespace-pre-line">{profile.bio}</p>
      </div>

      {profile.profileURI && (
        <div>
          <p className="text-sm text-foreground-secondary font-semibold uppercase tracking-wide">
            Profile Metadata
          </p>
          <a
            href={metadataUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline text-sm break-all"
          >
            {metadataUrl}
          </a>
        </div>
      )}
    </div>
  );
}
