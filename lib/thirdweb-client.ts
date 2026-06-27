// lib/thirdweb-client.ts
import { createThirdwebClient } from "thirdweb";

export const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
  // Batch near-simultaneous read calls into fewer HTTP requests so heavy pages
  // (lists/loops) stay under the RPC rate limit. Pure transport change — does
  // not alter call results or ordering, just adds up to 50ms of batching delay.
  config: {
    rpc: {
      maxBatchSize: 100,
      batchTimeoutMs: 50,
    },
  },
});
