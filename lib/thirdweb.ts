// lib/thirdweb.ts
import { createThirdwebClient } from "thirdweb";
import { polygonAmoy } from "thirdweb/chains";
import { inAppWallet } from "thirdweb/wallets";

export const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

// ✅ shared in-app smart wallet config
export const inAppSmartWallet = inAppWallet({
  auth: {
    options: ["google", "email"],
  },
  executionMode: {
    mode: "EIP4337",
    smartAccount: {
      chain: polygonAmoy, // testnet
      sponsorGas: true,
    },
  },
});
