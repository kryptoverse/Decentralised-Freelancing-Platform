import { useAvatarState } from "./useAvatarState";
import { expressionFromMessage } from "./expressionPresets";

/**
 * Fail-safe, fire-and-forget bridge the CHAT uses to drive the avatar.
 *
 * Every call is wrapped so that ANY error originating from the avatar side can
 * never bubble into the chat. The chat depends on this thin module only — not
 * on Three.js or any rendering code.
 *
 * Animation policy (per product requirement):
 *   - A body animation plays ONLY when the AI actually responds.
 *   - It plays ONCE and never loops.
 *   - Typing / sending a message changes only the (subtle) facial expression,
 *     never the body animation.
 */
function safe(fn: () => void): void {
  try {
    fn();
  } catch {
    /* never let avatar issues affect chat */
  }
}

let calmTimer: ReturnType<typeof setTimeout> | null = null;

function clearCalmTimer() {
  if (calmTimer) {
    clearTimeout(calmTimer);
    calmTimer = null;
  }
}

export const avatarSignals = {
  /** User is typing — facial only, no body animation. */
  userTyping() {
    safe(() => {
      clearCalmTimer();
      useAvatarState.getState().setExpression("calm");
    });
  },

  /** User submitted — facial only. Deliberately does NOT start an animation. */
  userSent() {
    safe(() => {
      clearCalmTimer();
      useAvatarState.getState().setExpression("thinking");
    });
  },

  /** First token of the AI response arrived — the ONE place body anim fires. */
  aiSpeaking() {
    safe(() => {
      clearCalmTimer();
      const s = useAvatarState.getState();
      s.setSpeaking(true);
      s.setExpression("encouraging");
      s.playOnce("talking"); // single, non-looping playback
    });
  },

  /** AI finished — settle on a sentiment expression, then relax to calm. */
  aiDone(fullMessage: string) {
    safe(() => {
      clearCalmTimer();
      const s = useAvatarState.getState();
      s.setSpeaking(false);
      s.setExpression(expressionFromMessage(fullMessage));
      calmTimer = setTimeout(() => {
        safe(() => useAvatarState.getState().setExpression("calm"));
      }, 3000);
    });
  },

  /** Something went wrong in chat — facial only. */
  error() {
    safe(() => {
      clearCalmTimer();
      const s = useAvatarState.getState();
      s.setSpeaking(false);
      s.setExpression("surprised");
      calmTimer = setTimeout(() => {
        safe(() => useAvatarState.getState().setExpression("calm"));
      }, 2500);
    });
  },

  /** Back to resting state. */
  idle() {
    safe(() => {
      clearCalmTimer();
      const s = useAvatarState.getState();
      s.setSpeaking(false);
      s.setExpression("calm");
    });
  },
};
