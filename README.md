# 🚀 Web3 Freelancing Platform - Final Year Project (FYP)

A decentralized freelancing and startup funding platform built on blockchain technology, enabling secure escrow-based job management, on-chain reputation systems, and tokenized startup investments.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Smart Contracts](#smart-contracts)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [User Roles](#user-roles)
- [Core Workflows](#core-workflows)
- [Gas Cost Management](#gas-cost-management)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Overview

This platform revolutionizes the gig economy by leveraging blockchain technology to provide:

- **Trustless Escrow**: Smart contract-based payment protection for both clients and freelancers
- **On-Chain Reputation**: Immutable, verifiable track records and credential verification
- **Decentralized Job Board**: Post, apply, and manage jobs entirely on-chain
- **Startup Tokenization**: Founders can tokenize equity and attract blockchain-native investors
- **Multi-Role Support**: Freelancers, Clients, Founders, Investors, and Admins
- **AI Assistant**: Built-in AI to help users navigate the platform and make informed decisions

---

## ✨ Key Features

### For Freelancers
- ✅ Create on-chain profiles with KYC verification
- ✅ Build immutable reputation through completed jobs
- ✅ Secure USDT payments via smart contract escrow
- ✅ Level progression system (0-5) based on completed jobs and ratings
- ✅ Portfolio services with pricing and media
- ✅ Apply to jobs with custom proposals and bids

### For Clients/Founders
- ✅ Post jobs with budgets, tags, and expiration dates
- ✅ Review freelancer applications with on-chain credentials
- ✅ Escrow-protected payments with dispute resolution
- ✅ Track job progress through lifecycle states
- ✅ Anti-spam measures (optional bond or KYC-gated posting)

### For Investors
- ✅ Discover tokenized startups
- ✅ Review founder credentials and project escrows
- ✅ Transparent on-chain investment tracking
- ✅ Built-in analytics and AI-powered insights

### Admin Dashboard 🛠️
- **Contract Deployment**: Deploy/Redeploy smart contracts directly from the UI
- **KYC Management**: Approve or revoke freelancer verification status
- **Dispute Resolution**: View evidence (IPFS), adjudicate disputes, and trigger smart contract payouts (Full/Partial/Refund)
- **Deployment Logs**: Real-time logging of contract deployment status

### Platform Features
- 🔐 **Web3 Authentication**: Email, Google, or wallet-based login via thirdweb
- 🎨 **Modern UI**: Dark mode, glassmorphism effects, responsive design
- 💰 **Gas Sponsorship**: Optional gasless transactions for better UX
- 📊 **Advanced APIs**: Event-based data fetching with sequential fallbacks for reliability
- ⚡ **IPFS Integration**: Decentralized storage for profiles, deliverables, and metadata

---

## 🏗️ Architecture

### Blockchain Layer
```
┌─────────────────────────────────────────────────────────────┐
│                      Smart Contracts                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  JobBoard              FreelancerProfile     ClientProfile  │
│  ├─ Post Jobs          ├─ Reputation        ├─ Client Info │
│  ├─ Applications       ├─ KYC Status        └─ Jobs Posted │
│  ├─ Job Lifecycle      ├─ Services                          │
│  └─ Tags & Search      └─ Multi-job Support                 │
│                                                             │
│  JobEscrow             EscrowFactory     FreelancerFactory  │
│  ├─ USDT Lock          ├─ Deploy Escrow  ├─ Create Profile │
│  ├─ Milestones         ├─ Link Profile   └─ KYC Manage     │
│  ├─ Dispute Mgmt       └─ Job Tracking                      │
│  └─ Auto-approve                                            │
│                                                             │
│  TestUSDT (Testnet Only)                                    │
│  └─ Mock USDT for testing                                   │
└─────────────────────────────────────────────────────────────┘
```

### Frontend Layer
```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Application                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Landing Page          Multi-Role Dashboard                 │
│  ├─ Hero Section       ├─ Freelancer Dashboard             │
│  ├─ Features           ├─ Client Dashboard                 │
│  ├─ Role Selection     ├─ Founder Dashboard                │
│  └─ Authentication     ├─ Investor Dashboard                │
│                        └─ Admin Dashboard (deployment UI)   │
│                                                             │
│  Components            Backend APIs                         │
│  ├─ Auth (Login)       ├─ /api/admin/disputes (Adv. Fetch) │
│  ├─ Job Management     ├─ /api/deployAll (Auto-Deploy)     │
│  ├─ Profile Forms      ├─ /api/files/delete (Pinata)       │
│  └─ UI Library         └─ /api/admin/kyc                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📜 Smart Contracts

### 1. **JobBoard.sol** (704 lines)
Central job marketplace contract with application system.

**Key Features:**
- Post, update, cancel, and reopen jobs
- Freelancer applications with proposals and custom bids
- Job lifecycle: `Open → Hired → Completed` or `Open → Expired/Cancelled`
- Anti-spam modes: `None`, `BondRequired`, `OnlyKYC`
- Tag-based search (max 5 tags per job)

### 2. **FreelancerProfile.sol** (341 lines)
Per-freelancer profile with reputation and multi-job support.

**Reputation System:**
- Levels 0-5 based on `completedJobs` and `totalPoints`
- KYC verification flag controlled by Factory

### 3. **JobEscrow.sol** (367 lines)
Single-use escrow contract for client↔freelancer jobs.

**Resolution Logic:**
- `resolveDispute(payoutBps, rating, outcome)`
- Supports partial payouts (e.g., 50/50 split) or full refunds
- Auto-approve mechanism if client goes silent after delivery

### 4. **EscrowFactory.sol**
Deploys and manages JobEscrow contracts, links to JobBoard.

### 5. **FreelancerFactory.sol**
Deploys FreelancerProfile contracts, manages KYC.

---

## 🛠️ Technology Stack

### Blockchain
- **Solidity**: `^0.8.28`
- **Framework**: Hardhat / generic EVM
- **Thirdweb SDK**: v5 for Web3 interactions

### Frontend
- **Framework**: Next.js 16.0.0 (React 19.2.0)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4.1.9 + CSS Animate + Shadcn/UI
- **Animations**: Framer Motion
- **Icons**: Lucide React

### Backend / API
- **Infura/RPC**: For server-side event fetching
- **Pinata**: IPFS file management (upload/delete)
- **Next.js API Routes**: Serverless functions for admin tasks

---

## 📁 Project Structure

```
Dapp/
├── app/                          # Next.js 13+ App Router
│   ├── admin/                    # Admin dashboard & UI
│   ├── api/                      # API Routes
│   │   ├── admin/                # Admin APIs
│   │   │   ├── disputes/         # Event-based dispute fetching
│   │   │   └── kyc/              # KYC handling
│   │   ├── deployAll/            # One-click contract deployment
│   │   ├── deployUSDT/           # Test token deployment
│   │   └── files/                # File management endpoints
│   ├── client/                   # Client-specific pages
│   ├── founder/                  # Founder dashboard
│   ├── freelancer/               # Freelancer dashboard
│   └── investor/                 # Investor dashboard
│
├── components/                   # React components
│   ├── admin/                    # Admin specific views
│   ├── auth/                     # Login modal, auth flows
│   ├── client/                   # Client job views & hiring
│   ├── dashboard/                # Multi-role dashboard
│   ├── freelancer/               # Freelancer components
│   └── ui/                       # Reusable UI (shadcn/ui)
│
├── contracts/                    # Solidity smart contracts
│
├── constants/                    # Contract addresses & ABIs
│   ├── deployedContracts.json    # Deployed addresses
│   └── deployedContracts.ts      # TypeScript exports
│
├── lib/                          # Utility libraries (Thirdweb, Chains)
├── GAS_COST_OPTIONS.md          # Gas optimization guide
└── README.md                     # This documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18+ recommended
- **Wallet**: MetaMask or any Web3 wallet
- **Infura/Alchemy Key**: For reliable server-side RPC calls (optional but recommended for Admin features)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd Dapp
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**

Create a `.env.local` file:

```bash
# Thirdweb
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=...
NEXT_PUBLIC_THIRDWEB_SECRET_KEY=...  # Only for server-side operations

# IPFS (Pinata)
NEXT_PUBLIC_PINATA_JWT=...
PINATA_API_KEY=...
PINATA_SECRET_API_KEY=...

# Blockchain Providers
INFURA_API_KEY=...  # Required for Admin API event fetching

# Blockchain Config
NEXT_PUBLIC_CHAIN_ID=80002  # Polygon Amoy
NEXT_PUBLIC_RPC_URL=...
```

4. **Run development server**
```bash
npm run dev
```

### Admin Configuration
To use the Admin Dashboard deployment features, ensure your server-side environment is configured with a private key (not recommended for production) or use the client-side wallet injection provided in the dashboard.

---

## 👥 User Roles

### 1. **Freelancer**
- Create verified profile (KYC)
- Apply to jobs with proposal & bid
- Deliver work to Escrow
- Receive payments & build reputation

### 2. **Client/Founder**
- Post jobs
- **Hiring Logic**: Checks native token balance for gas before hiring; supports gas sponsorship toggling.
- **Review**: Rate 1-5 stars upon approval.

### 3. **Admin**
- **Monitor**: View all active disputes via advanced event filtering.
- **Resolve**: Adjudicate disputes with Payout/Refund/Partial logic.
- **Deploy**: One-click system deployment from the web interface.

---

## ⚡ Gas Cost Management

See [`GAS_COST_OPTIONS.md`](./GAS_COST_OPTIONS.md) for detailed strategies.

**Implemented Logic:**
- **Profile Updates**: Client-side check skips smart contract calls if no data changed.
- **Hiring Flow**: Automated check for native token balance (MATIC) to prevent stuck transactions.
- **Sponsorship**: Dynamic toggling of gas sponsorship based on transaction type.

---

## 📜 Scripts & Utilities

| Path | Description |
|------|-------------|
| `api/admin/disputes` | **Advanced**: Uses `ethers.js` event filtering + sequential fallback to find all disputed jobs on-chain. |
| `api/deployAll` | Automation script to compile & deploy the entire protocol stack to the active chain. |
| `api/files/delete` | Utility to unpin content from Pinata when deleting portfolio items. |

---

**Built with ❤️**
