// Uses built-in Node 22 fetch, no external dependencies needed
async function check() {
  const HASH = "0x7a8de996a9d7c3d07454ae880f07edfd833a15d41cff3e35a2bc59b5bf6d92e1";
  const RPC = "https://rpc-amoy.polygon.technology";

  const receipt = await (await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [HASH] })
  })).json();

  const r = receipt.result;
  console.log("Tx status:", r?.status);
  console.log("Gas Used:", parseInt(r?.gasUsed,16).toLocaleString());
  console.log("Logs count:", r?.logs?.length || 0, "\n");

  // Known ERC-4337 topics
  const TOPICS = {
    "0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0e206a6aa26df166f271": "UserOperationEvent",
    "0x1c4fada7374a0a9a4a3d48a010e8f5d7e4a3f3c0c24d2c5e8c4f1e2d1b3a2c1": "UserOperationRevertReason",
    "0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0": "OwnershipTransferred",
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef": "Transfer",
  };

  for (const log of (r?.logs || [])) {
    const t = log.topics[0];
    const name = TOPICS[t] || "unknown";
    console.log(`Log: [${name}] addr=${log.address.substring(0,12)}...`);
    if (name === "UserOperationEvent") {
      // topic 4 (index 3) is the success bool
      const success = log.topics[3] !== "0x0000000000000000000000000000000000000000000000000000000000000000";
      console.log(">>> UserOp SUCCESS:", success);
      if (!success) console.log(">>> USEROP FAILED - RevertReason should be in the next log");
    }
    if (name === "UserOperationRevertReason") {
      // Decode: bytes32 userOpHash, address sender, uint256 nonce, bytes revertReason
      const data = log.data;
      console.log(">>> REVERT DATA:", data);
      // Try to decode the revert reason (skip first 3 ABI-encoded words = 96 bytes = 192 hex chars)
      try {
        const offset = 2 + 64*3; // skip bytes32+address+uint256
        const hexStr = data.slice(offset); 
        const buf = Buffer.from(hexStr, 'hex');
        // Try to decode as string
        const text = new TextDecoder().decode(buf).replace(/\0/g, '').trim();
        console.log(">>> REVERT REASON (text):", text);
      } catch(e) { console.log(">>> Failed to decode:", e.message); }
    }
  }
}
check().catch(console.error);
