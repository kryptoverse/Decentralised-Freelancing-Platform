import { useAvatarState } from "./useAvatarState";
import { resolveAnimationFile } from "./animationMap";
import type { AvatarExpression } from "./expressionPresets";

/**
 * Semantic, FAIL-SAFE avatar reactions for key app events.
 *
 * This is a pure add-on: each function is fire-and-forget and fully wrapped, so
 * it can NEVER throw into or affect the calling business logic. If the avatar is
 * disabled, hidden, unmounted, or errors, these are harmless no-ops.
 *
 * Behaviour on any event:
 *   1. Auto-open the avatar if the user had closed it.
 *   2. Set a fitting facial expression.
 *   3. Play a random body animation from the event's pool (gender-aware — keys
 *      not available for the current avatar are skipped automatically).
 *   4. Relax the expression back to calm after a few seconds.
 */

// --- Animation pools (logical keys from the streamoji manifest) ---

// Celebratory reactions for creation/success events. Keep these non-locomotion
// so creating a job/profile/offer never triggers a walk animation.
const DANCES = [
  "dance_01", "dance_02", "dance_03", "dance_04", "dance_05",
  "dance_06", "dance_07", "dance_08", "dance_09", "dance_11",
];
const SUCCESS_GESTURES = [
  "talk_04", "talk_05", "talk_06",
  "idle_var_03", "idle_var_05", "idle_var_08",
  "expr_05", "expr_06", "expr_10", "expr_14",
];
const CELEBRATE = [...DANCES, ...SUCCESS_GESTURES];

// Upbeat gesture for sending a proposal (talking + a couple of expressions).
const PROPOSAL = [
  "talk_01", "talk_02", "talk_03", "talk_04", "talk_05", "talk_06",
  "expr_05", "expr_06",
];

// Subdued / serious reaction for raising a dispute.
const DISPUTE = ["expr_08", "expr_12", "expr_16", "talk_03"];

let relaxTimer: ReturnType<typeof setTimeout> | null = null;

function fire(pool: string[], expression: AvatarExpression) {
  try {
    const st = useAvatarState.getState();

    // 1. Auto-open if the user had hidden it.
    if (st.isHidden) st.setHidden(false);

    // 2. Expression.
    st.setExpression(expression);

    // 3. Random gender-available animation from the pool.
    const gender = st.animGender;
    const valid = pool.filter((k) => resolveAnimationFile(k, gender));
    if (valid.length) {
      const key = valid[Math.floor(Math.random() * valid.length)];
      st.playOnce(key);
    }

    // 4. Relax back to calm shortly after.
    if (relaxTimer) clearTimeout(relaxTimer);
    relaxTimer = setTimeout(() => {
      try {
        useAvatarState.getState().setExpression("calm");
      } catch {
        /* ignore */
      }
    }, 4500);
  } catch {
    /* avatar absent / disabled — never affect the caller */
  }
}

export const avatarEvents = {
  /** Freelancer/client posted a new job. */
  jobPosted: () => fire(CELEBRATE, "happy"),
  /** Freelancer/client created or saved a profile. */
  profileCreated: () => fire(CELEBRATE, "happy"),
  /** Client hired a freelancer. */
  freelancerHired: () => fire(CELEBRATE, "happy"),
  /** Client approved work and released payment / freelancer received payment. */
  paymentReleased: () => fire(CELEBRATE, "happy"),
  /** Freelancer submitted a proposal. */
  proposalSubmitted: () => fire(PROPOSAL, "encouraging"),
  /** A dispute was raised. */
  disputeRaised: () => fire(DISPUTE, "concerned"),
  /** Freelancer accepted a direct offer (got the job). */
  offerAccepted: () => fire(CELEBRATE, "happy"),
  /** Client sent a direct offer to a freelancer. */
  offerSent: () => fire(PROPOSAL, "encouraging"),
};
