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

export const inAppSmartWalletNoGas = inAppWallet({
  auth: {
    options: ["google", "email"],
  },
  executionMode: {
    mode: "EIP4337",
    smartAccount: {
      chain: polygonAmoy,
      sponsorGas: false,   // Disable normal thirdweb paymaster logic
      overrides: {
        // Provide a dummy paymaster that forces "0x" (no paymaster, user pays MATIC)
        // AND injects a safe 5M gas limit to fix the Out of Gas bug with contract deployments.
        paymaster: async (userOp) => {
          return {
            paymasterAndData: "0x" as `0x${string}`,
            preVerificationGas: userOp.preVerificationGas,
            verificationGasLimit: userOp.verificationGasLimit,
            callGasLimit: 5000000n, // Hardcode 5M gas to prevent EIP-150 out of gas
          };
        },
      },
    },
  },
});

