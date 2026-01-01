"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";

export function WalletSessionGuard({ children }: { children: React.ReactNode }) {
  const account = useActiveAccount();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Give autoConnect a little time to restore the session
    const timer = setTimeout(() => {
      setChecking(false);
    }, 1200); // e.g., 1.2 seconds

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!checking && !account) {
      router.push("/"); 
    }
  }, [checking, account, router]);

  if (checking) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center">
        <h2 className="text-2xl font-bold">Checking Wallet Session...</h2>
        <p className="text-foreground-secondary mt-2">
          Please wait a moment.
        </p>
      </div>
    );
  }

  if (!account) {
    return null;
  }

  return <>{children}</>;
}
