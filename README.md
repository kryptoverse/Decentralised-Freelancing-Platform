# FreelanceChain - Decentralized Freelancing & Investment Platform

A decentralized application built with Coinbase CDP Embedded Wallet that enables freelancing and company share tokenization on the blockchain.

## Features

### Freelancing Module
- **Browse Freelancers**: Discover talented professionals with ratings, skills, and availability
- **Post Projects**: Create project listings with budgets and deadlines
- **Portfolio Tracking**: Monitor all your freelance investments and projects
- **Transaction History**: View all blockchain transactions with explorer links

### Company Shares Module
- **Explore Companies**: Browse tokenized company shares with real-time pricing
- **Invest in Shares**: Purchase fractional ownership in Web3 companies
- **Manage Companies**: Create and manage your own tokenized company offerings
- **Market Analytics**: Track share prices, market cap, and performance

### User Modes
- **Client / Investor Mode**: Browse freelancers, projects, companies, and manage your portfolio
- **Developer / SaaS Owner Mode**: Manage your projects, companies, and create new offerings

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Wallet**: Coinbase CDP Embedded Wallet
- **UI Components**: shadcn/ui
- **Theme**: next-themes (Anime-style light mode + Dark mode)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Coinbase CDP API credentials

### Environment Variables

Create a `.env.local` file with the following variables:

\`\`\`env
# Coinbase CDP API Credentials
CDP_API_KEY_ID=your_api_key_id
CDP_API_KEY_SECRET=your_api_key_secret

# CDP Configuration
NEXT_PUBLIC_CDP_PROJECT_ID=your_project_id
NEXT_PUBLIC_CDP_CREATE_ETHEREUM_ACCOUNT_TYPE=smart
NEXT_PUBLIC_CDP_CREATE_SOLANA_ACCOUNT=false
\`\`\`

### Installation

\`\`\`bash
# Install dependencies
npm install

# Run development server
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Project Structure

\`\`\`
├── app/
│   ├── api/
│   │   └── onramp/          # Coinbase onramp API routes
│   ├── dashboard/           # Protected dashboard routes
│   │   ├── freelancers/     # Browse freelancers
│   │   ├── projects/        # Browse projects
│   │   ├── companies/       # Browse companies
│   │   ├── shares/          # Browse shares
│   │   ├── portfolio/       # Portfolio overview
│   │   ├── transactions/    # Transaction history
│   │   ├── my-projects/     # Manage your projects
│   │   ├── my-companies/    # Manage your companies
│   │   ├── create-offer/    # Create new offerings
│   │   └── wallet/          # Wallet management
│   ├── layout.tsx           # Root layout with providers
│   ├── page.tsx             # Landing page with wallet auth
│   └── globals.css          # Global styles with anime theme
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── Header.tsx           # App header with wallet info
│   ├── AppSidebar.tsx       # Dynamic sidebar navigation
│   ├── WalletGuard.tsx      # Wallet authentication guard
│   ├── SignInScreen.tsx     # Wallet sign-in screen
│   ├── FundWallet.tsx       # Wallet funding component
│   ├── EOATransaction.tsx   # EOA transaction component
│   ├── SmartAccountTransaction.tsx  # Smart account transactions
│   └── Providers.tsx        # App providers wrapper
└── lib/
    ├── cdp-auth.ts          # CDP authentication utilities
    ├── onramp-api.ts        # Onramp API utilities
    └── to-camel-case.ts     # Case conversion utilities
\`\`\`

## Theme System

The application features two distinct themes:

### Light Mode (Anime Style)
- Warm cream background (#FAF8F5)
- Thick 2px sketch-like borders
- Subtle box shadows for depth
- Hand-drawn aesthetic

### Dark Mode
- Coinbase-inspired dark theme
- High contrast for readability
- Consistent with Web3 aesthetics

Toggle between themes using the sun/moon icon in the header.

## Wallet Integration

The app uses Coinbase CDP Embedded Wallet for:
- Email and SMS authentication
- Smart account creation (gasless transactions)
- Onramp integration (fiat to crypto)
- Multi-chain support (Ethereum, Solana)

## Security

- Wallet-gated routes using WalletGuard
- Server-side API authentication with CDP JWT
- Environment variable validation
- Secure credential management

## Deployment

Deploy to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

Make sure to add all environment variables in your Vercel project settings.

## License

MIT License - feel free to use this project as a template for your own dApps.

## Support

For issues or questions:
- Open an issue on GitHub
- Check Coinbase CDP documentation
- Visit the Vercel community forums
