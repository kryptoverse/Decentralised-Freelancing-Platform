"use client";

interface ProfileDisplayProps {
  profile: {
    wallet: string;
    name: string;
    bio: string;
    profileURI: string;
    profileAddress: string;
  };
}

export function ProfileDisplay({ profile }: ProfileDisplayProps) {
  return (
    <div className="p-6 rounded-2xl glass-effect border border-border shadow-md space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-primary">{profile.name}</h2>
        <p className="text-xs text-foreground-secondary">
          Wallet: {profile.wallet.slice(0, 6)}...{profile.wallet.slice(-4)}
        </p>
        <p className="text-[10px] text-foreground-secondary break-all">
          Profile Contract: {profile.profileAddress}
        </p>
      </div>

      {/* Bio */}
      <div>
        <p className="text-sm text-foreground-secondary font-semibold uppercase tracking-wide">
          Bio
        </p>
        <p className="text-base whitespace-pre-line">{profile.bio}</p>
      </div>

      {/* Optional metadata URI */}
      {profile.profileURI && (
        <div>
          <p className="text-sm text-foreground-secondary font-semibold uppercase tracking-wide">
            Profile Metadata
          </p>
          <a
            href={
              profile.profileURI.startsWith("ipfs://")
                ? profile.profileURI.replace("ipfs://", "https://ipfs.io/ipfs/")
                : profile.profileURI
            }
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline text-sm break-all"
          >
            {profile.profileURI}
          </a>
        </div>
      )}
    </div>
  );
}
