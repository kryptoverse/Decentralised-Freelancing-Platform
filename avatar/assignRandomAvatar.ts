import { avatarConfig, buildPublicUrl } from "./avatarConfig";

export type AvatarGender = "girl" | "boy";

export type AssignedAvatar = {
  gender: AvatarGender;
  /** Mixamo/streamoji-style gender label used for the animation library. */
  animGender: "male" | "female";
  version: number;
  avatarId: string;
  storageKey: string;
  glbUrl: string;
};

const STORAGE_KEY = "worqs.activeAvatar";

/** Build a full AssignedAvatar from a gender + version (URLs from current env). */
function buildAvatar(gender: AvatarGender, version: number): AssignedAvatar {
  const folder =
    gender === "girl"
      ? avatarConfig.avatars.girlFolder
      : avatarConfig.avatars.boyFolder;

  const fileName = `${gender}V${version}.glb`;
  const storageKey = `${avatarConfig.avatars.prefix}/${folder}/${fileName}`;

  return {
    gender,
    animGender: gender === "girl" ? "female" : "male",
    version,
    avatarId: `${gender}V${version}`,
    storageKey,
    glbUrl: buildPublicUrl(storageKey),
  };
}

/**
 * Pick a random character. Pure (apart from Math.random) — never throws even if
 * env is missing; a failed fetch is handled by the loader/error-boundary.
 *
 * Layout (confirmed against R2):
 *   avatars/girls/girlV{1..6}.glb
 *   avatars/Boys/boyV{1..6}.glb
 */
export function assignRandomAvatar(): AssignedAvatar {
  const gender: AvatarGender = Math.random() < 0.5 ? "girl" : "boy";
  const version = Math.floor(Math.random() * avatarConfig.avatars.versions) + 1;
  return buildAvatar(gender, version);
}

/**
 * Return the avatar for THIS browser session, stable across reloads and
 * full-page navigations. The first call rolls a random character and remembers
 * it in sessionStorage; later calls (including after a hard reload) rebuild the
 * exact same character, so it never re-randomizes and the GLB is served from
 * the browser cache. Falls back to a fresh random pick if storage is
 * unavailable — it can never throw.
 */
export function getSessionAvatar(): AssignedAvatar {
  if (typeof window !== "undefined") {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { gender?: string; version?: number };
        if (
          (parsed.gender === "girl" || parsed.gender === "boy") &&
          typeof parsed.version === "number" &&
          parsed.version >= 1
        ) {
          return buildAvatar(parsed.gender, parsed.version);
        }
      }
    } catch {
      /* ignore corrupt/blocked storage and fall through to a fresh pick */
    }
  }

  const avatar = assignRandomAvatar();

  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ gender: avatar.gender, version: avatar.version })
      );
    } catch {
      /* storage blocked (private mode etc.) — non-fatal */
    }
  }

  return avatar;
}
