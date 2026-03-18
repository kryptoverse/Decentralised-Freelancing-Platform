import { createPublicClient, http, parseAbi } from "viem";
import { polygonAmoy } from "viem/chains";

import fs from "fs";
const deployedContracts = JSON.parse(fs.readFileSync("./constants/deployedContracts.json", "utf-8"));

const REGISTRY = deployedContracts.addresses.CompanyRegistry;
const FACTORY = deployedContracts.addresses.FreelancerFactory;
const USDT = deployedContracts.addresses.MockUSDT;
const EOA = "0x3471a2c061835561b86bf8d8664db7c1cb85948e".toLowerCase();
const SMART_WALLET = "0x657845e6E119A5a3726E19488AcaB6837610606f".toLowerCase();

const client = createPublicClient({
  chain: polygonAmoy,
  transport: http("https://polygon-amoy.g.alchemy.com/v2/yD--Z1fU1Yq8R-C_RzUINt0mXjONLnyS"),
});

const abi = parseAbi([
  "function totalCompanies() view returns (uint256)",
  "function getCompany(uint256) view returns (address owner, address token, address sale, address vault, address distributor, string metadataURI, string sector, bool exists)",
  "function freelancerProfile(address) view returns (address)",
  "function companyVault() view returns (address)",
  "function balanceOf(address) view returns (uint256)",
  "function totalRevenue() view returns (uint256)",
  "function ownerWithdrawable() view returns (uint256)",
]);

async function main() {
  console.log("=== DIAGNOSTICS ===");
  
  // 1. Check Profile
  const profileAddr = await client.readContract({ address: FACTORY, abi, functionName: "freelancerProfile", args: [SMART_WALLET] });
  console.log(`Smart Wallet Profile: ${profileAddr}`);

  if (profileAddr !== "0x0000000000000000000000000000000000000000") {
     const linkedVault = await client.readContract({ address: profileAddr, abi, functionName: "companyVault" });
     console.log(`Profile Linked Vault: ${linkedVault}`);
  }

  // 2. Check Companies owned by EOA
  const total = await client.readContract({ address: REGISTRY, abi, functionName: "totalCompanies" });
  console.log(`\nTotal companies: ${total}`);

  for (let i = 1n; i <= total; i++) {
    const c = await client.readContract({ address: REGISTRY, abi, functionName: "getCompany", args: [i] });
    if (c.owner.toLowerCase() === EOA) {
        console.log(`\n[FOUND] EOA Company #${i}:`);
        console.log(`  owner  : ${c.owner}`);
        console.log(`  vault  : ${c.vault}`);
        
        const vaultUsdt = await client.readContract({ address: USDT, abi, functionName: "balanceOf", args: [c.vault] });
        console.log(`  Vault USDT Balance: ${Number(vaultUsdt) / 1e6}`);

        const totalRev = await client.readContract({ address: c.vault, abi, functionName: "totalRevenue" });
        console.log(`  Vault Total Revenue: ${Number(totalRev) / 1e6}`);

        const ownerWithdraw = await client.readContract({ address: c.vault, abi, functionName: "ownerWithdrawable" });
        console.log(`  Vault Owner Withdrawable: ${Number(ownerWithdraw) / 1e6}`);
    }
  }

  // 3. Check Smart Wallet Balance
  const swUsdt = await client.readContract({ address: USDT, abi, functionName: "balanceOf", args: [SMART_WALLET] });
  console.log(`\nSmart Wallet USDT Balance: ${Number(swUsdt) / 1e6}`);
}

main().catch(console.error);
