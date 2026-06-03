# WORQS Architecture & System Design

## 📐 System Architecture Overview

### High-Level System Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                          USER INTERFACE LAYER                          │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │  Freelancer Portal  │  │  Client Portal   │  │ Investor Portal │  │
│  │  - Find Jobs        │  │  - Post Jobs     │  │ - Explore Deals │  │
│  │  - Submit Work      │  │  - Approve Work  │  │ - Buy Shares    │  │
│  │  - Tokenize Biz     │  │  - Hire Team     │  │ - Claim Divs    │  │
│  │  - Manage Escrow    │  │  - Raise Funds   │  │ - Analytics     │  │
│  └─────────────────────┘  └──────────────────┘  └─────────────────┘  │
│                                                                         │
│  ┌──────────────────────┐  ┌──────────────────────────────────────┐  │
│  │  Admin Dashboard     │  │  Landing Page & AI Chatbot           │  │
│  │  - Resolve Disputes  │  │  - Onboarding                        │  │
│  │  - Monitor Platform  │  │  - Feature Education                │  │
│  │  - Verify Users      │  │  - Real-Time Assistance             │  │
│  └──────────────────────┘  └──────────────────────────────────────┘  │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
                                     ▼
                          ┌─────────────────────┐
                          │  Next.js API Routes │
                          │  (Backend Logic)    │
                          └─────────────────────┘
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     BLOCKCHAIN INTERACTION LAYER                       │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │            Thirdweb SDK / Ethers.js / Viem                    │  │
│  │  (Contract interaction, wallet management, transaction signing)│  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │              Account Abstraction (ERC-4337)                   │  │
│  │  (Sponsored transactions, gas-free UX fallbacks)              │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    SMART CONTRACTS LAYER (On-Chain)                    │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────┐  ┌──────────────────┐  ┌────────────────┐   │
│  │   JobBoard          │  │  EscrowFactory   │  │ Freelancer     │   │
│  │   - List jobs       │  │  - Deploy escrows│  │ Profile        │   │
│  │   - Track status    │  │  - Track disputes│  │ - Reputation   │   │
│  │   - Match making    │  │  - Registry      │  │ - On-chain CV  │   │
│  └─────────────────────┘  └──────────────────┘  └────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────┐  ┌───────────────────────────────┐  │
│  │  JobEscrow (Per-Job)         │  │  JobFundraise (Per-Job)       │  │
│  │  - Hold USDT                 │  │  - Pool investor funds        │  │
│  │  - Track delivery            │  │  - Calculate profit share     │  │
│  │  - Dispute handling          │  │  - Auto-distribute on close   │  │
│  │  - Payment release           │  │  - Reimburse on cancellation  │  │
│  └──────────────────────────────┘  └───────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │  CompanyRegistry      │  │  CompanyVault    │  │ Dividend       │  │
│  │  - Mint ERC-20 shares │  │  - Hold revenue  │  │ Distributor    │  │
│  │  - List for sale      │  │  - Track holders │  │ - O(1) payouts │  │
│  │  - Verify ownership   │  │  - Enforce rules │  │ - Accumulator  │  │
│  └───────────────────────┘  └──────────────────┘  └────────────────┘  │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │  Supported Tokens: USDT (Polygon, Ethereum, etc.)             │   │
│  │  Gas Optimization: O(1) dividend claims, batch operations     │   │
│  │  Access Control: Role-based checks on all state mutations     │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  EXTERNAL SERVICES & DATA LAYER                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────┐   ┌──────────────────┐   ┌────────────────┐    │
│  │  IPFS via Pinata │   │   Supabase       │   │  OpenAI API    │    │
│  │  - Store disputes│   │   - Cache jobs   │   │  - AI Chat     │    │
│  │  - Store work    │   │   - Cache users  │   │  - Proposals   │    │
│  │  - CID to chain  │   │   - RLS policy   │   │  - Suggestions │    │
│  │  - Immutable     │   │   - Search index │   │  - Streaming   │    │
│  └──────────────────┘   └──────────────────┘   └────────────────┘    │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │  Vercel Analytics - Track platform health & user behavior     │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Architecture

### Job Posting & Hiring Flow

```
User (Client)
     │
     ▼
[1] Client clicks "Post Job" → Opens JobPostForm
     │
     ▼
[2] Form validates input (Zod schema)
     │
     ▼
[3] Frontend calls POST /api/jobs
     │
     ├─► Backend: Create job record
     ├─► Backend: Store in Supabase (off-chain cache)
     └─► Blockchain: Call JobBoard.postJob() contract
     │
     ▼
[4] Job listed on platform with unique jobId
     │
     └─► Freelancers discover job via JobBoard UI
     │
     ▼
User (Freelancer)
     │
     ▼
[5] Freelancer clicks "Apply"
     │
     ▼
[6] Frontend: Open ProposalForm (pre-filled with jobId)
     │
     ▼
[7] Freelancer submits proposal
     │
     ├─► Backend: Store proposal in Supabase
     └─► Blockchain: Emit application event (optional on-chain)
     │
     ▼
[8] Client reviews proposals
     │
     ▼
[9] Client clicks "Hire" on chosen proposal
     │
     ▼
[10] System creates JobEscrow contract instance
     └─► EscrowFactory.createEscrow(client, freelancer, amount, jobKey)
     └─► New JobEscrow deployed (CREATE opcode)
     │
     ▼
[11] Client deposited USDT into JobEscrow
     └─► Escrow holds funds securely
     └─► Job status: "Hired"
     │
     ▼
[12] Freelancer begins work (off-chain)
     │
     └─► Can create JobFundraise if needs investor capital
     │
     ▼
[13] Freelancer submits work
     └─► Uploads deliverable to IPFS (Pinata)
     └─► Calls jobEscrow.submitDelivery(ipfsURI)
     └─► escrow.delivered = true
     │
     ▼
[14] Client reviews work
     │
     ▼
[15] Client clicks "Approve"
     └─► Calls jobEscrow.approveDelivery()
     └─► Escrow transfers USDT to freelancer
     └─► FreelancerProfile updated
     └─► escrow.terminal = true (finalized)
```

---

### Company Share Sale & Dividend Flow

```
User (Freelancer)
     │
     ▼
[1] Freelancer (proven track record) creates company
     └─► Calls CompanyRegistry.createCompany()
     └─► Mints 1,000,000 ERC-20 tokens
     └─► Sets mandatory 30% shareholder distribution
     │
     ▼
[2] Lists 20% (200K tokens) for sale
     └─► Calls CompanyRegistry.listSharesForSale(200000, price)
     └─► Tokens available in investor marketplace
     │
     ▼
User (Investor)
     │
     ▼
[3] Investor discovers company via investor portal
     │
     ▼
[4] Investor clicks "Buy Shares"
     └─► Sends USDT to CompanyRegistry
     └─► Receives ERC-20 tokens to wallet
     └─► Investor now owns % of company
     │
     ▼
User (Freelancer) - Months later
     │
     ▼
[5] Freelancer completes large $50K job
     └─► Deposits revenue to CompanyVault
     └─► vault.totalRevenue += $50,000
     │
     ▼
[6] DividendDistributor updates
     └─► accumulatedDividendPerShare += ($50,000 / totalTokens)
     └─► O(1) calculation, constant gas
     │
     ▼
User (Investor)
     │
     ▼
[7] Investor discovers new vault balance
     │
     ▼
[8] Investor clicks "Claim Dividends"
     └─► Calls CompanyVault.claimDividend()
     └─► Contract calculates: balanceOf(investor) × accumulator
     └─► Result: investor's percentage of vault
     └─► Instant USDT transfer
     │
     ▼
[9] Investor receives passive income
     └─► Continues to earn as freelancer deposits more revenue
     └─► As long as investor holds tokens
```

---

### Job Fundraising Flow (Syndication)

```
Scenario: Freelancer needs upfront capital for specific job

Freelancer
     │
     ▼
[1] Freelancer lands $10K job (locked in escrow)
     │
     ▼
[2] Needs $2K upfront for designer
     │
     ▼
[3] Clicks "Fundraise for this Job"
     └─► Opens FundraiseForm
     └─► targetAmount = $2,000
     └─► profitSharePercentage = 50%
     └─► jobEscrowAddress = (locked contract)
     │
     ▼
[4] Creates JobFundraise contract instance
     └─► Linked to specific JobEscrow
     └─► investors[] array initialized
     │
     ▼
Multiple Investors
     │
     ├─► [Investor 1] invests $1,000
     ├─► [Investor 2] invests $1,000
     └─► Both recorded in fundraise.investors[]
     │
     ▼
Freelancer
     │
     ▼
[5] Withdraws $2,000 from fundraise
     └─► Pays designer
     └─► Completes work
     │
     ▼
Client
     │
     ▼
[6] Approves escrow
     └─► jobEscrow.approveDelivery()
     └─► BUT: Doesn't pay freelancer directly
     └─► Instead: Routes $10K → JobFundraise contract
     │
     ▼
[7] JobFundraise auto-calculates payouts
     ├─► NetProfit = $10,000 - $2,000 = $8,000
     ├─► Investor1 share = $1,000 + (50% × $4,000) = $3,000
     ├─► Investor2 share = $1,000 + (50% × $4,000) = $3,000
     └─► Freelancer remainder = $4,000
     │
     ▼
[8] All parties claim
     ├─► Investor1: claimInvestorPayout() → $3,000
     ├─► Investor2: claimInvestorPayout() → $3,000
     └─► Freelancer: claimFreelancerPayout() → $4,000
```

---

### Dispute Resolution Flow

```
Scenario: Client disputes work quality

Client or Freelancer
     │
     ▼
[1] Clicks "Raise Dispute" on escrow
     │
     ▼
[2] Opens DisputeRaiseForm
     └─► Reason text input
     └─► Optional evidence link
     │
     ▼
[3] Submits dispute
     └─► Uploads reason to IPFS via Pinata
     └─► Receives IPFS CID
     └─► Calls jobEscrow.raiseDispute(ipfsCID)
     │
     ▼
[4] On-chain update
     └─► jobEscrow.disputed = true
     └─► jobEscrow.disputeReasonURI = ipfsCID
     └─► Emits DisputeRaised event
     └─► EscrowFactory tracks in activeDisputes[]
     │
     ▼
Backend
     │
     ▼
[5] Listens for DisputeRaised event
     └─► Caches to Supabase.disputes table
     └─► Sends notification to admin
     │
     ▼
Admin
     │
     ▼
[6] Visits admin dashboard
     └─► Sees list of activeDisputes
     │
     ▼
[7] Clicks on dispute to review
     └─► Fetches IPFS reason metadata
     └─► Shows submitted work (IPFS)
     └─► Shows original job requirements
     │
     ▼
[8] Admin decides outcome
     ├─► Option A: Full approval (payoutBps = 10000)
     ├─► Option B: Full refund (payoutBps = 0)
     └─► Option C: Custom split (payoutBps = 7000 → 70% freelancer)
     │
     ▼
[9] Admin executes resolution
     └─► Calls jobEscrow.resolveDispute(payoutBps)
     └─► Contract calculates amounts
     └─► Transfers to freelancer & client
     └─► jobEscrow.terminal = true
     │
     ▼
[10] Both parties receive payouts
     └─► Freelancer gets their % of original amount
     └─► Client gets refund % (if applicable)
     └─► FreelancerProfile.disputedJobs += 1
```

---

## 🗄️ Data Models

### Supabase Tables

#### `disputes` Table
```sql
CREATE TABLE disputes (
  id UUID PRIMARY KEY,
  job_id TEXT NOT NULL,
  disputer_address TEXT NOT NULL,
  dispute_reason_uri TEXT,        -- IPFS CID
  transaction_hash TEXT,
  created_at TIMESTAMP,
  status TEXT ('OPEN', 'RESOLVED', 'ESCALATED')
);
```

#### `jobs` Table (Cached)
```sql
CREATE TABLE jobs (
  job_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  budget DECIMAL NOT NULL,
  client_address TEXT NOT NULL,
  category TEXT,
  status TEXT ('OPEN', 'HIRED', 'COMPLETED', 'CANCELLED'),
  created_at TIMESTAMP,
  escrow_address TEXT (nullable),
  fundraise_address TEXT (nullable)
);
```

#### `freelancer_profiles` Table (Cached)
```sql
CREATE TABLE freelancer_profiles (
  address TEXT PRIMARY KEY,
  name TEXT,
  bio TEXT,
  avatar_url TEXT,
  skills TEXT[],
  completed_jobs INTEGER,
  total_earnings DECIMAL,
  rating DECIMAL,
  disputed_jobs INTEGER,
  created_at TIMESTAMP
);
```

#### `company_shares` Table
```sql
CREATE TABLE company_shares (
  id UUID PRIMARY KEY,
  company_address TEXT NOT NULL,
  name TEXT NOT NULL,
  founder_address TEXT NOT NULL,
  total_supply DECIMAL,
  mandatory_distribution_percent DECIMAL,
  share_price DECIMAL,
  created_at TIMESTAMP,
  vault_balance DECIMAL
);
```

---

## 💾 Smart Contract State Architecture

### JobEscrow State Variables
```solidity
contract JobEscrow {
  // Core parties
  address public client;
  address public freelancer;
  
  // Financial
  uint256 public amount;
  IERC20 public usdt;
  
  // Status tracking
  bool public delivered;           // freelancer submitted work
  bool public approved;            // client approved work
  bool public terminal;            // escrow finalized
  bool public disputed;            // dispute raised
  
  // Dispute resolution
  bytes public deliveryURI;        // IPFS link to work
  bytes public disputeReasonURI;   // IPFS link to dispute reason
  
  // Syndication (if fundraised)
  address public fundraiseAddress; // optional JobFundraise contract
  
  // Cancellation tracking
  address public cancelRequestedBy; // who initiated cancellation
  uint256 public cancelledAt;      // timestamp
  
  // Admin operations
  address public escrowFactory;    // only address that can resolve disputes
}
```

### CompanyVault State Variables
```solidity
contract CompanyVault {
  address public company;
  IERC20 public shareToken;
  IERC20 public usdt;
  
  uint256 public totalRevenue;
  uint256 public mandatoryDistributionPercent;
  
  // Dividend distribution (O(1) pattern)
  uint256 public accumulatedDividendPerShare;
  mapping(address => uint256) public lastAccumulatorSnapshot;
  mapping(address => uint256) public unclaimedDividends;
}
```

### DividendDistributor Algorithm
```
On Revenue Deposit:
  newAccumulator = accumulatedDividendPerShare + (depositAmount / totalShares)
  accumulatedDividendPerShare = newAccumulator

On Claim:
  userDividend = balanceOf(user) * accumulatedDividendPerShare - claimedAmount
  transfer(user, userDividend)
  
Result: O(1) gas regardless of shareholder count
```

---

## 🔐 Security Architecture

### Authentication & Authorization Flow

```
User visits WORQS
     │
     ▼
Landing page shown
     │
     ▼
User clicks "Login"
     │
     ▼
LoginModal component opens
     │
     ▼
Thirdweb wallet selection
     ├─► MetaMask
     ├─► Coinbase Wallet
     └─► WalletConnect
     │
     ▼
User connects wallet
     │
     ▼
Thirdweb verifies ownership (signature)
     │
     ▼
useActiveAccount hook triggered
     │
     ▼
Session stored in localStorage
     │
     ▼
Dashboard component renders
     │
     └─► Role selection: freelancer/client/investor/admin
     │
     ▼
User Role loaded from contract state
     └─► FreelancerProfile contract read
     └─► CompanyRegistry contract read
     │
     ▼
Role-specific dashboard displayed
     │
     └─► All subsequent calls include address in context
     └─► Smart contracts verify msg.sender == user address
```

### Authorization Pattern

```solidity
// Example: Only freelancer can submit delivery
modifier onlyFreelancer() {
  require(msg.sender == freelancer, "Not freelancer");
  _;
}

function submitDelivery(bytes calldata deliveryURI) 
  external 
  onlyFreelancer 
  nonReentrant 
{
  require(!terminal, "Escrow finalized");
  require(!disputed, "Cannot deliver during dispute");
  
  delivered = true;
  deliveryURI = deliveryURI;
  
  emit DeliverySubmitted(freelancer, deliveryURI);
}
```

---

## 📊 Scalability Architecture

### Database Scaling
- **Supabase:** Automatically scales read replicas
- **Indexing:** Unique indexes on `address` and `job_id` for fast queries
- **Caching:** Frontend caches job/profile data to reduce DB hits

### Blockchain Scaling
- **Primary Chain:** Polygon (low gas, fast finality)
- **Secondary Chains:** Ethereum (high security), Optimism, Arbitrum
- **Contract Optimization:**
  - O(1) dividend claims (no loops)
  - Batch operations for multiple payouts
  - Storage packing (uint256 flags instead of separate bools)

### Frontend Optimization
- **Code Splitting:** Route-based code splitting via Next.js
- **Image Optimization:** Next/Image for lazy loading
- **Component Memoization:** React.memo on heavy components

---

## 🔗 Integration Architecture

### Thirdweb SDK Integration
```typescript
// Provider wraps entire app
<ThirdwebProvider>
  {children}
</ThirdwebProvider>

// Read contract state (no gas)
const { data: profile } = useContractRead(
  contract,
  "getProfile",
  [freelancerAddress]
);

// Write contract state (costs gas)
const { mutate: submitDelivery } = useContractWrite(
  contract,
  "submitDelivery"
);

await submitDelivery({ args: [ipfsURI] });
```

### OpenAI Integration
```typescript
// Streaming chat messages
const { messages, input, handleInputChange, handleSubmit } = useChat({
  api: '/api/chat',
  onFinish: (message) => {
    // Message finished streaming
  }
});

// Backend processes with OpenAI
const response = await openai.chat.completions.create({
  messages,
  model: 'gpt-4',
  stream: true,
});
```

### Pinata IPFS Integration
```typescript
// Upload file to IPFS
const formData = new FormData();
formData.append('file', file);

const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${PINATA_TOKEN}`
  },
  body: formData
});

const { IpfsHash } = await response.json();
// IpfsHash = "Qm..." → Store on-chain
```

---

## 🔄 Component Communication

### State Management Pattern

```typescript
// Context provides global state
<ChatProvider>
  <ChatContext.Provider value={{ messages, addMessage, ... }}>
    {children}
  </ChatContext.Provider>
</ChatProvider>

// Components consume context
const { messages } = useContext(ChatContext);

// Updates trigger re-render
dispatch({ type: 'ADD_MESSAGE', payload: message });
```

### Data Flow Between Components

```
Dashboard (root)
  │
  ├─► FreelancerDashboard
  │    ├─► FindWork (browse jobs from JobBoard)
  │    ├─► Profile (read FreelancerProfile contract)
  │    ├─► Jobs (read user's JobEscrow instances)
  │    ├─► Proposals (read from Supabase cache)
  │    └─► Wallet (read USDT balance)
  │
  ├─► ClientDashboard
  │    ├─► PostJob (write to JobBoard contract)
  │    ├─► FindFreelancer (read FreelancerProfile contracts)
  │    ├─► Jobs (list user's JobEscrow instances)
  │    ├─► Offers (read proposals from Supabase)
  │    └─► Wallet
  │
  └─► InvestorDashboard
       ├─► Explore (read CompanyRegistry for share listings)
       ├─► Companies (read user's ERC-20 balances)
       ├─► Portfolio (read vault balances & dividend state)
       └─► Wallet
```

---

## ⚡ Performance Optimization

### Contract Gas Optimization

| Optimization | Benefit |
|---|---|
| O(1) dividend claims | No loops, scales to millions |
| Packed storage | Multiple values per slot |
| Batch operations | Single tx for multiple payouts |
| Immutable escrows | No updates after terminal |

### Frontend Performance

| Optimization | Benefit |
|---|---|
| Route-based code splitting | Smaller initial bundle |
| Component memoization | Skip unnecessary re-renders |
| Image lazy loading | Faster page load |
| Database caching | Reduced RPC calls |
| Local storage | Wallet session persistence |

---

## 🚨 Error Handling & Recovery

### Transaction Error Handling

```typescript
try {
  // Estimate gas
  const gas = await contract.estimateGas.submitDelivery([ipfsURI]);
  
  // If estimation fails, use fallback
  const safeGas = gas * 1.2;
  
  // Execute with manual gas limit
  const tx = await contract.submitDelivery([ipfsURI], {
    gasLimit: safeGas
  });
  
  await tx.wait();
} catch (error) {
  if (error.code === 'INSUFFICIENT_FUNDS') {
    // User doesn't have enough ETH for gas
    showError('Insufficient funds');
  } else if (error.code === 'ACTION_REJECTED') {
    // User rejected transaction
    showError('Transaction rejected');
  } else {
    // Show generic error
    showError(error.message);
  }
}
```

---

## 🔮 Future Architecture Improvements

### Phase 2+
- **Cross-chain bridges:** Seamless multi-chain experience
- **Advanced indexing:** Subgraph for real-time data
- **Notification service:** Push notifications for events
- **Payment channels:** Layer 2 scalability
- **Governance:** DAO for protocol decisions

---

**Last Updated:** 2026-05-21  
**Version:** 1.0

