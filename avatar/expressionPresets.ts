/**
 * Facial expressions as ARKit-style morph-target (blend shape) values.
 *
 * The exact morph-target names depend on the GLB. These keys follow the common
 * ARKit naming convention used by Ready Player Me / streamoji-style rigs. Any
 * key that does not exist on a given mesh is simply ignored at runtime, so an
 * unexpected rig can never cause an error — it just animates fewer shapes.
 */
export type AvatarExpression =
  | "neutral"
  | "calm"
  | "happy"
  | "sad"
  | "thinking"
  | "concerned"
  | "surprised"
  | "encouraging";

export const expressionPresets: Record<
  AvatarExpression,
  Record<string, number>
> = {
  neutral: {},

  calm: {
    mouthSmile: 0.15,
    browInnerUp: 0.1,
  },

  happy: {
    mouthSmile: 0.65,
    cheekSquintLeft: 0.3,
    cheekSquintRight: 0.3,
    eyeSquintLeft: 0.15,
    eyeSquintRight: 0.15,
  },

  sad: {
    mouthFrownLeft: 0.45,
    mouthFrownRight: 0.45,
    browInnerUp: 0.35,
  },

  thinking: {
    browDownLeft: 0.25,
    browDownRight: 0.15,
    mouthPressLeft: 0.2,
    mouthPressRight: 0.2,
  },

  concerned: {
    browInnerUp: 0.45,
    mouthFrownLeft: 0.25,
    mouthFrownRight: 0.25,
  },

  surprised: {
    jawOpen: 0.35,
    eyeWideLeft: 0.45,
    eyeWideRight: 0.45,
    browInnerUp: 0.5,
  },

  encouraging: {
    mouthSmile: 0.45,
    browInnerUp: 0.15,
  },
};

/** Map a finished AI message to a fitting expression (best-effort sentiment). */
export function expressionFromMessage(message: string): AvatarExpression {
  const lower = (message || "").toLowerCase();

  if (
    lower.includes("sorry") ||
    lower.includes("difficult") ||
    lower.includes("unfortunately") ||
    lower.includes("hard")
  ) {
    return "concerned";
  }

  if (
    lower.includes("great") ||
    lower.includes("congrat") ||
    lower.includes("proud") ||
    lower.includes("well done") ||
    lower.includes("success")
  ) {
    return "happy";
  }

  if (lower.includes("let me think") || lower.includes("consider")) {
    return "thinking";
  }

  return "calm";
}
