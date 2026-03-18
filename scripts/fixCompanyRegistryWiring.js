const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

// Load .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (key && !process.env[key]) process.env[key] = val;
    }
}

async function waitForReceipt(provider, txHash, maxWaitMs = 60000) {
    const pollInterval = 3000;
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        await new Promise(r => setTimeout(r, pollInterval));
        const receipt = await provider.getTransactionReceipt(txHash);
        if (receipt && receipt.blockNumber) return receipt;
    }
    throw new Error(`Timed out waiting for tx ${txHash}`);
}

async function main() {
    const deployed = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "constants/deployedContracts.json"), "utf8")
    );

    const freelancerFactoryAddr = deployed.addresses.FreelancerFactory;
    const companyRegistryAddr   = deployed.addresses.CompanyRegistry;

    console.log("FreelancerFactory:", freelancerFactoryAddr);
    console.log("CompanyRegistry:  ", companyRegistryAddr);

    const rpcUrl = "https://rpc-amoy.polygon.technology/";
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl, 80002);
    const wallet = new ethers.Wallet(process.env.METAMASK_PRIVATE_KEY, provider);

    const ffAbi = [
        "function companyRegistry() view returns (address)",
        "function setCompanyRegistry(address _registry) external",
    ];
    const freelancerFactory = new ethers.Contract(freelancerFactoryAddr, ffAbi, wallet);

    // Check current state
    const current = await freelancerFactory.companyRegistry();
    console.log("\nCurrent companyRegistry on FreelancerFactory:", current);

    if (current.toLowerCase() === companyRegistryAddr.toLowerCase()) {
        console.log("✅ Already correctly wired! No action needed.");
        return;
    }

    console.log("\n🔗 Calling setCompanyRegistry...");
    const gasPrice = await provider.getGasPrice();
    const tx = await freelancerFactory.setCompanyRegistry(companyRegistryAddr, {
        gasLimit: 100000,
        gasPrice,
    });
    console.log("📤 TX submitted:", tx.hash);
    await waitForReceipt(provider, tx.hash);
    console.log("✅ Done! FreelancerFactory is now wired to CompanyRegistry.");
    
    // Verify
    const after = await freelancerFactory.companyRegistry();
    console.log("Verified companyRegistry:", after);
}

main().catch(err => {
    console.error("❌ Error:", err.message);
    process.exit(1);
});
