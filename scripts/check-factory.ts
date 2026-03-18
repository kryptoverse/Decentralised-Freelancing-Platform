import { createThirdwebClient } from "thirdweb";
import { polygonAmoy } from "thirdweb/chains";
import { getRpcClient, eth_getTransactionReceipt, eth_getLogs } from "thirdweb/rpc";

const client = createThirdwebClient({
  clientId: "2cd4f20689ec5136a0a4aa8a16e550d6",
});

// The most recent failed tx
const TX = "0xa40074dea40bce1040cffd3fa04cff030ecaf2377b5a60e51fa77dc2d5c79741";

// UserOperationEvent topic
const USER_OP_EVENT_TOPIC = "0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f";
// UserOperationRevertReason topic  
const REVERT_REASON_TOPIC = "0x1c4fada7374c0a9ee8841fc38afe82932dc0f8e69012e927f061a8bae611a201";

async function main() {
  const rpc = getRpcClient({ client, chain: polygonAmoy });
  const receipt = await eth_getTransactionReceipt(rpc, { hash: TX as any });
  
  console.log("=== TX Receipt ===");
  console.log("Status:", receipt?.status);
  console.log("Gas used:", receipt?.gasUsed?.toString());
  console.log("Total logs:", receipt?.logs?.length);
  
  for (const log of receipt?.logs || []) {
    const topic0 = log.topics?.[0];
    if (topic0 === USER_OP_EVENT_TOPIC) {
      console.log("\n=== UserOperationEvent ===");
      console.log("success field (data):", log.data);
    }
    if (topic0 === REVERT_REASON_TOPIC) {
      console.log("\n=== UserOperationRevertReason ===");
      console.log("Revert reason (hex):", log.data);
      // Try to decode
      if (log.data && log.data.length > 10) {
        try {
          const hex = log.data.slice(2);
          const text = Buffer.from(hex, "hex").toString("utf8");
          console.log("Decoded (attempt):", text.replace(/[^\x20-\x7E]/g, "."));
        } catch {}
      }
    }
    console.log("Log topic:", topic0?.substring(0, 20), "...");
  }
}

main().catch(console.error);
