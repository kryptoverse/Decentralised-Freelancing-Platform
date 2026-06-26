/**
 * WORQS platform knowledge base (server-side only).
 *
 * Why this exists: the AI assistant kept refusing platform/FAQ questions
 * because it had no platform facts — only per-page user data. Pasting the
 * full spec into every request would burn ~800 tokens per turn.
 *
 * Instead we chunk the knowledge into keyword-tagged sections and inject only
 * the slice(s) relevant to the user's latest question. A data-only question
 * ("what's my balance?") matches nothing and adds 0 tokens; a focused FAQ
 * ("how do dividends work?") pulls in just that section (~80-150 tokens).
 *
 * This module is imported by the /api/chat route ONLY — it never ships to the
 * client and is never part of the request payload.
 */

/** Always-available one-liner so "what is WORQS?" is never refused. */
export const CORE_FACTS =
  "WORQS (worqs.dev) is a decentralized freelancing + investment platform on the Polygon Amoy testnet. All payments use USDT (testnet only, no real money). Roles: Freelancer, Client, Investor, Admin — one wallet can hold multiple roles, one profile per role.";

interface KbSection {
  id: string;
  keywords: string[];
  content: string;
}

/**
 * Knowledge chunks. Keep each `content` self-contained and compact — it is
 * injected verbatim. `keywords` are matched (lowercased, substring) against the
 * user's latest message to decide relevance.
 */
export const KB_SECTIONS: KbSection[] = [
  {
    id: "roles",
    keywords: ["role", "freelancer", "client", "investor", "admin", "who can", "account type", "profile per"],
    content:
      "ROLES: Freelancer (applies for jobs, builds reputation, can tokenize their business). Client (posts jobs, hires, approves work). Investor (buys shares, funds jobs, earns dividends). Admin (resolves disputes). The same wallet can be both client and freelancer. One profile per role per wallet.",
  },
  {
    id: "wallets",
    keywords: ["wallet", "login", "password", "gas", "sponsored", "personal", "sign in", "fees to use", "free action", "pay gas"],
    content:
      "WALLETS / LOGIN: Wallet-based login, no password. Sponsored wallet = free actions (creating profiles, posting jobs, applying — gas paid by the platform). Personal wallet = financial actions (hiring, withdrawals, investing — user pays gas and needs USDT).",
  },
  {
    id: "freelancing-flow",
    keywords: ["job", "post", "apply", "hire", "escrow", "deliver", "approve", "offer", "proposal", "bid", "deadline", "auto-approve", "review window", "submit", "work", "tags", "budget", "how do i get hired", "how to hire"],
    content:
      "FREELANCING FLOW: Client posts a job (title, description stored on IPFS, USDT budget, up to 5 tags, optional expiry). Freelancers apply with an optional proposal/bid/timeline. A client may also send a Direct Offer to a specific freelancer (no money locked until accepted + escrow funded). On hire, one atomic transaction deploys a JobEscrow contract AND locks the USDT inside it. The freelancer delivers work (IPFS link; multiple resubmissions allowed and all tracked). The client approves with a 1-5 star rating → platform fee deducted → USDT sent instantly to the freelancer → escrow permanently closed.",
  },
  {
    id: "deadlines-cancel-dispute",
    keywords: ["deadline", "auto", "refund", "cancel", "dispute", "freeze", "admin", "missed", "no response", "didn't respond", "split", "evidence", "arbitration", "fee", "refund fee"],
    content:
      "DEADLINES / CANCEL / DISPUTES: If the client doesn't respond within the review window, auto-approval pays the freelancer. If the freelancer misses the delivery deadline, an auto-refund returns funds to the client. Cancellation before delivery: the client can cancel unilaterally within the cancel window (full refund). After delivery: both parties must agree to cancel. Disputes: either party raises one with a reason (IPFS) → the job freezes → an admin reviews evidence and decides any % split → money is distributed → escrow closes. No fee on refunds. A fee applies only to freelancer payouts (max 10%).",
  },
  {
    id: "reputation",
    keywords: ["reputation", "level", "points", "rating", "stars", "rank", "score", "kyc", "service", "services", "trust", "fake"],
    content:
      "REPUTATION: Each approved job adds its star rating to total points. Levels 0-5 require BOTH jobs AND points: L1=5 jobs/20 pts, L2=10/45, L3=15/70, L4=20/95, L5=25/120. It cannot be faked — only the escrow contract can write ratings. It tracks total earnings, disputes, cancellations, and join date, and is permanent/undeletable. KYC is required only to list Services (up to 100 per freelancer).",
  },
  {
    id: "company-shares",
    keywords: ["company", "share", "shares", "token", "tokenize", "equity", "dividend", "dividends", "vault", "treasury", "investor", "funding round", "revenue", "profit", "distributor", "sharesale", "erc-20", "erc20", "claim"],
    content:
      "COMPANY SHARES: A freelancer can create a tokenized company, deploying 4 contracts: ShareToken (ERC-20 equity), CompanyVault (treasury), DividendDistributor, and ShareSale. One company per wallet. The owner starts funding rounds (sets price + share quantity) → investors buy with USDT → funds go to the vault → the owner withdraws to run the business. Hardcoded Smart Revenue Rules (immutable after creation): expenses capped at 70% of revenue; investors always get the larger of 10% of revenue OR 40% of net profit. The owner closes a period → the investor pool goes to the distributor → investors claim proportional USDT anytime. Dividends never expire and use O(1) gas regardless of investor count. A freelancer can permanently link their profile to the vault so job payments flow in as company revenue automatically (one-time link; not linking keeps income separate).",
  },
  {
    id: "job-fundraising",
    keywords: ["fund a job", "job fundraising", "fund job", "invest in a job", "principal", "short-term", "long-term", "portfolio"],
    content:
      "JOB FUNDRAISING vs SHARES: Job fundraising is short-term — investors fund one specific job and get their principal back plus a profit share when the job pays out. Company Shares are long-term ongoing equity. Both are tracked in the investor portfolio dashboard.",
  },
  {
    id: "security",
    keywords: ["security", "secure", "safe", "audit", "reentrancy", "hack", "steal", "vulnerability", "mythril", "trust", "can the platform"],
    content:
      "SECURITY: ReentrancyGuard, SafeERC20, role-based access control, atomic escrow funding, immutable addresses, a terminal flag that locks closed escrows, and nonce-based KYC to prevent replay attacks. Mythril audit reported zero vulnerabilities. The platform cannot steal funds, fake reputation, or change investor rules after deployment.",
  },
  {
    id: "limits",
    keywords: ["limit", "limitation", "testnet", "real money", "secondary market", "sell shares", "currency", "usdt only", "mobile", "app", "coming soon", "planned"],
    content:
      "LIMITS: Testnet only (no real money). A human admin handles disputes (decentralized arbitration is planned). No share secondary market yet. USDT is the only currency. Web platform only, at worqs.dev.",
  },
];

const GENERAL_HINTS = ["worqs", "platform", "how does", "how do", "what is", "what does", "explain", "tell me about", "can i", "what can", "help"];

/**
 * Select the platform-knowledge slice relevant to a user message.
 * Returns an empty string when nothing matches (e.g. pure data questions),
 * so non-platform turns cost zero extra tokens.
 *
 * @param query   the user's latest message
 * @param maxSections cap on sections returned, to bound token usage
 */
export function retrieveKnowledge(query: string, maxSections = 3): string {
  const q = (query || "").toLowerCase();
  if (!q.trim()) return "";

  const scored = KB_SECTIONS.map((s) => {
    const score = s.keywords.reduce((n, kw) => (q.includes(kw) ? n + 1 : n), 0);
    return { section: s, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSections)
    .map((x) => x.section.content);

  if (scored.length > 0) {
    // Lead with the one-liner so general framing is always present, cheaply.
    return [CORE_FACTS, ...scored].join("\n\n");
  }

  // No specific section hit — if it still smells like a platform question,
  // give the cheap core summary; otherwise add nothing.
  if (GENERAL_HINTS.some((h) => q.includes(h))) return CORE_FACTS;
  return "";
}
