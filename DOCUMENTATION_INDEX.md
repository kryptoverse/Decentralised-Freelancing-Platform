# WORQS Documentation Index

Complete documentation for the WORQS Web3 Freelancing & Dual-Funding DApp platform.

---

## 📑 Documentation Files

### 1. **FEATURES.md** - Complete Feature Documentation
   - **Purpose:** Comprehensive guide to all platform features
   - **Contains:**
     - Project overview and mission
     - Core dual-funding architecture explanation
     - Detailed feature breakdowns (10+ major features)
     - User roles and capabilities matrix
     - Technical stack overview
     - Component structure and organization
     - Smart contract interfaces
     - End-to-end user workflows with examples
     - Security guarantees and protections
     - API & integration overview
     - Known issues and troubleshooting
   - **Best For:** Understanding what WORQS does and how to use each feature
   - **Read Time:** 45-60 minutes

### 2. **ARCHITECTURE.md** - System Design & Architecture
   - **Purpose:** Technical architecture and system design documentation
   - **Contains:**
     - High-level system diagram
     - Data flow architecture (4 major flows)
     - Data models and database schemas
     - Smart contract state architecture
     - Security architecture and authentication flow
     - Scalability considerations
     - Integration architecture (Thirdweb, OpenAI, Pinata, Supabase)
     - Component communication patterns
     - Performance optimizations
     - Error handling and recovery strategies
     - Future roadmap and improvements
   - **Best For:** Technical implementation, system design reviews, developer onboarding
   - **Read Time:** 30-40 minutes

### 3. **API_GUIDE.md** - REST API Reference & Implementation
   - **Purpose:** Complete REST API documentation with examples
   - **Contains:**
     - All REST API endpoints (User, Jobs, Escrows, Disputes, Fundraises, Companies, Chat)
     - Request/response examples for each endpoint
     - Authentication methods and signature verification
     - Standard response formats
     - Error codes and handling
     - Rate limiting details
     - SDK usage examples (JavaScript/TypeScript)
     - cURL testing examples
   - **Best For:** API integration, backend development, testing
     - **Read Time:** 30-40 minutes

### 4. **README.md** - Project Overview & Getting Started
   - **Purpose:** Quick start guide and high-level overview
   - **Contains:**
     - Project mission and value proposition
     - Core architecture explanation (Dual-Funding Model)
     - End-to-end user story examples (3 scenarios)
     - Security guarantees
     - Known issues and workarounds
     - On-chain dispute system explanation
   - **Best For:** Quick understanding, onboarding, stakeholder briefings
   - **Read Time:** 15-20 minutes

---

## 🎯 Quick Navigation Guide

### For Different Roles:

#### **Product Managers & Non-Technical Stakeholders**
1. Start with: **README.md** (Overview)
2. Then read: **FEATURES.md** (Sections 1-2, User Roles, Key Features)
3. Reference: **ARCHITECTURE.md** (High-level System Diagram only)

#### **Frontend Developers**
1. Start with: **FEATURES.md** (Component Structure section)
2. Study: **ARCHITECTURE.md** (Component Communication & Data Flows)
3. Reference: **API_GUIDE.md** (For backend integration)

#### **Smart Contract Developers**
1. Start with: **FEATURES.md** (Smart Contracts section)
2. Study: **ARCHITECTURE.md** (Smart Contract State Architecture)
3. Reference: **README.md** (Known Issues section)
4. Review: `contracts/` directory in repo for actual code

#### **Backend/Full-Stack Developers**
1. Start with: **FEATURES.md** (Technical Stack & Component Structure)
2. Study: **ARCHITECTURE.md** (Architecture, Data Models, Security)
3. Deep dive: **API_GUIDE.md** (REST API implementation)

#### **DevOps & Infrastructure**
1. Start with: **ARCHITECTURE.md** (External Services & Data Layer)
2. Reference: **FEATURES.md** (Technical Stack)
3. Check: `vercel.json`, `next.config.mjs` for deployment config

#### **Security Auditors**
1. Start with: **FEATURES.md** (Security Features section)
2. Study: **ARCHITECTURE.md** (Security Architecture, Data Models)
3. Review: **README.md** (Known Issues & Workarounds)
4. Audit: `contracts/` directory for code review

---

## 📊 Feature Overview Quick Reference

### Core Features (10)
| # | Feature | Category | Status |
|---|---------|----------|--------|
| 1 | Job Board & Marketplace | Freelancing | ✅ Live |
| 2 | Escrow-Protected Payments | Payments | ✅ Live |
| 3 | Freelancer On-Chain Profile | Reputation | ✅ Live |
| 4 | Company Shares (ERC-20) | Investment | ✅ Live |
| 5 | Job Fundraising (Syndication) | Investment | ✅ Live |
| 6 | AI-Powered Chatbot | Assistance | ✅ Live |
| 7 | Dispute Resolution System | Governance | ✅ Live |
| 8 | Admin Dashboard | Operations | ✅ Live |
| 9 | Multi-Chain Support | Infrastructure | ✅ Live |
| 10 | Authentication & Wallet Integration | Security | ✅ Live |

### User Roles (4)
| Role | Key Capabilities | Dashboard URL |
|------|------------------|---------------|
| **Freelancer** | Browse jobs, submit proposals, tokenize business | `/freelancer` |
| **Client** | Post jobs, hire talent, approve work | `/client` |
| **Investor** | Explore deals, buy shares, claim dividends | `/investor` |
| **Admin** | Resolve disputes, monitor platform | `/admin` |

---

## 🔍 Smart Contracts Summary

| Contract | Purpose | Key Functions |
|----------|---------|---------------|
| **JobBoard** | Job registry & matching | postJob, applyForJob, acceptApplication |
| **JobEscrow** | Payment holding & release | submitDelivery, approveDelivery, raiseDispute |
| **EscrowFactory** | Deploy & track escrows | createEscrow, getAllDisputes |
| **JobFundraise** | Job-specific fundraising | fundRaise, claimInvestorPayout |
| **CompanyRegistry** | ERC-20 share creation | createCompany, listSharesForSale |
| **CompanyVault** | Revenue holding & distribution | depositRevenue, claimDividend |
| **DividendDistributor** | O(1) dividend payouts | (automatic via vault) |
| **FreelancerProfile** | On-chain reputation | updateStats, addSkill, getProfile |

---

## 🔌 External Integrations

| Service | Purpose | SDK/Library |
|---------|---------|-------------|
| **Thirdweb** | Contract interaction & wallet management | `@thirdweb-dev/react`, `thirdweb/react` |
| **Ethers.js / Viem** | Low-level Web3 interactions | `ethers`, `viem` |
| **OpenAI** | AI chatbot | `@ai-sdk/openai`, Vercel AI SDK |
| **Pinata** | IPFS file storage | `@pinata/sdk` |
| **Supabase** | Off-chain database | PostgreSQL, RLS |
| **Vercel** | Deployment & Analytics | Vercel CLI, Analytics SDK |

---

## 📁 Key Directories

```
project-root/
├── contracts/              # Smart contract source (Solidity)
├── app/                    # Next.js app routes
│   ├── freelancer/         # Freelancer dashboard
│   ├── client/             # Client dashboard
│   ├── investor/           # Investor dashboard
│   ├── admin/              # Admin dashboard
│   └── api/                # Backend API routes
├── components/             # Reusable React components
│   ├── ui/                 # Base UI components (Radix)
│   ├── freelancer/         # Freelancer-specific components
│   ├── client/             # Client-specific components
│   ├── investor/           # Investor-specific components
│   ├── disputes/           # Dispute components
│   └── chat/               # Chatbot components
├── hooks/                  # Custom React hooks
├── lib/                    # Utility functions
├── utils/                  # Helper functions
├── styles/                 # Global styles
└── public/                 # Static assets
```

---

## 🚀 Getting Started (5-Minute Overview)

### What is WORQS?
WORQS is a Web3 platform that merges freelancing with DeFi:
- **Freelancers** earn on-chain reputation and get paid securely via smart contract escrows
- **Clients** hire vetted talent and can raise funding by tokenizing equity
- **Investors** fund specific projects or buy company shares to earn passive dividends

### The Two Investment Models
1. **Company Shares:** Long-term equity stake earning forever-dividends
2. **Job Fundraising:** Short-term syndication earning profit-share on specific projects

### How It Works (Simple)
```
1. Client posts job on JobBoard (e.g., "$5K for smart contract audit")
2. Freelancer applies with proposal
3. Client hires freelancer → $5K locked in JobEscrow smart contract
4. Freelancer submits work via IPFS link
5. Client approves → $5K automatically released to freelancer
6. Freelancer's on-chain reputation updates (+ verified earnings)
```

### Key Security Features
- ✅ Smart contract escrows prevent fraud
- ✅ IPFS immutable dispute records
- ✅ O(1) dividend distribution (no gas limits)
- ✅ Mandatory shareholder distributions (enforced by contract)
- ✅ Role-based access control (client, freelancer, admin)

---

## ⚠️ Critical Known Issues

| Issue | Impact | Workaround | Status |
|-------|--------|-----------|--------|
| **Account Abstraction Gas Estimation** | Hiring transactions fail | Manual gas limit bypass | ✅ Fixed |
| **Job Status Not Updated After Dispute** | UI shows incorrect status | Frontend secondary check | ✅ Workaround |
| **Dispute Raiser Identity Not Stored** | Admin can't determine raiser | Both addresses visible + IPFS reason | ⚠️ Known |
| **Freelancer Stats Lag** | On-chain stats eventual consistency | Acceptable blockchain behavior | ✓ Expected |
| **IPFS Upload Timeouts** | Rare upload failures | Retry logic + fallback gateway | ⚠️ Operational |

See **README.md** or **FEATURES.md** for detailed explanations.

---

## 🔐 Security Best Practices

### For Users
- ✅ Always verify contract addresses before transactions
- ✅ Use hardware wallet for high-value transactions
- ✅ Review IPFS dispute evidence before accepting arbitration
- ✅ Start with small jobs to build reputation

### For Developers
- ✅ Verify wallet signatures for sensitive operations
- ✅ Validate IPFS URIs before logging to chain
- ✅ Use fallback gas limits for complex transactions
- ✅ Implement proper error handling for blockchain calls
- ✅ Test on testnet before mainnet deployment

---

## 📞 Support Resources

### Documentation
- 📖 **Feature Guide:** FEATURES.md
- 🏗️ **Architecture:** ARCHITECTURE.md
- 📡 **API Reference:** API_GUIDE.md
- 📝 **README:** README.md

### Getting Help
- 💬 Use in-app AI chatbot for assistance
- 🐛 Report bugs via GitHub issues
- 📧 Contact admin for dispute escalation

### Development
- 🔗 GitHub repository: [Link]
- 📚 Smart contract source: `contracts/` directory
- 🧪 API testing: See API_GUIDE.md for cURL examples

---

## 🗺️ Roadmap

### Current (V0.1.0)
✅ Core freelancing + escrow system
✅ Company shares & dividends
✅ Job fundraising
✅ Dispute resolution
✅ AI chatbot

### Phase 2 (Q3 2026)
🔜 Batch payment processing
🔜 Reputation scoring algorithm
🔜 Governance token (DAO)
🔜 Multi-sig escrow

### Phase 3 (Q4 2026+)
🔮 NFT badges & achievements
🔮 Cross-chain bridging
🔮 Insurance pool
🔮 Credit system

---

## 📊 Statistics & Metrics

### Platform Size
- **Smart Contracts:** 8 core contracts
- **Frontend Components:** 50+ reusable components
- **API Endpoints:** 30+ REST endpoints
- **UI Dependencies:** 30+ Radix UI components

### Code Quality
- **Language:** TypeScript (strict mode)
- **Frontend Framework:** Next.js 16.1.0
- **Styling:** Tailwind CSS 4.1.9
- **Testing:** Jest + React Testing Library
- **Linting:** ESLint + Prettier

### Performance
- **Dividend Claims:** O(1) gas (constant regardless of shareholder count)
- **Job Listings:** Paginated & indexed for fast queries
- **Component Loading:** Route-based code splitting
- **API Response:** <500ms median (with caching)

---

## 🎓 Learning Path

### Beginner (New to Platform)
1. Read: README.md (15 min)
2. Watch: [Demo video if available]
3. Try: Explore freelancer portal
4. **Time:** 30 minutes

### Intermediate (Developer)
1. Read: FEATURES.md sections 1-3 (30 min)
2. Study: ARCHITECTURE.md (40 min)
3. Review: Component structure in code
4. **Time:** 2 hours

### Advanced (Deep Dive)
1. Read: All documentation files (2 hours)
2. Study: Smart contract code (1 hour)
3. Review: API implementation (1 hour)
4. Test: API endpoints via cURL (30 min)
5. **Time:** 4.5 hours

### Expert (Full Mastery)
1. Complete Advanced path (4.5 hours)
2. Audit smart contracts (3 hours)
3. Optimize performance (2 hours)
4. Deploy to testnet (1 hour)
5. **Time:** 10.5 hours

---

## 🔗 Quick Links

| Link | Purpose |
|------|---------|
| `/freelancer` | Freelancer dashboard |
| `/client` | Client dashboard |
| `/investor` | Investor dashboard |
| `/admin` | Admin dashboard |
| GitHub Issues | Bug reports |
| Discord | Community chat |
| Email | Support@worqs.com |

---

## 📄 License & Attribution

**Platform:** WORQS v0.1.0  
**Status:** MVP / Live  
**Last Updated:** 2026-05-21

---

## 🙏 Acknowledgments

Built with:
- **Thirdweb SDK** for Web3 infrastructure
- **Radix UI** for accessible components
- **Tailwind CSS** for styling
- **Vercel** for deployment
- **Pinata** for IPFS
- **Supabase** for database

---

**Start with FEATURES.md for a complete understanding of the platform.**

