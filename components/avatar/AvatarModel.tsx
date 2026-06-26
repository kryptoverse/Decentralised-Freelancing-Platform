"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { expressionPresets } from "@/avatar/expressionPresets";
import {
  resolveAnimationUrl,
  EAGER_ANIMATION_KEYS,
} from "@/avatar/animationMap";
import { useAvatarState } from "@/avatar/useAvatarState";
import type { AssignedAvatar } from "@/avatar/assignRandomAvatar";

/**
 * Renders one assigned character and plays animations from the full streamoji
 * library on demand.
 *
 * Animation policy:
 *  - IDLE is the always-on base: it LOOPS continuously and is the resting/
 *    fallback state.
 *  - ANY other animation (talk, dance, walk, run, jump, expr, ...) plays exactly
 *    ONCE on trigger (LoopOnce, clampWhenFinished), crossfading over the idle;
 *    when it finishes the avatar crossfades straight back to the looping idle.
 *
 * Loading:
 *  - Clips are fetched ON DEMAND by logical key, then cached. Only idle + the
 *    default talk are warmed up front; everything else loads the first time it's
 *    requested (and is instant thereafter).
 *
 * Robustness:
 *  - The character GLB is REQUIRED: a load failure throws and the surrounding
 *    <AvatarErrorBoundary> shows the fallback (chat unaffected).
 *  - Animation GLBs are OPTIONAL: a 404 / missing-for-gender / parse error
 *    resolves to null and is skipped silently (the avatar just keeps idling).
 *  - Unknown morph-target names are ignored.
 */
export default function AvatarModel({ avatar }: { avatar: AssignedAvatar }) {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF(avatar.glbUrl);

  const expression = useAvatarState((s) => s.expression);
  const animation = useAvatarState((s) => s.animation);
  const oneShotToken = useAvatarState((s) => s.oneShotToken);

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const loaderRef = useRef<GLTFLoader | null>(null);
  const clipsRef = useRef<Record<string, THREE.AnimationClip>>({});
  const clipPromisesRef = useRef<Record<string, Promise<THREE.AnimationClip | null>>>({});
  const idleActionRef = useRef<THREE.AnimationAction | null>(null);
  const idleClipRef = useRef<THREE.AnimationClip | null>(null);
  const reactionActionRef = useRef<THREE.AnimationAction | null>(null);
  const cancelledRef = useRef(false);
  const reqCounterRef = useRef(0);

  // Meshes that actually carry morph targets (facial expressions).
  const morphMeshes = useMemo(() => {
    const meshes: THREE.Mesh[] = [];
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        meshes.push(mesh);
      }
    });
    return meshes;
  }, [scene]);

  /** Fetch (or return cached) animation clip for a logical key. Never throws. */
  function loadClip(key: string): Promise<THREE.AnimationClip | null> {
    const cached = clipsRef.current[key];
    if (cached) return Promise.resolve(cached);
    const inflight = clipPromisesRef.current[key];
    if (inflight) return inflight;

    const url = resolveAnimationUrl(key, avatar.animGender);
    const loader = loaderRef.current;
    if (!url || !loader) return Promise.resolve(null);

    const p = new Promise<THREE.AnimationClip | null>((resolve) => {
      loader.load(
        url,
        (gltf) => {
          const clip = gltf.animations?.[0] ?? null;
          if (clip) {
            clip.name = key; // normalise so cache key === clip name
            clipsRef.current[key] = clip;
          }
          resolve(clip);
        },
        undefined,
        () => resolve(null) // 404 / network / parse error -> skip
      );
    });
    clipPromisesRef.current[key] = p;
    return p;
  }

  /** Start (once) the always-looping idle base, loading it if needed. */
  function ensureIdleLoop() {
    if (idleActionRef.current) return;
    loadClip("idle").then((clip) => {
      const mixer = mixerRef.current;
      if (cancelledRef.current || idleActionRef.current || !clip || !mixer) return;
      idleClipRef.current = clip;
      const action = mixer.clipAction(clip);
      action.reset();
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
      action.fadeIn(0.4).play();
      idleActionRef.current = action;
    });
  }

  /** Play a reaction clip once, crossfading from idle; it returns on finish. */
  function playReaction(clip: THREE.AnimationClip) {
    const mixer = mixerRef.current;
    if (!mixer) return;
    ensureIdleLoop();
    const idle = idleActionRef.current;
    const action = mixer.clipAction(clip);
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.enabled = true;
    action.play();
    if (idle) action.crossFadeFrom(idle, 0.3, false);
    else action.fadeIn(0.3);
    reactionActionRef.current = action;
  }

  // One-time mixer/loader setup + warm the base animations.
  useEffect(() => {
    cancelledRef.current = false;
    const mixer = new THREE.AnimationMixer(scene);
    mixerRef.current = mixer;
    loaderRef.current = new GLTFLoader();
    clipsRef.current = {};
    clipPromisesRef.current = {};
    idleActionRef.current = null;
    idleClipRef.current = null;
    reactionActionRef.current = null;

    // We deliberately do NOT use the character GLB's own embedded clips: body
    // motion comes exclusively from the streamoji library, so a stray embedded
    // clip can never be mistaken for the idle.

    // When a reaction finishes, crossfade straight back to the looping idle.
    const onFinished = (e: { action: THREE.AnimationAction }) => {
      if (e.action !== reactionActionRef.current) return;
      reactionActionRef.current = null;
      const idle = idleActionRef.current;
      if (idle) {
        idle.enabled = true;
        idle.paused = false;
        idle.reset();
        idle.play();
        idle.crossFadeFrom(e.action, 0.4, false);
      } else {
        e.action.fadeOut(0.4);
        ensureIdleLoop();
      }
    };
    mixer.addEventListener("finished", onFinished);

    // Warm up: start the looping idle and pre-cache the default talk reaction.
    EAGER_ANIMATION_KEYS.forEach((key) => loadClip(key));
    ensureIdleLoop();

    return () => {
      cancelledRef.current = true;
      mixer.removeEventListener("finished", onFinished);
      mixer.stopAllAction();
      mixer.uncacheRoot(scene as unknown as THREE.Object3D);
      mixerRef.current = null;
      idleActionRef.current = null;
      reactionActionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, avatar.animGender]);

  // Enable shadows once.
  useEffect(() => {
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }, [scene]);

  // Fire a one-shot animation whenever the token increments.
  useEffect(() => {
    if (oneShotToken === 0) return; // nothing requested yet
    const reqId = (reqCounterRef.current += 1);
    const key = animation;
    loadClip(key).then((clip) => {
      // Ignore if superseded by a newer request or unmounted / unavailable.
      if (reqId !== reqCounterRef.current || cancelledRef.current || !clip) return;
      // If the requested clip is the idle itself, just keep looping idle.
      if (idleClipRef.current && clip === idleClipRef.current) return;
      playReaction(clip);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oneShotToken]);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
    applyExpression(morphMeshes, expression);
  });

  return (
    <group ref={group} position={[0, -1.05, 0]}>
      <primitive object={scene} />
    </group>
  );
}

function applyExpression(meshes: THREE.Mesh[], expressionName: string) {
  const preset =
    expressionPresets[expressionName as keyof typeof expressionPresets] ||
    expressionPresets.neutral;

  for (const mesh of meshes) {
    const dictionary = mesh.morphTargetDictionary;
    const influences = mesh.morphTargetInfluences;
    if (!dictionary || !influences) continue;

    for (let i = 0; i < influences.length; i += 1) {
      influences[i] = THREE.MathUtils.lerp(influences[i], 0, 0.2);
    }
    for (const [key, value] of Object.entries(preset)) {
      const index = dictionary[key];
      if (index !== undefined) {
        influences[index] = THREE.MathUtils.lerp(influences[index], value, 0.25);
      }
    }
  }
}
