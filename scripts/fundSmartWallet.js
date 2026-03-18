/**
 * fundSmartWallet.js
 * 
 * Sends MATIC from the deployer EOA to a target smart wallet address
 * so it can pay for heavy gas transactions like createCompany (~0.15 MATIC).
 *
 * Usage:
 *   node scripts/fundSmartWallet.js <smartWalletAddress> [amountInMATIC]
 *
 * Example:
 *   node scripts/fundSmartWallet.js 0x657845e6E119... 0.2
 */

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

// Load .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
}

async function main() {
    const targetAddr = process.argv[2];
    const amountMatic = process.argv[3] || "0.2";

    if (!targetAddr || !ethers.utils.isAddress(targetAddr)) {
        console.error("Usage: node scripts/fundSmartWallet.js <smartWalletAddress> [amountInMATIC]");
        process.exit(1);
    }

    const rpcUrl = "https://rpc-amoy.polygon.technology/";
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl, 80002);
    const wallet = new ethers.Wallet(process.env.METAMASK_PRIVATE_KEY, provider);

    const from = wallet.address;
    const to = ethers.utils.getAddress(targetAddr);
    const value = ethers.utils.parseEther(amountMatic);

    const fromBalance = await provider.getBalance(from);
    const toBalanceBefore = await provider.getBalance(to);
    const gasPrice = await provider.getGasPrice();

    console.log("=== Fund Smart Wallet ===");
    console.log("From (deployer EOA):", from);
    console.log("  Balance:", ethers.utils.formatEther(fromBalance), "MATIC");
    console.log("To (smart wallet):", to);
    console.log("  Balance before:", ethers.utils.formatEther(toBalanceBefore), "MATIC");
    console.log("Amount to send:", amountMatic, "MATIC");
    console.log("Gas price:", ethers.utils.formatUnits(gasPrice, "gwei"), "gwei");

    if (fromBalance.lt(value.add(gasPrice.mul(21000)))) {
        console.error("❌ Insufficient balance in deployer wallet to send", amountMatic, "MATIC");
        process.exit(1);
    }

    console.log("\nSending...");
    const tx = await wallet.sendTransaction({
        to,
        value,
        gasLimit: 21000,
        gasPrice,
    });
    console.log("TX hash:", tx.hash);
    await tx.wait();

    const toBalanceAfter = await provider.getBalance(to);
    console.log("\n✅ Done!");
    console.log("Smart wallet MATIC balance:", ethers.utils.formatEther(toBalanceAfter), "MATIC");
    console.log("\nThe wallet now has enough MATIC to cover createCompany gas costs (~0.13 MATIC).");
    console.log("Try creating the company again in the browser.");
}

main().catch(err => {
    console.error("Error:", err.message);
    process.exit(1);
});
