"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useActiveAccount, useActiveWalletConnectionStatus } from "thirdweb/react";

export function WalletSessionGuard({ children }: { children: React.ReactNode }) {
  const account = useActiveAccount();
  const connectionStatus = useActiveWalletConnectionStatus();
  const router = useRouter();

  // Determine if this is a public path that doesn't REQUIRE a wallet.
  const [isPublicPath, setIsPublicPath] = useState(false);

  useEffect(() => {
    // Runs once on mount to determine if the current path is public.
    if (typeof window !== "undefined") {
      setIsPublicPath(/^\/founder\/Company\/\d+$/i.test(window.location.pathname));
    }
  }, []);

  // Only "disconnected" is a definitive "no session". "connecting" and the
  // initial "unknown" mean AutoConnect is still restoring the saved session —
  // we must WAIT and show a loader, never blank out or redirect prematurely.
  const isRestoring = connectionStatus === "connecting" || connectionStatus === "unknown";

  useEffect(() => {
    if (!isPublicPath && connectionStatus === "disconnected" && !account) {
      // No session could be restored — send them to the landing page to log in.
      // replace() so the back button doesn't return to the guarded route.
      router.replace("/");
    }
  }, [connectionStatus, account, router, isPublicPath]);

  // Public pages render regardless of wallet state.
  if (isPublicPath) {
    return <>{children}</>;
  }

  // Session restored — render the protected content.
  if (account) {
    return <>{children}</>;
  }

  // No account yet: either still restoring, or disconnected with a redirect
  // in flight. Always show a loader here — NEVER return null (that was the
  // blank-page-on-refresh bug).
  return (
    <div className="flex flex-col items-center justify-center h-screen text-center px-6">
      <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
      <h2 className="text-2xl font-bold">
        {isRestoring ? "Restoring your session..." : "Redirecting to login..."}
      </h2>
      <p className="text-foreground-secondary mt-2">Please wait a moment.</p>
    </div>
  );
}
