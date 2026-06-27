import { avatarConfig, buildPublicUrl } from "./avatarConfig";

/**
 * Full streamoji animation library (mirrors the backend manifest). Each logical
 * key maps to a male and/or female GLB filename. Not every animation exists for
 * both genders — a missing gender just means that key resolves to `undefined`
 * for that gender and is skipped gracefully at runtime.
 *
 * Served from R2 as: animations/streamoji/{male|female}/{filename}.glb
 *
 * Clips are loaded ON DEMAND (only when requested) and cached, so adding the
 * whole library here costs nothing until an animation is actually played.
 */
export type AnimGender = "male" | "female";
export type AvatarAnimation = string;
export type GenderFiles = { male?: string; female?: string };

const M = (male?: string, female?: string): GenderFiles => ({ male, female });
const pad = (i: number) => String(i).padStart(3, "0");
const k2 = (i: number) => String(i).padStart(2, "0");

const manifest: Record<string, GenderFiles> = {
  // --- Friendly aliases used by the chat reactions ---
  idle: M("M_Standing_Idle_001.glb", "F_Standing_Idle_001.glb"),
  talking: M("M_Talking_Variations_001.glb", "F_Talking_Variations_001.glb"),

  // --- Idle ---
  idle_01: M("M_Standing_Idle_001.glb", "F_Standing_Idle_001.glb"),
  idle_02: M("M_Standing_Idle_002.glb"),

  // --- Locomotion ---
  walk_01: M("M_Walk_001.glb"),
  walk_02: M("M_Walk_002.glb", "F_Walk_002.glb"),
  walk_03: M(undefined, "F_Walk_003.glb"),
  run_01: M("M_Run_001.glb", "F_Run_001.glb"),
  jog_01: M("M_Jog_001.glb", "F_Jog_001.glb"),
  jog_03: M("M_Jog_003.glb"),
  walk_back: M("M_Walk_Backwards_001.glb"),
  run_back: M("M_Run_Backwards_002.glb"),
  jog_back: M("M_Jog_Backwards_001.glb"),
  walk_jump_1: M("M_Walk_Jump_001.glb"),
  walk_jump_2: M("M_Walk_Jump_002.glb"),
  walk_jump_3: M("M_Walk_Jump_003.glb"),
  run_jump_1: M("M_Run_Jump_001.glb"),
  run_jump_2: M("M_Run_Jump_002.glb"),
  jog_jump_1: M("M_Jog_Jump_001.glb"),
  jog_jump_2: M("M_Jog_Jump_002.glb"),
  walk_strafe_l: M("M_Walk_Strafe_Left_002.glb", "F_Walk_Strafe_Left_001.glb"),
  walk_strafe_r: M("M_Walk_Strafe_Right_002.glb", "F_Walk_Strafe_Right_001.glb"),
  crouch: M("M_Crouch_Walk_003.glb", "F_Crouch_Walk_001.glb"),
};

// --- Idle variations (male 1..10, female 1..9) ---
for (let i = 1; i <= 10; i += 1) {
  manifest[`idle_var_${k2(i)}`] = M(
    `M_Standing_Idle_Variations_${pad(i)}.glb`,
    i <= 9 ? `F_Standing_Idle_Variations_${pad(i)}.glb` : undefined
  );
}

// --- Dances (male 1..9,11 ; female dances removed) ---
for (const i of [1, 2, 3, 4, 5, 6, 7, 8, 9, 11]) {
  manifest[`dance_${k2(i)}`] = M(`M_Dances_${pad(i)}.glb`);
}

// --- Standing expressions (male only; no 003) ---
for (const i of [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]) {
  manifest[`expr_${k2(i)}`] = M(`M_Standing_Expressions_${pad(i)}.glb`);
}

// --- Talking variations (male 1..10, female 1..6) ---
for (let i = 1; i <= 10; i += 1) {
  manifest[`talk_${k2(i)}`] = M(
    `M_Talking_Variations_${pad(i)}.glb`,
    i <= 6 ? `F_Talking_Variations_${pad(i)}.glb` : undefined
  );
}

export const animationManifest = manifest;

export function buildAnimationUrl(gender: AnimGender, fileName: string): string {
  return buildPublicUrl(`${avatarConfig.animations.prefix}/${gender}/${fileName}`);
}

/** Resolve a logical animation key to a filename for the given gender. */
export function resolveAnimationFile(
  key: string,
  gender: AnimGender
): string | undefined {
  return animationManifest[key]?.[gender];
}

/** Resolve a logical animation key to a full URL, or undefined if N/A. */
export function resolveAnimationUrl(
  key: string,
  gender: AnimGender
): string | undefined {
  const file = resolveAnimationFile(key, gender);
  return file ? buildAnimationUrl(gender, file) : undefined;
}

/** All animation keys, optionally filtered to those available for a gender. */
export function listAnimationKeys(gender?: AnimGender): string[] {
  const keys = Object.keys(animationManifest);
  return gender ? keys.filter((k) => animationManifest[k][gender]) : keys;
}

/** Keys whose name starts with a category prefix (e.g. "dance", "walk"). */
export function animationsByCategory(
  category: string,
  gender?: AnimGender
): string[] {
  return listAnimationKeys(gender).filter((k) => k.startsWith(category));
}

/** Warm these immediately: the looping idle base + the default talk reaction. */
export const EAGER_ANIMATION_KEYS = ["idle", "talking"] as const;
