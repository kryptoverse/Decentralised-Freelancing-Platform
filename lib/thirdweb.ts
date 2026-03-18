// lib/thirdweb.ts
import { createThirdwebClient } from "thirdweb";
import { polygonAmoy } from "thirdweb/chains";
import { inAppWallet } from "thirdweb/wallets";

export const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

// ✅ Default wallet: sponsored gas (used for most of the app)
export const inAppSmartWallet = inAppWallet({
  auth: {
    options: ["google", "email"],
  },
  executionMode: {
    mode: "EIP4337",
    smartAccount: {
      chain: polygonAmoy,
      sponsorGas: true,       // App pays gas — used everywhere except company side
    },
  },
});

// ✅ Company/Founder wallet: user pays own gas (sponsorGas: false)
// Produces the SAME smart account address as inAppSmartWallet.
// Only used on the founder dashboard for the heavy createCompany deployment.
export const inAppSmartWalletNoGas = inAppWallet({
  auth: {
    options: ["google", "email"],
  },
  executionMode: {
    mode: "EIP4337",
    smartAccount: {
      chain: polygonAmoy,
      sponsorGas: false,      // User pays gas with their own MATIC
    },
  },
});


