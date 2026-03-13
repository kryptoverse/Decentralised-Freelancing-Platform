# WORQS - Web3 Freelancing & Dual-Funding DApp

WORQS turns **Work** into value, builds **Reputation** on-chain, delivers **QuickPay** instantly, and distributes **Ownership** through **Shares**.

## Overview
Welcome to the future of decentralized work and investing. 

This platform uniquely merges the gig economy with decentralized finance (DeFi). The application allows **Clients** to securely hire **Freelancers** using cryptocurrency (USDT) held safely in automated Smart Contract Escrows. 

However, we go one massive step further: We allow the everyday person to become an **Investor**. 

If a freelancer is performing exceptionally well or lands a massive job they cannot fund out-of-pocket, they can turn to the platform’s investors for liquidity. Investors can fund these freelancers and earn a passive income percentage of the freelancer's actual, verifiable on-chain revenue.

---

## 🏢 The Two Ways to Invest (Dual-Funding Architecture)

We understand that different investors have different risk appetites. Therefore, our platform provides two distinct, secure ways to invest in a Freelancer's success.

### 1. Company Shares (Long-Term Equity)
Freelancers with a proven track record can tokenize their entire freelance business into a "Company". They mint Shares (ERC-20 Tokens) and sell them to investors. 

* **How Investors Profit:** Whenever that Freelancer completes future jobs, a portion of their revenue is deposited into their "Company Vault". Holders of the Company Shares can click a button at any time to claim their percentage of that revenue as a forever-dividend. 
* **The Guarantee:** Smart contracts enforce "Smart Revenue Rules", meaning a freelancer *must* distribute a minimum percentage of all deposited profit to their shareholders, and cannot drain the vault citing fake "expenses".

### 2. Job-Specific Syndication (Short-Term High Yield)
Sometimes a freelancer doesn't want to sell permanent equity in their whole company, but they just landed a massive $5,000 game-development contract. They need $1,000 upfront to hire a 3D Modeler to help them finish the job on time.

* **How Investors Profit:** The Freelancer creates a short-term "Fundraise" specifically for this single job. Investors pool together the $1,000. When the Client god-approves the final delivery, the $5,000 reward automatically routes through the Fundraise smart contract. The contract algorithmically reimburses the investors their $1,000 principal *plus* an agreed-upon percentage of the $4,000 profit. 
* **The Guarantee:** The Client's $5,000 is already locked in a Smart Contract Escrow. The investors know the money is guaranteed to exist the moment the work is approved.

---

## 📖 End-to-End User Story Examples

To understand exactly how the platform works, let's walk through it from the perspective of our three main users: **Sarah (The Client)**, **Alex (The Freelancer)**, and **Dave (The Investor)**.

### Example A: The Core Freelance Flow (No Investors)
1. **Posting:** Sarah needs a Smart Contract audited. She goes to the `JobBoard` and posts a job offering 2,000 USDT.
2. **Applying:** Alex, a verified Web3 Developer, applies for the job. 
3. **Escrow (The Lock):** Sarah accepts Alex's application. To prove she is serious, Sarah deposits the 2,000 USDT into a secure `JobEscrow` smart contract. Alex begins working, knowing the money is safely locked and waiting for him.
4. **Delivery:** Alex submits the audit report via an IPFS link to the Escrow.
5. **Approval:** Sarah reads the report, loves it, and clicks "Approve" on the Escrow. The 2,000 USDT is instantly transferred to Alex's wallet. Alex's on-chain public profile updates to show "+1 Completed Job" and "+2,000 USDT Verifiable Lifetime Earnings".

### Example B: The Short-Term Job Fundraise (With Investor)
1. **The Setup:** Alex wins a massive 10,000 USDT job to build a full SaaS platform. Sarah (Client) locks the 10,000 USDT in the Escrow.
2. **The Problem:** Alex needs to hire a UI Designer for 2,000 USDT upfront, but he doesn't have the cash.
3. **The Solution:** Alex clicks "Fundraise for this Job". He deploys a `JobFundraise` contract asking for 2,000 USDT to cover the designer's expenses. In exchange, he offers investors **50% of the Net Profit**.
4. **The Investment:** Dave (Investor) sees Alex's high rating and the 10,000 USDT safely locked in the Escrow. Dave thinks this is a great bet and invests 2,000 USDT into the Fundraise.
5. **The Work:** Alex withdraws the 2,000 USDT, pays his UI Designer, and completes the SaaS platform.
6. **The Payout (The Magic):** Sarah approves the final work! The `JobEscrow` contract doesn't pay Alex directly. Instead, it fires the 10,000 USDT straight into the `JobFundraise` contract.
7. **The Auto-Math:** The contract automatically calculates:
    - *Net Profit:* 10,000 (Reward) - 2,000 (Target Expenses) = 8,000 USDT.
    - *Dave's Profit (50%):* 4,000 USDT.
    - *Dave's Total Return:* 2,000 (Principal) + 4,000 (Profit) = **6,000 USDT.**
    - *Alex's Remaining Pay:* **4,000 USDT**.
8. **Claiming:** Dave and Alex click "Claim" and instantly receive their respective cuts.

### Example C: The Long-Term Company Shares (With Investor)
1. **The Setup:** Alex has completed 50 jobs on the platform. He has an impeccable 5-star rating and massive verifiable on-chain earnings. He wants to transition from a solo freelancer to a full Agency.
2. **Tokenization:** Alex goes to the `CompanyRegistry` and creates "Alex Web3 & Co." The platform mints 1,000,000 ERC-20 Share Tokens. 
3. **The Sale:** Alex lists 20% (200,000 tokens) for sale to the public. 
4. **The Investment:** Dave buys 100,000 tokens (10% of the company) for 5,000 USDT.
5. **The Forever Dividend:** Six months later, Alex's agency completes a massive 50,000 USDT job. Alex deposits this revenue into his `CompanyVault`. 
6. **The Claim:** Dave, holding 10% of the supply, opens the platform and clicks "Claim Dividends". A highly efficient O(1) `DividendDistributor` contract instantly transfers 5,000 USDT to Dave's wallet. Dave continues to earn passive income for as long as he holds those tokens and Alex continues depositing revenue!

---

## 🛡️ Security Guarantees
- **O(1) Dividend Distribution:** The platform uses a Magnified Dividend Accumulator pattern, meaning dividends scale to millions of users without ever hitting Gas Limit DOS limits (Out-of-Gas errors).
- **Escrow-Backed Syndication:** Investors are mathematically protected by the `JobFundraise`. It algorithmically splits the payout payload at the smart contract level—meaning the freelancer cannot run away with the investor's profit cut.
- **Cancel Protection:** If a Client unexpectedly cancels a job and rips the Escrow funding away from the freelancer *after* the freelancer withdrew the raised funds, the Freelancer can execute a `reimburseInvestors()` transaction. This allows the honest freelancer to return the funds out of pocket to save their on-chain reputation and flip the contract back into a refundable state for the investors.

---

## 🐛 Known Issues & Troubleshooting

### Hiring Transaction Errors ("UserOp Failed" / Gas Estimation Issues)
**The Problem:** During the client hiring flow, transactions occasionally failed with a generic "UserOp failed" error. This was caused by Account Abstraction (ERC-4337) bundlers under-estimating the gas required for complex transactions, specifically the `CREATE` opcode needed to deploy a new Escrow smart contract when a client hires a freelancer via sponsored transactions.

**The Solution:** 
We specifically bypassed the gas sponsorship (paymaster) exclusively for the `handleHire` function. By obtaining a non-sponsored execution account from the client's underlying personal wallet, we are able to provide explicit manual gas limits (e.g., `4,000,000` gas for Escrow deployment) instead of relying on bundler estimates. This ensures the transaction completes reliably without being prematurely aborted by stale gas estimations.

---

## ⚖️ On-Chain Dispute System

To ensure complete transparency and decentralization, WORQS features a fully on-chain dispute resolution engine.

### How it Works:
1. **Raising a Dispute:** 
   - A freelancer can raise a dispute at any time if they feel they are being treated unfairly.
   - A client can only raise a dispute *after* the freelancer has delivered at least one version of the work.
   - When raising a dispute, the user provides a reason. This reason is uploaded as a JSON metadata file to **IPFS** via Pinata, ensuring immutable and decentralized storage. The IPFS URI is then logged directly into the `JobEscrow` smart contract.

2. **On-Chain Tracking (`EscrowFactory`):**
   - The `JobEscrow` contract immediately alerts the `EscrowFactory`.
   - The factory maintains an enumerable, global registry of all active disputes across the platform. This completely removes the reliance on off-chain databases (like Supabase) for tracking dispute states.

3. **Admin Resolution Matrix:**
   - Platform administrators monitor the active disputes by reading directly from the `EscrowFactory` contract state.
   - They review the IPFS dispute reason, the freelancer's submitted work, and the original job requirements.
   - The admin executes a resolution transaction with highly granular payout controls:
     - **Full Approval:** 100% of the funds are released to the Freelancer.
     - **Full Refund:** 100% of the funds are returned to the Client.
     - **Custom Split (Arbitration):** The platform can execute a custom percentage split (e.g., 70% to the Freelancer for partial work, 30% refunded to the Client) using the `payoutBps` functionality in the escrow contract.

4. **Continuous Delivery:**
   - Even while a dispute is active, the freelancer retains the ability to submit new versions of their work to the blockchain. This allows them to provide additional evidence or fixes while the admin reviews the case, without prematurely resetting the escrow's final status.

---

## 🛠️ Workarounds & Architectural Notes

### 1. Job Categorization After Dispute Resolution

**Limitation:** The `JobBoard` contract's `status` field for a job remains `Hired` after an escrow is resolved via a dispute. The `JobEscrow` contract finalizes funds and sets `terminal = true` internally, but does not call `markAsCompleted` or any status-update hook back to `JobBoard`.

**Workaround:** The frontend job list pages (`app/freelancer/page.tsx`) perform a secondary check for any `Hired` job with a non-zero escrow address:
1. Read `escrow.terminal` — if `true`, the job is finalized.
2. If the escrow was disputed, heuristically determine outcome: if `escrow.delivered == true` (freelancer delivered work), the job is mapped to **Completed**; otherwise, it is mapped to **Cancelled** (full refund).
3. If the escrow was NOT disputed but is terminal: if `cancelRequestedBy != address(0)` before terminal, it was a mutual cancellation → **Cancelled**; otherwise → **Completed**.

This is a **read-only frontend enrichment** — no contract changes required.

### 2. Dispute Raiser Identity

**Limitation:** The `JobEscrow.raiseDispute()` function emits a `DisputeRaised(jobKey, msg.sender, reasonURI)` event, but due to the cost of event log indexing in real-time frontend reads, the exact raiser identity is not stored as an on-chain state variable.

**Workaround:** The `DisputeInfoPanel` component displays both the `client` and `freelancer` addresses (read from immutable escrow state) rather than trying to infer who specifically raised the dispute. The dispute reason (IPFS-stored JSON) is still fully visible. If the exact raiser is required in future, an additional `address public disputeRaisedBy` field could be added to `JobEscrow`, or the `DisputeRaised` event can be queried via a backend indexer.

### 3. Freelancer Stats Counters

The `FreelancerProfile` contract tracks `disputedJobs` and `cancelledJobs` as separate counters, incremented automatically by `JobEscrow` when the respective status transitions occur. These are displayed on the freelancer dashboard under "Disputed Jobs" and "Cancelled Jobs" stats. Because the profile tracks these atomically on-chain, they are reliable for recommendation algorithm input without any off-chain database dependency.
