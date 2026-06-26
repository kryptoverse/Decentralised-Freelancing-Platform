/**
 * Central, side-effect-free configuration for the avatar feature.
 *
 * Everything here reads ONLY NEXT_PUBLIC_* env vars (safe to ship to the
 * browser). No R2 secret keys are ever referenced. If a value is missing we
 * fall back to a sensible default so the module can never throw at import time.
 */

const PUBLIC_BASE_URL = (
  process.env.NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_BASE_URL || ""
).replace(/\/+$/, "");

export const avatarConfig = {
  /** Master kill switch. Anything other than the string "false" keeps it on. */
  enabled: process.env.NEXT_PUBLIC_AVATAR_ENABLED !== "false",

  /** Public R2 base URL, e.g. https://pub-xxxx.r2.dev (trailing slash stripped). */
  publicBaseUrl: PUBLIC_BASE_URL,

  /** Whether we have enough config to even attempt loading an avatar. */
  get isConfigured() {
    return Boolean(PUBLIC_BASE_URL);
  },

  avatars: {
    prefix: process.env.NEXT_PUBLIC_ASSIGNED_AVATARS_R2_PREFIX || "avatars",
    girlFolder: process.env.NEXT_PUBLIC_ASSIGNED_AVATARS_GIRL_FOLDER || "girls",
    boyFolder: process.env.NEXT_PUBLIC_ASSIGNED_AVATARS_BOY_FOLDER || "Boys",
    versions: 6,
  },

  animations: {
    prefix:
      process.env.NEXT_PUBLIC_STREAMOJI_ANIMATIONS_R2_PREFIX ||
      "animations/streamoji",
  },
} as const;

/** Join the public base URL with a storage key, safely. */
export function buildPublicUrl(storageKey: string): string {
  return `${avatarConfig.publicBaseUrl}/${storageKey.replace(/^\/+/, "")}`;
}
