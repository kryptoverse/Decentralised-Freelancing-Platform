"use client";

import dynamic from "next/dynamic";
import { avatarConfig } from "@/avatar/avatarConfig";
import { AvatarErrorBoundary } from "./AvatarErrorBoundary";

/**
 * Single global mount point for the floating avatar, rendered once in the root
 * layout so it stays MOUNTED across all client-side navigation (it never
 * reloads when switching role tabs/pages). Per-route visibility (e.g. hiding it
 * on full-screen chat pages) is handled inside FloatingAvatar by toggling
 * visibility, not by unmounting — so the 3D canvas is never torn down.
 *
 * Everything is client-only and lazy: FloatingAvatar (and through it the 3D
 * canvas) is dynamically imported with ssr:false. If the feature is disabled or
 * unconfigured, this renders nothing and imports nothing heavy.
 */
const FloatingAvatar = dynamic(() => import("./FloatingAvatar"), {
  ssr: false,
  loading: () => null,
});

export function GlobalAvatar() {
  if (!avatarConfig.enabled || !avatarConfig.isConfigured) return null;

  // Fallback is `null`: if the floating chrome itself ever errors, the app is
  // completely unaffected — the avatar simply doesn't appear.
  return (
    <AvatarErrorBoundary fallback={null}>
      <FloatingAvatar />
    </AvatarErrorBoundary>
  );
}
