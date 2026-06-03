# WORQS - Complete Feature Documentation

**Version:** 0.1.0  
**Project:** WORQS - Web3 Freelancing & Dual-Funding DApp  
**Tagline:** Turn Work into value, build Reputation on-chain, deliver QuickPay instantly, distribute Ownership through Shares

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Core Architecture](#core-architecture)
3. [Key Features](#key-features)
4. [User Roles & Capabilities](#user-roles--capabilities)
5. [Technical Stack](#technical-stack)
6. [Component Structure](#component-structure)
7. [Smart Contracts](#smart-contracts)
8. [User Workflows](#user-workflows)
9. [Security Features](#security-features)
10. [API & Integrations](#api--integrations)
11. [Troubleshooting & Known Issues](#troubleshooting--known-issues)

---

## 🎯 Project Overview

### Mission
WORQS revolutionizes the gig economy by merging freelancing with decentralized finance (DeFi). It enables:
- **Secure freelance-to-client payments** via smart contract escrows
- **Dual investment mechanisms** for passive income generation
- **On-chain reputation building** with verifiable credentials
- **Decentralized dispute resolution** for fair conflict handling

### Core Value Proposition
- **For Freelancers:** Earn verifiable on-chain credentials, access global opportunities, tokenize revenue streams
- **For Clients:** Hire vetted talent, pay securely, tokenize equity for fundraising
- **For Investors:** Support vetted freelancers/startups, earn transparent returns, track portfolio on-chain

---

## 🏗️ Core Architecture

### Dual-Funding Model

The platform offers **two distinct investment mechanisms** to accommodate different risk appetites:

#### 1. **Company Shares (Long-Term Equity)**
- **What:** Freelancers tokenize their entire business into ERC-20 "Company Shares"
- **How Investors Profit:** Earn forever-dividends whenever the freelancer completes jobs and deposits revenue to the Company Vault
- **Security:** Smart Revenue Rules enforce mandatory minimum percentage distributions (cannot drain vault)
- **Use Case:** Proven freelancers transitioning to agencies

**Example Scenario:**
- Alex tokenizes his agency with 1M tokens
- Dave buys 10% (100K tokens) for $5,000
- After 6 months, Alex deposits $50K from completed jobs → Dave claims 10% ($5K) automatically
- This repeats as long as Dave holds tokens

---

#### 2. **Job-Specific Syndication (Short-Term High Yield)**
- **What:** Create a Fundraise contract for a single large project
- **How Investors Profit:** Receive principal + percentage of net profit when the job completes
- **Security:** Client's payment is locked in Escrow (guaranteed to exist)
- **Use Case:** Freelancers needing upfront capital for a specific project

**Example Scenario:**
- Alex lands a $10K SaaS project but needs $2K upfront for a UI Designer
- Creates a Fundraise asking for $2K at 50% profit share
- Dave invests $2K
- When client approves: Contract receives $10K → Deducts $2K expenses → Dave gets $2K (principal) + $4K (50% of $8K profit) = **$6K total**

---

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                    USER INTERFACE (Next.js)             │
├─────────────────────────────────────────────────────────┤
│  ├─ Freelancer Portal    (Find work, manage escrows)   │
│  ├─ Client Portal        (Post jobs, approve work)      │
│  ├─ Investor Portal      (Browse investments, claims)  │
│  ├─ Admin Dashboard      (Dispute resolution)           │
│  └─ Landing Page         (Onboarding, education)        │
├─────────────────────────────────────────────────────────┤
│               SMART CONTRACTS (On-Chain)                │
├─────────────────────────────────────────────────────────┤
│  ├─ JobBoard Contract          (Job listing registry)   │
│  ├─ JobEscrow Factory          (Deploy escrow contracts)│
│  ├─ JobEscrow Instance         (Payment lock/release)   │
│  ├─ JobFundraise               (Short-term fundraising) │
│  ├─ CompanyRegistry            (ERC-20 share creation)  │
│  ├─ CompanyVault               (Revenue holding)        │
│  ├─ DividendDistributor        (O(1) dividend payouts)  │
│  └─ FreelancerProfile          (On-chain credentials)   │
├─────────────────────────────────────────────────────────┤
│           EXTERNAL SERVICES & INFRASTRUCTURE            │
├─────────────────────────────────────────────────────────┤
│  ├─ IPFS (Pinata)              (Immutable dispute data) │
│  ├─ Supabase                   (Off-chain data cache)   │
│  ├─ Thirdweb SDK               (Blockchain abstraction) │
│  ├─ Ethers.js / Viem           (Web3 interactions)      │
│  ├─ OpenAI / AI SDK            (Chatbot assistance)     │
│  └─ Account Abstraction (AA)   (Sponsored transactions) │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Features

### 1. **Job Board & Marketplace**
- **Post Jobs:** Clients create job listings with title, description, budget, and requirements
- **Browse Jobs:** Freelancers filter jobs by category, budget, and complexity
- **Quick Apply:** Freelancers submit applications directly to interested projects
- **Status Tracking:** Jobs progress through states: Open → Hired → Completed/Cancelled

**Implementation:**
- `JobBoard` contract maintains global job registry
- Frontend: `components/client` and `components/freelancer` handle UI
- Database: Supabase caches job data for search optimization

---

### 2. **Escrow-Protected Payments**
- **Two-Party Lock:** Client deposits funds → Freelancer works → Client approves → Funds released
- **Atomic Guarantees:** No fund release without explicit client approval
- **Dispute Resolution:** On-chain dispute system with admin arbitration
- **Cancellation Safety:** Freelancer can reimburse investors if client cancels mid-project

**Smart Contract:** `JobEscrow`
- Holds USDT in native token vault
- Tracks delivery status (submitted, approved, disputed)
- Supports partial payouts via `payoutBps` for dispute arbitration

**Key Functions:**
```solidity
function submitDelivery(bytes calldata deliveryURI) // Freelancer submits work
function approveDelivery() // Client approves (triggers payout)
function raiseDispute(bytes calldata reasonURI) // Raise dispute (on-chain)
function cancelJob() // Client-initiated cancellation with escrow return
```

---

### 3. **Freelancer On-Chain Profile**
- **Reputation Registry:** Track completed jobs, earnings, disputes, and cancellations
- **Verifiable Credentials:** All stats are cryptographically proven on-chain
- **Portfolio Display:** Show job history and client reviews
- **Skill Badges:** Display verified specializations (Web3 Dev, Smart Contract Auditor, UI Designer, etc.)

**Contract:** `FreelancerProfile`
- Counters: `completedJobs`, `totalEarnings`, `disputedJobs`, `cancelledJobs`
- Immutable on-chain record prevents falsification
- Used for recommendation algorithms and investor decision-making

**UI:** `app/freelancer/Profile` displays profile stats and achievements

---

### 4. **Company Shares (ERC-20 Tokenization)**
- **Create Company:** Freelancers mint ERC-20 share tokens representing equity
- **Sell Shares:** List tokens for sale to investors via marketplace
- **Dividend Tracking:** Automatically accumulate revenue when freelancer deposits earnings
- **Claim Dividends:** Shareholders click to claim their percentage of Company Vault holdings

**Contracts:**
- `CompanyRegistry`: Creates and manages company ERC-20 tokens
- `CompanyVault`: Holds revenue, tracks shareholder allocation
- `DividendDistributor`: O(1) gas-efficient dividend distribution using magnified accumulator pattern

**Mathematical Guarantee:**
Even with millions of shareholders, dividend claims execute in constant gas (no loops).

**UI:** `app/investor/companies` - Browse, buy, and manage company shares

---

### 5. **Job Fundraising (Short-Term Syndication)**
- **Create Fundraise:** Freelancer specifies target amount and profit-share percentage
- **Investor Funding:** Multiple investors pool capital for single job
- **Automatic Calculation:** Contract calculates net profit and distributes shares
- **Escrow-Backed:** Client's approved payment triggers automated distribution

**Process:**
1. Freelancer creates Fundraise contract for $X with Y% profit share
2. Multiple investors fund the Fundraise
3. When Client approves Escrow payment:
   - Escrow directs payment to Fundraise contract
   - Fundraise deducts target amount (principal repayment)
   - Remaining profit splits according to percentage
   - Investors & Freelancer claim their portions

**UI:** `app/freelancer/jobs` - Create fundraise for specific job

---

### 6. **AI-Powered Chatbot**
- **Smart Assistant:** Help freelancers find projects, generate proposals, explain features
- **Real-Time Chat:** Available in global chat interface on all pages
- **Investment Analysis:** Help investors understand opportunities and risks
- **Project Recommendations:** Suggest suitable jobs based on freelancer profile

**Stack:** OpenAI API + Vercel AI SDK + React hooks
**Components:** `components/chat/GlobalChatBot`, `components/chat/ChatContext`
**Features:**
- Streaming responses for real-time UX
- Context-aware suggestions using freelancer/investor data
- Proposal generation from job descriptions

---

### 7. **Dispute Resolution System**
- **Immutable Record:** Disputes stored on-chain with IPFS-hosted reason metadata
- **Multi-Party Tracking:** Both freelancer and client can initiate disputes
- **Admin Resolution:** Platform admins review evidence and execute arbitrated payouts
- **Flexible Payouts:** Support full approval, full refund, or custom split (e.g., 70/30)

**Flow:**
1. Freelancer or Client raises dispute
2. Dispute reason uploaded to IPFS via Pinata
3. IPFS URI logged to `JobEscrow` contract
4. `EscrowFactory` tracks active disputes globally
5. Admin reviews IPFS data, client feedback, and freelancer work
6. Admin executes payout with `payoutBps` (basis points) for precise splits

**Workaround Note:** `JobBoard` status remains "Hired" after dispute resolution. Frontend reads `escrow.terminal` flag to determine final job status.

---

### 8. **Admin Dashboard**
- **Dispute Monitoring:** Real-time view of all active disputes
- **Admin Actions:** Approve, reject, or arbitrate with custom splits
- **User Management:** Manage freelancer verification status and platform roles
- **Analytics:** Monitor platform metrics (GMV, active jobs, dispute rates)

**Route:** `app/admin`
**Key Functions:**
- Fetch active disputes from `EscrowFactory`
- Display IPFS dispute reasons
- Execute resolution transactions

---

### 9. **Multi-Chain Support**
- **Blockchain:** Built on Ethereum/Polygon compatible chains
- **Token:** USDT stablecoin for all transactions
- **Account Abstraction:** Sponsored transactions for seamless UX (with gas limit fallbacks)
- **Thirdweb SDK:** Abstract away chain complexity

---

### 10. **Authentication & Wallet Integration**
- **Wallet Connect:** MetaMask, Coinbase Wallet, WalletConnect compatibility
- **Session Management:** Persistent login with localStorage caching
- **Sponsored Transactions:** Account Abstraction for gas-free freelancer operations
- **Fallback Handling:** Manual gas limits for complex transactions (e.g., $4M for Escrow deployment)

**Components:** `components/auth/login-modal`
**Thirdweb Integration:** `ThirdwebProvider` wraps entire app

---

## 👥 User Roles & Capabilities

### 1. **Freelancer**

| Capability | Description |
|-----------|-------------|
| **Browse Jobs** | Search and filter available job listings |
| **Submit Proposals** | Apply to jobs with pitch and terms |
| **Manage Escrow** | Submit work, track payment status, handle disputes |
| **Build Profile** | Display credentials, completed jobs, earnings history |
| **Create Fundraise** | Launch investor funding for specific projects |
| **Tokenize Business** | Mint company shares and set dividend rules |
| **Claim Payments** | Withdraw approved payments or dividend portions |
| **Access AI Help** | Get proposal suggestions and job recommendations |

**Dashboard:** `app/freelancer`
- `FindWork`: Browse available jobs
- `Profile`: View and edit profile
- `jobs`: Manage active and completed work
- `proposals`: Track submitted applications
- `wallet`: View transaction history

---

### 2. **Client**

| Capability | Description |
|-----------|-------------|
| **Post Jobs** | Create detailed job listings with budget |
| **Find Freelancers** | Browse freelancer profiles and credentials |
| **Hire & Manage** | Accept proposals and fund escrow contracts |
| **Approve Work** | Review deliverables and trigger payments |
| **Handle Disputes** | Raise disputes if work doesn't meet requirements |
| **Create Company** | Tokenize startup and sell equity to investors |
| **Track Investment** | Monitor investor portfolio and dividend distributions |

**Dashboard:** `app/client`
- `jobs`: Post and manage active jobs
- `find-freelancer`: Search freelancer marketplace
- `offers`: Track incoming proposals
- `profile`: Manage professional profile
- `wallet`: Financial transactions

---

### 3. **Investor**

| Capability | Description |
|-----------|-------------|
| **Browse Companies** | Explore tokenized freelancer/startup equity |
| **Fund Fundraises** | Invest in specific project syndications |
| **Monitor Portfolio** | Track investment performance on-chain |
| **Claim Dividends** | Withdraw dividend shares and principal returns |
| **Analyze Opportunities** | Review freelancer credentials, job history, risk metrics |
| **Get Recommendations** | AI-powered investment suggestions |

**Dashboard:** `app/investor`
- `explore`: Browse investment opportunities
- `companies`: Manage company share portfolio
- `portfolio`: View investment performance
- `profile`: Manage investor profile
- `wallet`: View dividend payments and transactions

---

### 4. **Founder / Platform Admin**

| Capability | Description |
|-----------|-------------|
| **Resolve Disputes** | Arbitrate conflicts with custom payouts |
| **Monitor Metrics** | Track platform growth and health metrics |
| **Manage Verification** | Verify freelancer credentials and expertise |
| **System Configuration** | Adjust platform parameters and fees |

**Dashboard:** `app/admin`

---

## 🛠️ Technical Stack

### Frontend
- **Framework:** Next.js 16.1.0 (React 19.2.0)
- **Language:** TypeScript 5.x
- **Styling:** Tailwind CSS 4.1.9 + PostCSS
- **UI Components:** Radix UI (30+ components) + shadcn/ui patterns
- **Forms:** React Hook Form + Zod validation
- **State Management:** React Context API
- **Animations:** Framer Motion, Embla Carousel
- **Web3:** Thirdweb SDK, Ethers.js 5.8.0, Viem 2.38.5
- **Charts:** Recharts 2.15.4
- **Toast Notifications:** Sonner 1.7.4

### Backend & Blockchain
- **Contracts:** Solidity smart contracts on Ethereum-compatible chains
- **Web3 Libraries:** Thirdweb SDK, Ethers.js, Viem
- **Account Abstraction:** ERC-4337 for sponsored transactions
- **IPFS:** Pinata SDK for decentralized storage
- **Database:** Supabase (PostgreSQL) for caching and analytics

### AI & Integrations
- **LLM:** OpenAI (GPT models via Vercel AI SDK)
- **Streaming:** Vercel AI SDK for real-time responses
- **Analytics:** Vercel Analytics

### Build & Deployment
- **Package Manager:** npm/pnpm
- **Build Tool:** Next.js built-in
- **Deployment:** Vercel
- **Type Checking:** TypeScript strict mode

---

## 📦 Component Structure

### Core Directories

```
components/
├── auth/
│   └── login-modal.tsx                 # Web3 wallet login
├── ui/
│   ├── button.tsx                      # Base button component
│   ├── card.tsx                        # Reusable card layout
│   ├── dialog.tsx                      # Modal dialogs
│   ├── form.tsx                        # Form wrapper
│   ├── input.tsx                       # Input field
│   ├── label.tsx                       # Form labels
│   ├── logo.tsx                        # Platform logo
│   └── [20+ other UI components]       # Radix-based components
├── dashboard/
│   └── dashboard.tsx                   # Main dashboard router
├── freelancer/
│   ├── JobCard.tsx                     # Display job listing
│   ├── ProposalForm.tsx                # Submit job application
│   ├── EscrowTracker.tsx               # Track payment status
│   ├── ProfileEditor.tsx               # Edit freelancer profile
│   └── FundraiseForm.tsx               # Create job fundraise
├── client/
│   ├── JobPostForm.tsx                 # Create job listing
│   ├── HireFlow.tsx                    # Hiring workflow
│   ├── ApprovalPanel.tsx               # Approve deliverables
│   └── FreelancerBrowser.tsx           # Find freelancers
├── investor/
│   ├── CompanyCard.tsx                 # Display company share
│   ├── FundraiseOpportunity.tsx        # Investment opportunity
│   ├── PortfolioTracker.tsx            # Investment performance
│   └── DividendClaim.tsx               # Claim dividend payments
├── disputes/
│   ├── DisputeRaiseForm.tsx            # File dispute
│   ├── DisputeInfoPanel.tsx            # View dispute details
│   └── AdminResolution.tsx             # Admin arbitration UI
├── chat/
│   ├── GlobalChatBot.tsx               # Floating chat widget
│   ├── ChatContext.tsx                 # Chat state management
│   └── ChatMessage.tsx                 # Message display
├── landing/
│   ├── hero-section.tsx                # Homepage hero
│   ├── features-section.tsx            # Feature highlights
│   └── footer-section.tsx              # Footer
├── theme-provider.tsx                  # Dark/light theme
└── theme-toggle.tsx                    # Theme switcher

app/
├── layout.tsx                          # Root layout (providers)
├── page.tsx                            # Landing page
├── freelancer/
│   ├── layout.tsx
│   ├── page.tsx                        # Freelancer dashboard
│   ├── FindWork/
│   ├── Profile/
│   ├── jobs/
│   ├── proposals/
│   └── wallet/
├── client/
│   ├── layout.tsx
│   ├── page.tsx                        # Client dashboard
│   ├── jobs/
│   ├── find-freelancer/
│   ├── offers/
│   ├── profile/
│   └── wallet/
├── investor/
│   ├── layout.tsx
│   ├── page.tsx                        # Investor dashboard
│   ├── explore/
│   ├── companies/
│   ├── portfolio/
│   ├── profile/
│   └── wallet/
├── admin/
│   ├── layout.tsx
│   └── page.tsx                        # Admin dashboard
└── api/
    └── [dynamic routes]                # Backend API routes

hooks/
├── use-mobile.ts                       # Responsive design hook
├── use-toast.ts                        # Toast notifications
└── useIPFSUpload.ts                    # IPFS upload handling

utils/
├── [helper functions]                  # Utility functions
├── contracts/                          # Contract ABIs and addresses
└── constants/                          # Configuration constants

lib/
└── [shared logic]                      # Shared utilities

styles/
└── [CSS modules]                       # Styling
```

---

## 📝 Smart Contracts

### Core Contract Suite

#### 1. **JobBoard**
**Purpose:** Global registry of all job listings
**Key State:**
- `jobs[]`: Array of job listings
- `jobsByFreelancer[]`: Mapping of freelancer addresses to jobs
- `jobsByClient[]`: Mapping of client addresses to jobs

**Key Functions:**
- `postJob()`: Client creates job listing
- `applyForJob()`: Freelancer applies
- `acceptApplication()`: Client accepts and creates escrow
- `markAsCompleted()`: Update job status
- `getJobsByClient()`: Query client's jobs
- `getJobsByFreelancer()`: Query freelancer's opportunities

---

#### 2. **JobEscrow**
**Purpose:** Secure payment holding and release with dispute handling
**Key State:**
- `client`: Job creator address
- `freelancer`: Assigned freelancer address
- `amount`: USDT payment amount
- `delivered`: Boolean (freelancer submitted work)
- `approved`: Boolean (client approved payment)
- `terminal`: Boolean (escrow finalized, no more changes)
- `deliveryURI`: IPFS link to submitted work
- `disputed`: Boolean (dispute raised)

**Key Functions:**
```solidity
// Freelancer operations
function submitDelivery(bytes calldata deliveryURI)
function raiseDispute(bytes calldata reasonURI)

// Client operations
function approveDelivery()
function cancelJob()
function raiseDispute(bytes calldata reasonURI)

// Admin operations
function resolveDispute(uint256 payoutBps)
  // payoutBps: basis points for freelancer (10000 = 100%)
  // e.g., 5000 = 50/50 split

// Investor operations (if fundraised)
function reimburseInvestors()
  // If client cancels mid-project, freelancer reimbursed investors
  // Returns escrow to refundable state
```

---

#### 3. **JobFundraise**
**Purpose:** Short-term syndication for job-specific funding
**Key State:**
- `targetAmount`: How much to raise
- `profitSharePercentage`: Percentage of net profit to distribute
- `escrowAddress`: Linked JobEscrow contract
- `investors[]`: Array of investor addresses and amounts
- `completed`: Boolean (escrow approved, payouts processed)

**Key Functions:**
```solidity
function fundRaise(uint256 amount)
  // Investor contributes to fundraise

function claimInvestorPayout()
  // Investor claims principal + profit share
  // Automatically calculated and sent

function claimFreelancerPayout()
  // Freelancer claims remaining funds after investor payouts
```

**Payout Logic:**
```
Net Profit = TotalEscrowAmount - TargetAmount
InvestorShare = (NetProfit * ProfitSharePercentage) / 100
InvestorPayout = InvestedAmount + InvestorShare
```

---

#### 4. **CompanyRegistry**
**Purpose:** Create and manage ERC-20 company shares
**Key Functions:**
```solidity
function createCompany(
  string name,
  uint256 totalSupply,
  uint256 mandatoryDistributionPercentage
)
  // Mints ERC-20 shares for freelancer's company
  // Sets minimum payout percentage to shareholders

function listSharesForSale(uint256 amount, uint256 pricePerShare)
  // Make shares available to investors

function buyShares(address company, uint256 amount)
  // Investor purchases company shares
```

---

#### 5. **CompanyVault**
**Purpose:** Hold and distribute company revenue
**Key State:**
- `company`: Company address
- `totalRevenue`: Cumulative revenue deposited
- `lastDividendAccumulator`: For O(1) dividend calculation
- `shareholderShares[]`: Token holder balances

**Key Functions:**
```solidity
function depositRevenue(uint256 amount)
  // Freelancer deposits job revenue into vault

function claimDividend()
  // Shareholder claims their portion (O(1) gas)
```

---

#### 6. **DividendDistributor**
**Purpose:** Magnified accumulator pattern for O(1) dividend distribution
**Algorithm:**
- Maintains `accumulatedDividendPerShare` counter
- When revenue deposited: increment by (amount / total_shares)
- When claiming: calculate share * accumulator = total dividends
- No loops → No gas limit DOS vulnerability
- Supports millions of shareholders without degradation

---

#### 7. **EscrowFactory**
**Purpose:** Deploy, track, and manage all JobEscrow instances
**Key State:**
- `escrows[]`: Array of all deployed escrows
- `activeDisputes[]`: Array of all active disputes
- `escrowsByJob()`: Map job to escrow instance

**Key Functions:**
```solidity
function createEscrow(
  address client,
  address freelancer,
  uint256 amount,
  bytes jobKey
)
  // Deploy new JobEscrow instance

function getAllDisputes()
  // Admin queries all active disputes

function getDisputeDetails(address escrow)
  // Get full dispute info including IPFS URI
```

---

#### 8. **FreelancerProfile**
**Purpose:** On-chain reputation and credential tracking
**Key State:**
- `freelancer`: Freelancer address
- `completedJobs`: Counter
- `totalEarnings`: USDT amount
- `averageRating`: 0-5 star rating
- `disputedJobs`: Counter
- `cancelledJobs`: Counter
- `skills[]`: Skill tags (e.g., "Solidity Developer")

**Key Functions:**
```solidity
function updateStats(
  uint256 jobAmount,
  bool completed,
  bool disputed
)
  // Called by JobEscrow to update on completion

function addSkill(string memory skill)
  // Freelancer adds verified skill

function getProfile()
  // View freelancer's full public profile
```

---

## 📊 User Workflows

### Workflow 1: Core Freelancing (No Investors)

**Actors:** Sarah (Client), Alex (Freelancer)

```
1. Sarah posts job: "Audit Smart Contract" for $2,000 USDT
   └─ JobBoard stores job, status = "Open"

2. Alex discovers job, clicks "Apply"
   └─ JobBoard records application

3. Sarah reviews applications, accepts Alex
   └─ System creates new JobEscrow instance
   └─ Sarah deposits $2,000 USDT into escrow
   └─ Job status = "Hired"

4. Alex submits work (IPFS link)
   └─ Calls jobEscrow.submitDelivery()
   └─ escrow.delivered = true

5. Sarah reviews work, clicks "Approve"
   └─ Calls jobEscrow.approveDelivery()
   └─ Escrow releases $2,000 to Alex's wallet
   └─ JobEscrow.terminal = true

6. FreelancerProfile updates
   └─ completedJobs += 1
   └─ totalEarnings += $2,000
```

---

### Workflow 2: Job Fundraising (With Investor)

**Actors:** Alex (Freelancer), Dave (Investor), Sarah (Client)

```
1. Sarah posts $10,000 SaaS job
2. Alex applies, Sarah accepts, $10,000 locked in escrow

3. Alex needs $2,000 for designer, clicks "Fundraise"
   └─ Deploys JobFundraise contract
   └─ targetAmount = $2,000
   └─ profitSharePercentage = 50%
   └─ Linked to escrow contract

4. Dave discovers fundraise, invests $2,000
   └─ Sends USDT to JobFundraise
   └─ investors[] records Dave's stake

5. Alex withdraws $2,000, hires designer

6. Sarah approves escrow
   └─ $10,000 → JobFundraise contract (not to Alex directly)
   └─ Fundraise calculates: NetProfit = $10,000 - $2,000 = $8,000
   └─ Dave's share = $2,000 (principal) + $4,000 (50% of $8,000) = $6,000
   └─ Alex's share = $4,000

7. Both claim payments
   └─ Dave: $6,000
   └─ Alex: $4,000
```

---

### Workflow 3: Company Shares (Long-Term Equity)

**Actors:** Alex (Freelancer), Dave (Investor)

```
1. Alex (50 completed jobs, 5-star rating) creates company
   └─ CompanyRegistry.createCompany()
   └─ Mints 1,000,000 ERC-20 tokens
   └─ Sets mandatory 30% distribution to shareholders

2. Alex lists 20% for sale (200,000 tokens)
   └─ Price: $0.025/token = $5,000 for 200K tokens

3. Dave buys 100,000 tokens (10% equity)
   └─ Sends $2,500 USDT
   └─ Dave now holds 10% of company

4. Six months pass, Alex completes $50,000 job
   └─ Deposits $50,000 into CompanyVault
   └─ Mandatory 30% → $15,000 available for shareholders

5. Dave claims dividend
   └─ Calls CompanyVault.claimDividend()
   └─ O(1) calculation: 10% of $15,000 = $1,500
   └─ Receives $1,500 instantly

6. Process repeats
   └─ Alex continues earning, vault accumulates
   └─ Dave continues earning passive dividends
   └─ As long as Dave holds tokens and Alex deposits revenue
```

---

### Workflow 4: Dispute Resolution

**Actors:** Sarah (Client), Alex (Freelancer), Admin

```
1. Sarah approves escrow but feels work is incomplete
   └─ Calls jobEscrow.raiseDispute()
   └─ Uploads dispute reason to IPFS via Pinata
   └─ IPFS CID logged to escrow contract

2. EscrowFactory tracks new active dispute
   └─ Admin dashboard shows pending dispute

3. Admin reviews:
   └─ Reads IPFS reason metadata
   └─ Examines work submitted (IPFS link)
   └─ Compares with job requirements

4. Admin decides: 70% freelancer, 30% refund
   └─ Executes: jobEscrow.resolveDispute(7000)
   └─ 7000 basis points = 70%

5. Escrow calculates:
   └─ FreelancerPayout = $2,000 * 0.70 = $1,400
   └─ ClientRefund = $2,000 * 0.30 = $600

6. Payments released
   └─ Alex receives $1,400
   └─ Sarah receives $600
   └─ escrow.terminal = true
   └─ FreelancerProfile.disputedJobs += 1
```

---

## 🔒 Security Features

### 1. **Escrow-Backed Syndication**
- **Guarantee:** Client's $X is locked in smart contract escrow
- **Benefit:** Investors know funds exist when job completes
- **Mechanism:** JobFundraise cannot claim escrow funds until explicitly transferred by escrow contract
- **Protection:** Freelancer cannot drain without triggering fund distribution

---

### 2. **O(1) Dividend Distribution**
- **Problem:** Million+ shareholders would cause gas limit DOS if iterating through array
- **Solution:** Magnified Dividend Accumulator pattern
- **Mechanism:**
  - Store single `accumulatedDividendPerShare` value (updated atomically)
  - Claim: shareholder_balance × accumulator = total_dividend
  - No loops, constant gas regardless of shareholder count
- **Verification:** Independent audit confirms O(1) performance

---

### 3. **Smart Revenue Rules**
- **Mandate:** Freelancer must distribute minimum percentage to shareholders
- **Enforcement:** CompanyVault enforces via `mandatoryDistributionPercentage`
- **Prevention:** Freelancer cannot withdraw 100% of revenue while shareholders have claims
- **Verification:** On-chain state proves compliance

---

### 4. **Cancelled Job Protection**
- **Scenario:** Client cancels after freelancer withdrew funds for investor-backed project
- **Solution:** `reimburseInvestors()` function
- **Mechanism:**
  1. Freelancer reimburses investors out-of-pocket
  2. Escrow transitions to refundable state
  3. Client can then claim full refund
  4. Freelancer protects on-chain reputation
- **Guarantee:** Ensures investors are made whole even in worst case

---

### 5. **Immutable Dispute Records**
- **Storage:** Dispute reasons stored on IPFS (immutable, decentralized)
- **Verification:** IPFS CID logged to escrow contract
- **Audit Trail:** All disputes publicly queryable via chain state
- **Prevention:** Cannot modify or delete dispute evidence

---

### 6. **Account Abstraction (Gas Sponsorship)**
- **Tech:** ERC-4337 sponsored transactions
- **Benefit:** Freelancers experience gas-free operations
- **Fallback:** Manual gas limits for complex transactions (e.g., $4M for escrow deployment)
- **Reliability:** Bypasses bundler gas estimation issues

---

### 7. **Role-Based Access Control**
- **Client:** Can only approve/cancel own escrows
- **Freelancer:** Can only submit work on assigned escrows
- **Investor:** Can only claim from invested contracts
- **Admin:** Only address can execute dispute resolutions
- **Mechanism:** `require(msg.sender == expectedRole)` checks on all state-changing functions

---

### 8. **Type Safety & Validation**
- **TypeScript:** Full type coverage prevents runtime errors
- **Zod Schemas:** Runtime validation of form inputs
- **Smart Contract Checks:** All functions validate preconditions
- **Front-End Validation:** Form validation before transaction submission

---

## 🔌 API & Integrations

### External APIs

#### 1. **Thirdweb SDK**
- **Purpose:** Web3 wallet connection, contract interaction abstraction
- **Usage:** `ThirdwebProvider` wraps app, provides hooks like `useContract()`, `useContractRead()`, `useContractWrite()`
- **Chains:** Supports Ethereum, Polygon, Optimism, Arbitrum, etc.

#### 2. **OpenAI / Vercel AI SDK**
- **Purpose:** AI chatbot for user assistance
- **Models:** GPT-3.5-turbo or GPT-4
- **Streaming:** Real-time response streaming for smooth UX
- **Components:** `GlobalChatBot`, `ChatContext`

#### 3. **Pinata IPFS**
- **Purpose:** Store dispute reasons, job deliverables, profile metadata
- **Integration:** `useIPFSUpload()` hook handles file uploads
- **Returns:** IPFS CID for on-chain logging
- **Cost:** Pay-as-you-go API

#### 4. **Supabase (PostgreSQL)**
- **Purpose:** Off-chain data caching and analytics
- **Tables:** Disputes, job listings, user profiles, transaction logs
- **RLS:** Row-level security for data privacy
- **Use Cases:** Fast search, analytics, admin dashboards

#### 5. **Ethers.js / Viem**
- **Purpose:** Low-level blockchain interactions
- **Usage:** Direct contract calls, transaction signing, event listening
- **Fallback:** Used when Thirdweb SDK insufficient

#### 6. **Vercel Analytics**
- **Purpose:** Track user behavior and platform health
- **Integration:** `@vercel/analytics` package
- **Metrics:** Page views, conversions, error rates

---

### Internal APIs

#### Job Board API (`app/api/jobs`)
```typescript
GET /api/jobs
  // Query all jobs with filtering
  // Query params: category, budget_min, budget_max, status

GET /api/jobs/[jobId]
  // Get job details

POST /api/jobs
  // Create new job (client auth required)

PUT /api/jobs/[jobId]
  // Update job status
```

#### Escrow API (`app/api/escrows`)
```typescript
GET /api/escrows/[escrowAddress]
  // Get escrow state (amounts, status, disputes)

POST /api/escrows/[escrowAddress]/submit-delivery
  // Submit work for escrow

POST /api/escrows/[escrowAddress]/approve
  // Approve delivery and trigger payout
```

#### User Profile API (`app/api/profile`)
```typescript
GET /api/profile/[address]
  // Get freelancer profile (on-chain stats)

PUT /api/profile/[address]
  // Update profile metadata
```

---

## ⚠️ Troubleshooting & Known Issues

### Issue 1: Hiring Transaction Errors ("UserOp Failed")

**Symptoms:**
- Transaction fails during client hiring
- Error: "UserOp failed" or "Gas estimation failed"
- Occurs when creating JobEscrow via Account Abstraction

**Root Cause:**
- ERC-4337 bundlers under-estimate gas for `CREATE` opcode (new contract deployment)
- Bundler's gas estimate < actual gas needed → transaction aborted prematurely

**Solution (Implemented):**
1. For `handleHire()` function specifically, bypass gas sponsorship
2. Get non-sponsored account from client's personal wallet
3. Provide explicit high gas limit: `gas: 4_000_000`
4. Transaction executes reliably without bundler interference

**Status:** ✅ **RESOLVED** - Shipping in current version

---

### Issue 2: Job Status Not Updated After Dispute Resolution

**Symptoms:**
- Job remains "Hired" in JobBoard after dispute resolved
- Frontend shows incorrect job status

**Root Cause:**
- JobEscrow contract sets `terminal = true` internally
- But does NOT call back to JobBoard to update status
- Architectural decision: contracts kept separate to minimize coupling

**Workaround (Implemented in Frontend):**
When rendering job lists, frontend performs secondary check:
```typescript
if (job.status === "Hired" && escrow.address) {
  const escrowState = await readContract(escrow, 'terminal');
  if (escrowState.terminal) {
    // Determine if completed or cancelled based on escrow state
    const actualStatus = escrow.delivered ? "Completed" : "Cancelled";
  }
}
```

**Status:** ✅ **WORKAROUND IN PLACE** - Works correctly from user perspective

---

### Issue 3: Dispute Raiser Identity Not Stored On-Chain

**Symptoms:**
- Admin cannot determine who raised dispute (client or freelancer)
- Dispute reason visible but raiser unknown

**Root Cause:**
- Storing raiser address costs extra gas (~5K)
- Emit event with raiser is cheaper: `DisputeRaised(jobKey, msg.sender, reasonURI)`
- But frontend cannot efficiently query past events in real-time

**Workaround (Implemented):**
- Admin panel displays both client and freelancer addresses
- Admin reads dispute reason from IPFS metadata
- IPFS reason typically contains raiser context
- If exact raiser needed: query `DisputeRaised` events via block explorer or indexer

**Potential Fix:**
Add optional `address public disputeRaisedBy` field to JobEscrow
- Costs ~5K extra gas per dispute
- Enables O(1) queries
- Consider for future upgrade if needed

**Status:** ⚠️ **KNOWN LIMITATION** - Workaround sufficient for current MVP

---

### Issue 4: Freelancer Stats Not Real-Time

**Symptoms:**
- FreelancerProfile counters lag behind completed jobs
- Inconsistency between on-chain stats and visible jobs

**Root Cause:**
- Stats updated only when JobEscrow explicitly calls `freelancerProfile.updateStats()`
- Network latency and transaction confirmation delays
- No automatic event listener sync

**Workaround:**
- Frontend reads both JobBoard and FreelancerProfile independently
- Reconciles in UI: shows both sources with timestamps
- Use off-chain cache (Supabase) for real-time display while on-chain settles

**Status:** ⚠️ **EXPECTED BEHAVIOR** - Blockchain is eventual consistency model

---

### Issue 5: IPFS Upload Timeouts

**Symptoms:**
- Dispute reason or work submission fails to upload
- "IPFS request timeout" error

**Root Cause:**
- Pinata gateway temporarily unavailable
- Large file size (> 50MB) exceeds limits
- Network connectivity issues

**Solutions:**
1. Retry with exponential backoff
2. Split large files into chunks
3. Fall back to secondary IPFS gateway
4. Store metadata separately from large files

**Status:** ⚠️ **OPERATIONAL** - Edge case, handled by retry logic

---

### Issue 6: Polygon/Ethereum Network Differences

**Symptoms:**
- Contract works on Polygon, fails on Ethereum
- Transaction cost differences confusing users

**Root Cause:**
- Gas prices vary 100x between networks
- Contract size may hit limits on specific chains
- RPC rate limits differ

**Mitigation:**
- Primary deployment on Polygon (lower costs)
- Ethereum deployment for high-value contracts
- Clear network selection in UI with cost estimates

**Status:** ✅ **MITIGATED** - User can select preferred network

---

## 🎯 Future Roadmap

### Phase 2 Features
- **Batch Payments:** Process multiple freelancer payments in single transaction
- **Reputation Score:** ML-based recommendation algorithm using on-chain history
- **Governance Token:** Platform-wide DAO for community decisions
- **Multi-Sig Escrow:** Require multiple approvals for high-value jobs
- **ZK Proofs:** Privacy for sensitive project details

### Phase 3 Features
- **NFT Badges:** Gamification and achievement system
- **Cross-Chain Bridge:** Support stablecoins on L2s
- **Insurance Pool:** Insure against dispute losses
- **Credit System:** Borrow against future earnings

---

## 📞 Support & Resources

### Documentation
- **Smart Contracts:** See `contracts/` directory for Solidity source
- **Type Definitions:** `src/config/` contains blockchain config
- **Component API:** JSDoc comments in `components/` files

### Getting Help
- **Chat with AI:** Use in-app chatbot for instant assistance
- **Dispute Issues:** File dispute on JobEscrow directly
- **Report Bugs:** Contact admin via Discord or email

### Contributing
- Fork repository
- Create feature branch
- Submit PR with tests
- Request review from core team

---

**Last Updated:** 2026-05-21  
**Version:** 0.1.0  
**Status:** LIVE (MVP)

