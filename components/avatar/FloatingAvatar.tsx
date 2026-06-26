"use client";

import { useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { X, UserRound } from "lucide-react";
import { getSessionAvatar } from "@/avatar/assignRandomAvatar";
import { useAvatarState } from "@/avatar/useAvatarState";
import {
  playAvatarAnimation,
  playRandomAvatarAnimation,
  listAvatarAnimations,
} from "@/avatar/avatarController";
import { AvatarErrorBoundary } from "./AvatarErrorBoundary";

/**
 * The HEAVY 3D canvas is loaded lazily and client-only. Importing this module
 * does NOT pull Three.js into the bundle — the import() only resolves at
 * runtime, so initial page loads stay light even though the avatar is shown by
 * default.
 */
const LazyAvatarCanvas = dynamic(() => import("./AvatarCanvas"), {
  ssr: false,
  loading: () => null,
});

// Pages with their own full-screen chat experience: the avatar is visually
// hidden here but kept MOUNTED, so navigating back doesn't reload it.
function isHiddenPath(pathname: string): boolean {
  return (
    pathname === "/client/chat" ||
    pathname === "/freelancer/chat" ||
    pathname.startsWith("/chat/")
  );
}

export default function FloatingAvatar() {
  // Stable across reloads / full-page navigations within this browser session
  // (sessionStorage-backed) so the character never re-randomizes or re-downloads.
  const avatar = useMemo(() => getSessionAvatar(), []);

  const isHidden = useAvatarState((s) => s.isHidden);
  const setHidden = useAvatarState((s) => s.setHidden);
  const setAnimGender = useAvatarState((s) => s.setAnimGender);
  const constraintsRef = useRef<HTMLDivElement>(null);

  // Tell the store which animation library (male/female) to use, and expose a
  // simple controller on window for triggering animations from anywhere.
  useEffect(() => {
    setAnimGender(avatar.animGender);
    if (typeof window !== "undefined") {
      (window as unknown as { worqsAvatar?: unknown }).worqsAvatar = {
        play: playAvatarAnimation,
        playRandom: playRandomAvatarAnimation,
        list: listAvatarAnimations,
      };
    }
  }, [avatar.animGender, setAnimGender]);

  const pathname = usePathname();
  const hiddenByPath = isHiddenPath(pathname || "");

  // User-hidden: show a small launcher to bring it back (never on hidden paths).
  if (isHidden) {
    if (hiddenByPath) return null;
    return (
      <button
        type="button"
        onClick={() => setHidden(false)}
        title="Show assistant avatar"
        aria-label="Show assistant avatar"
        className="fixed bottom-20 right-2 z-40 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/40 bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/30 transition-transform hover:scale-105 active:scale-95 md:bottom-24 md:right-5 md:h-11 md:w-11"
      >
        <UserRound className="h-4 w-4 md:h-5 md:w-5" />
      </button>
    );
  }

  return (
    // Full-viewport, click-through layer that just provides drag constraints.
    // `hidden` on chat pages keeps the canvas mounted (loaded) but out of view.
    <div
      ref={constraintsRef}
      className={`pointer-events-none fixed inset-0 z-40 ${hiddenByPath ? "hidden" : ""}`}
    >
      <motion.div
        drag
        dragMomentum={false}
        dragConstraints={constraintsRef}
        dragElastic={0.03}
        // Smaller on mobile, full size on desktop. Sits above the chat launcher.
        className="group pointer-events-auto absolute bottom-20 right-2 h-[220px] w-[150px] cursor-grab active:cursor-grabbing md:bottom-24 md:right-4 md:h-[350px] md:w-[245px]"
      >
        {/* Transparent avatar — no card, no top bar; reads as part of the page. */}
        <div className="relative h-full w-full select-none">
          <AvatarErrorBoundary fallback={null}>
            <LazyAvatarCanvas avatar={avatar} />
          </AvatarErrorBoundary>

          {/* Subtle hide control, only on hover. */}
          <button
            type="button"
            aria-label="Hide avatar"
            title="Hide for this session"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setHidden(true)}
            className="pointer-events-auto absolute right-1 top-1 z-10 rounded-full bg-black/30 p-1 text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 hover:bg-black/50 group-hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
