import { useAvatarState } from "./useAvatarState";
import {
  listAnimationKeys,
  animationsByCategory,
  animationManifest,
} from "./animationMap";

/**
 * Public, fail-safe API for driving the avatar's body animations from anywhere
 * (chat handlers, buttons, the dev console, etc.). Every call is a no-op if the
 * avatar isn't mounted or the key is unknown — it can never throw into caller
 * code.
 *
 * Any played animation runs ONCE and then the avatar returns to its looping
 * idle automatically (handled in AvatarModel).
 */

/** Play a specific animation by its logical key, e.g. "dance_01", "walk_02". */
export function playAvatarAnimation(key: string): void {
  try {
    if (!animationManifest[key]) {
      // eslint-disable-next-line no-console
      console.warn(`[avatar] unknown animation "${key}" — ignored`);
      return;
    }
    useAvatarState.getState().playOnce(key);
  } catch {
    /* avatar absent / disabled — ignore */
  }
}

/** All known animation keys (optionally only those valid for the current avatar). */
export function listAvatarAnimations(forCurrentGender = false): string[] {
  try {
    const gender = forCurrentGender
      ? useAvatarState.getState().animGender
      : undefined;
    return listAnimationKeys(gender);
  } catch {
    return Object.keys(animationManifest);
  }
}

/**
 * Play a random animation, optionally limited to a category prefix
 * (e.g. "dance", "walk", "talk", "expr", "idle_var"). Picks only from clips that
 * exist for the current avatar's gender so it always resolves to something real.
 */
export function playRandomAvatarAnimation(category?: string): void {
  try {
    const gender = useAvatarState.getState().animGender;
    const pool = category
      ? animationsByCategory(category, gender)
      : listAnimationKeys(gender);
    if (!pool.length) return;
    const key = pool[Math.floor(Math.random() * pool.length)];
    useAvatarState.getState().playOnce(key);
  } catch {
    /* ignore */
  }
}

/** Convenience grouping for menus / quick testing. */
export const avatarAnimationCategories = [
  "idle",
  "idle_var",
  "talk",
  "dance",
  "walk",
  "run",
  "jog",
  "expr",
  "crouch",
] as const;
