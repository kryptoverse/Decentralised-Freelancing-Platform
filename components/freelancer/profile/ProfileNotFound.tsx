"use client";

export function ProfileNotFound() {
  return (
    <div className="p-6 rounded-2xl glass-effect border border-border shadow-md space-y-2">
      <p className="text-lg font-semibold text-primary">
        No profile found for this wallet.
      </p>
      <p className="text-sm text-foreground-secondary">
        Create your freelancer profile so clients can find and hire you.
      </p>
    </div>
  );
}
