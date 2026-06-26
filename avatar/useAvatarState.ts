import { create } from "zustand";
import type { AvatarExpression } from "./expressionPresets";
import type { AvatarAnimation, AnimGender } from "./animationMap";

/**
 * Tiny global store shared between the chat (writer) and the avatar (reader).
 *
 * Feather-light (just zustand) so the chat can import it without pulling in any
 * Three.js. If the avatar UI never mounts, writes here are simply unobserved —
 * they can never error or block chat. This is the ONLY contract point.
 *
 * Body animations are ONE-SHOT and triggered explicitly via `playOnce`
 * (incrementing `oneShotToken`). There is no continuously-looping state — the
 * avatar rests in a calm pose and only reacts when the AI responds.
 */
export type AvatarState = {
  expression: AvatarExpression;
  isSpeaking: boolean;
  isHidden: boolean;

  /** Which clip the most recent one-shot wants to play. */
  animation: AvatarAnimation;
  /** Bumped every time a one-shot animation should fire. 0 = nothing yet. */
  oneShotToken: number;
  /** Gender of the currently-mounted avatar (drives the animation library). */
  animGender: AnimGender;

  setExpression: (expression: AvatarExpression) => void;
  setSpeaking: (isSpeaking: boolean) => void;
  setHidden: (isHidden: boolean) => void;
  setAnimGender: (animGender: AnimGender) => void;

  /** Trigger a single, non-looping playback of `animation`. */
  playOnce: (animation: AvatarAnimation) => void;
};

export const useAvatarState = create<AvatarState>((set) => ({
  expression: "calm",
  isSpeaking: false,
  isHidden: false,

  animation: "idle",
  oneShotToken: 0,
  animGender: "female",

  setExpression: (expression) => set({ expression }),
  setSpeaking: (isSpeaking) => set({ isSpeaking }),
  setHidden: (isHidden) => set({ isHidden }),
  setAnimGender: (animGender) => set({ animGender }),

  playOnce: (animation) =>
    set((s) => ({ animation, oneShotToken: s.oneShotToken + 1 })),
}));
