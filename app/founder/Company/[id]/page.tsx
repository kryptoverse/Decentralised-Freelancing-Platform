"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * This page has been superseded by the CompanyPreviewModal on the investor
 * companies listing page. Users clicking "View Details" now see a full-screen
 * popup instead of this dedicated route.
 *
 * This stub redirects any direct URL visitors back to the companies list.
 */
export default function CompanyDetailRedirect() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    // Redirect to investor companies page with the id in the URL hash
    // so the companies page could potentially pre-open the modal in future
    router.replace(`/investor/companies`);
  }, [router, params]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-sm">Redirecting to company explorer...</p>
    </div>
  );
}
