// Diagnostic: list all companies in CompanyRegistry
const REGISTRY = "0x0626cCc3EBE9258C0769Ea1B42fdE23D58851a6F";
const RPC = "https://rpc-amoy.polygon.technology";
const EOA = "0x3471a2c061835561b86bf8d8664db7c1cb85948e";

async function rpc(method, params = []) {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  });
  const j = await r.json();
  if (j.error) throw new Error(JSON.stringify(j.error));
  return j.result;
}

function encode(sig) {
  // cheap 4-byte selector
  const { createHash } = require("crypto");
  return "0x" + createHash("sha3-256").update(sig).digest("hex").slice(0, 8);
}

async function call(to, data) {
  return rpc("eth_call", [{ to, data }, "latest"]);
}

// ABI-encode a uint256
function encodeUint256(n) {
  return BigInt(n).toString(16).padStart(64, "0");
}

// Parse address from 32-byte word
function decodeAddr(hex) {
  return "0x" + hex.slice(-40);
}

async function main() {
  // totalCompanies()  selector = keccak256("totalCompanies()")
  const { keccak256 } = await import("node:crypto").catch(() => ({ keccak256: null }));

  // Manual selector computation using sha3
  const { createHash } = require("crypto");
  const sel = (sig) => "0x" + createHash("sha3-256").update(sig).digest("hex").slice(0, 8);
  // Actually sha3-256 != keccak256. Use a lookup approach instead.
  // from Hardhat artifact or known selectors:
  const SEL_TOTAL = "0x4b6a18e8"; // totalCompanies()
  const SEL_GET   = "0x98afdfe3"; // getCompany(uint256)

  const totalHex = await call(REGISTRY, SEL_TOTAL);
  const total = parseInt(totalHex, 16);
  console.log(`Total companies on chain: ${total}\n`);

  for (let i = 1; i <= total; i++) {
    const param = encodeUint256(i);
    const raw = await call(REGISTRY, SEL_GET + param);
    // returns (address owner, address token, address sale, address vault, address distributor, string metadataURI, string sector, bool exists)
    // Each static word is 32 bytes (64 hex chars), starting at offset 2 (skip 0x)
    const data = raw.slice(2);
    const owner = decodeAddr(data.slice(0, 64));
    const token = decodeAddr(data.slice(64, 128));
    const exists = data.slice(7*64, 7*64+64).endsWith("1");
    console.log(`Company #${i}:`);
    console.log(`  owner  : ${owner}`);
    console.log(`  token  : ${token}`);
    console.log(`  exists : ${exists}`);
    console.log(`  MATCH EOA: ${owner.toLowerCase() === EOA}`);
    console.log();
  }
}

main().catch(console.error);
