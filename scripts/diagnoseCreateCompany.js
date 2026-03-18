const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

// Load .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (key && !process.env[key]) process.env[key] = val;
    }
}

async function main() {
    const deployed = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "constants/deployedContracts.json"), "utf8")
    );

    const rpcUrl = "https://rpc-amoy.polygon.technology/";
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl, 80002);
    const wallet = new ethers.Wallet(process.env.METAMASK_PRIVATE_KEY, provider);

    console.log("=== CREATE COMPANY DIAGNOSTICS ===\n");
    console.log("Deployer/Wallet address:", wallet.address);

    // ─── 1. Check MATIC balances ──────────────────────────────────────────────
    const maticBal = await provider.getBalance(wallet.address);
    console.log("EOA MATIC balance:", ethers.utils.formatEther(maticBal), "MATIC");

    // ─── 2. Check if FreelancerFactory.companyRegistry is set correctly ───────
    const ffAbi = [
        "function companyRegistry() view returns (address)",
        "function freelancerProfile(address) view returns (address)",
    ];
    const ff = new ethers.Contract(deployed.addresses.FreelancerFactory, ffAbi, provider);
    const registryOnFF = await ff.companyRegistry();
    console.log("\nFreelancerFactory.companyRegistry:", registryOnFF);
    console.log("Expected CompanyRegistry:         ", deployed.addresses.CompanyRegistry);
    console.log("Match:", registryOnFF.toLowerCase() === deployed.addresses.CompanyRegistry.toLowerCase() ? "✅ YES" : "❌ NO — WIRING BROKEN");

    // ─── 3. Check freelancer profile for the wallet ───────────────────────────
    const profileAddr = await ff.freelancerProfile(wallet.address);
    console.log("\nFreelancerProfile for deployer:", profileAddr);
    console.log(profileAddr === ethers.constants.AddressZero ? "❌ NO PROFILE — must create one first" : "✅ Profile exists");

    // ─── 4. Decode the most recent failed tx ─────────────────────────────────
    const TX_HASH = process.argv[2];
    if (TX_HASH) {
        console.log("\n=== Decoding TX:", TX_HASH, "===");
        try {
            const tx = await provider.getTransaction(TX_HASH);
            const receipt = await provider.getTransactionReceipt(TX_HASH);
            console.log("Status:", receipt.status === 1 ? "Success" : "Reverted");
            console.log("Gas used:", receipt.gasUsed.toString());
            console.log("Gas limit supplied:", tx.gasLimit.toString());

            if (receipt.status === 0) {
                // Try eth_call replay to get revert reason
                try {
                    await provider.call({ to: tx.to, data: tx.data, from: tx.from }, tx.blockNumber);
                } catch (callErr) {
                    console.log("Revert reason (eth_call replay):", callErr.reason || callErr.message);
                }
            }
        } catch (e) {
            console.log("Could not fetch tx:", e.message);
        }
    } else {
        console.log("\nTip: pass a tx hash as argument to decode it:");
        console.log("  node scripts/diagnoseCreateCompany.js 0x...");
    }

    // ─── 5. Simulate createCompany via eth_call ───────────────────────────────
    console.log("\n=== Simulating createCompany via eth_call ===");
    const crAbi = [
        "function createCompany(string,string,string,string) returns (uint256)",
        "function ownerToCompanyId(address) view returns (uint256)",
    ];
    const registry = new ethers.Contract(deployed.addresses.CompanyRegistry, crAbi, provider);

    const myCompanyId = await registry.ownerToCompanyId(wallet.address);
    console.log("Existing companyId for this wallet:", myCompanyId.toString(), myCompanyId.gt(0) ? "(already has a company!)" : "(no company yet)");

    if (myCompanyId.eq(0) && profileAddr !== ethers.constants.AddressZero) {
        try {
            await registry.callStatic.createCompany("TestCo", "TEST", "ipfs://Qm000", "Tech", { from: wallet.address, gasLimit: 8000000 });
            console.log("✅ Simulation succeeded — transaction SHOULD work");
        } catch (simErr) {
            console.log("❌ Simulation REVERTED:", simErr.reason || simErr.message);
        }
    }
}

main().catch(err => { console.error("Script error:", err.message); process.exit(1); });
