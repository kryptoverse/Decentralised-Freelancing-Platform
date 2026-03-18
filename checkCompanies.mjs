import { createPublicClient, http, parseAbi } from "viem";
import { polygonAmoy } from "viem/chains";

const REGISTRY = "0x0626cCc3EBE9258C0769Ea1B42fdE23D58851a6F";
const EOA = "0x3471a2c061835561b86bf8d8664db7c1cb85948e".toLowerCase();

const client = createPublicClient({
  chain: polygonAmoy,
  transport: http("https://rpc-amoy.polygon.technology"),
});

const abi = parseAbi([
  "function totalCompanies() view returns (uint256)",
  "function getCompany(uint256) view returns (address owner, address token, address sale, address vault, address distributor, string metadataURI, string sector, bool exists)",
]);

const total = await client.readContract({ address: REGISTRY, abi, functionName: "totalCompanies" });
console.log(`Total companies: ${total}\n`);

for (let i = 1n; i <= total; i++) {
  const c = await client.readContract({ address: REGISTRY, abi, functionName: "getCompany", args: [i] });
  console.log(`Company #${i}:`);
  console.log(`  owner  : ${c.owner}`);
  console.log(`  token  : ${c.token}`);
  console.log(`  exists : ${c.exists}`);
  console.log(`  MATCH? : ${c.owner.toLowerCase() === EOA}`);
  console.log();
}
