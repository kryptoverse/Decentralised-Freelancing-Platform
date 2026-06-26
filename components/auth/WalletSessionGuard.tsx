"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount, useActiveWalletConnectionStatus } from "thirdweb/react";

export function WalletSessionGuard({ children }: { children: React.ReactNode }) {
  const account = useActiveAccount();
  const connectionStatus = useActiveWalletConnectionStatus();
  const router = useRouter();
  
  // Determine if this is a public path that doesn't REQUIRE a wallet
  const [isPublicPath, setIsPublicPath] = useState(false);

  useEffect(() => {
    // This effect runs only once on mount to determine if the current path is public.
    if (typeof window !== "undefined") {
      setIsPublicPath(/^\/founder\/Company\/\d+$/i.test(window.location.pathname));
    }
  }, []);

  const isConnecting = connectionStatus === "connecting";

  useEffect(() => {
    if (connectionStatus === "disconnected" && !account && !isPublicPath) {
      router.push("/");
    }
  }, [connectionStatus, account, router, isPublicPath]);

  // If it's a public path, we show the content even during checking or if no account is found
  if (isPublicPath) {
    return <>{children}</>;
  }

  if (isConnecting) {
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
