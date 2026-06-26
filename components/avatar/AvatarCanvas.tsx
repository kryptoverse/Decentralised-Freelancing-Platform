"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import AvatarModel from "./AvatarModel";
import type { AssignedAvatar } from "@/avatar/assignRandomAvatar";

/**
 * The WebGL surface. Loaded only via dynamic import, so none of the Three.js
 * weight reaches the initial app bundle.
 *
 * The canvas is fully TRANSPARENT (alpha + no clear colour, no Environment/HDR
 * fetch) so the character reads as part of the page rather than a boxed widget.
 * Lighting is self-contained — rendering never depends on a third-party CDN.
 *
 * Pointer events are disabled on the canvas itself; FloatingAvatar puts an
 * invisible drag surface on top, so moving the avatar never conflicts with the
 * 3D view.
 */
export default function AvatarCanvas({ avatar }: { avatar: AssignedAvatar }) {
  return (
    <Canvas
      // Straight-on framing, pulled back far enough to show head-to-feet.
      camera={{ position: [0, 0.25, 4.6], fov: 30 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{ background: "transparent", pointerEvents: "none" }}
      frameloop="always"
    >
      <ambientLight intensity={1.3} />
      <hemisphereLight intensity={0.6} groundColor="#b0a99f" />
      <directionalLight position={[2, 4, 3]} intensity={1.7} />

      <Suspense fallback={null}>
        <AvatarModel avatar={avatar} />
      </Suspense>
    </Canvas>
  );
}
