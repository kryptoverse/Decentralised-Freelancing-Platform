// lib/thirdweb-client.ts
import { createThirdwebClient } from "thirdweb";
import { polygonAmoy } from "thirdweb/chains";

export const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
  config: {
    rpc: {
      // Use WebSocket RPC for event watching (avoids rate limits)
      [polygonAmoy.id]: process.env.NEXT_PUBLIC_INFURA_API_KEY
        ? `wss://polygon-amoy.infura.io/ws/v3/${process.env.NEXT_PUBLIC_INFURA_API_KEY}`
        : undefined,
    },
  },
});
