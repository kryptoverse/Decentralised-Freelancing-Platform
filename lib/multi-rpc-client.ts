// lib/multi-rpc-client.ts
/**
 * Multi-RPC Client with automatic fallback
 * Priority: Infura -> Alchemy -> Thirdweb -> Loop back to Infura
 * 
 * Used specifically for notification checks to avoid rate limits
 */

import { createThirdwebClient } from "thirdweb";
import { polygonAmoy } from "thirdweb/chains";

// RPC endpoint URLs
const INFURA_RPC = `https://polygon-amoy.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_API_KEY}`;
const ALCHEMY_RPC = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
    ? `https://polygon-amoy.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
    : null;

// Track which RPC is currently active (cycles through providers)
let currentRpcIndex = 0;

/**
 * Get RPC URLs in priority order
 */
function getRpcUrls(): string[] {
    const urls: string[] = [INFURA_RPC];
    if (ALCHEMY_RPC) urls.push(ALCHEMY_RPC);
    return urls;
}

/**
 * Get RPC client with automatic fallback on rate limit/error
 * @returns Thirdweb client configured with current RPC provider
 */
export function getMultiRpcClient() {
    const rpcUrls = getRpcUrls();

    // Cycle through available RPCs
    const selectedRpc = rpcUrls[currentRpcIndex % rpcUrls.length];

    // Log which RPC we're using
    let rpcName = "Thirdweb Default";
    if (selectedRpc === INFURA_RPC) rpcName = "Infura";
    else if (selectedRpc === ALCHEMY_RPC) rpcName = "Alchemy";

    console.log(`📡 Using RPC Provider: ${rpcName}`);

    // Create client with selected RPC
    return createThirdwebClient({
        clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
        config: {
            rpc: {
                [polygonAmoy.id]: selectedRpc,
            },
        },
    });
}

/**
 * Execute a read operation with automatic RPC fallback
 * If current RPC fails (rate limit or error), tries next RPC in chain
 * 
 * @param operation - Async function that performs the RPC call
 * @returns Result from successful RPC call
 */
export async function executeWithFallback<T>(
    operation: (client: ReturnType<typeof createThirdwebClient>) => Promise<T>
): Promise<T> {
    const rpcUrls = getRpcUrls();
    const maxAttempts = rpcUrls.length + 1; // Try all RPCs + Thirdweb default

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const client = getMultiRpcClient();
            const result = await operation(client);

            // Success! Return result
            return result;

        } catch (error: any) {
            const isLastAttempt = attempt === maxAttempts - 1;

            // Check if it's a rate limit error
            const isRateLimit =
                error?.message?.includes("429") ||
                error?.message?.includes("rate limit") ||
                error?.status === 429;

            if (isRateLimit) {
                console.warn(`⚠️ RPC rate limit hit, switching to next provider...`);
            } else {
                console.warn(`⚠️ RPC error:`, error.message);
            }

            if (isLastAttempt) {
                // All RPCs failed, throw error
                throw new Error(`All RPC providers failed: ${error.message}`);
            }

            // Switch to next RPC
            currentRpcIndex++;

            // Small delay before retry
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    throw new Error("Unexpected error in RPC fallback");
}
