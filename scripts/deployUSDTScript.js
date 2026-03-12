const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

// Manually load .env.local
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

// Manual polling helper - avoids ethers' built-in polling which breaks on some RPCs
async function waitForReceipt(provider, txHash, maxWaitMs = 120000) {
    const pollInterval = 3000;
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        await new Promise(r => setTimeout(r, pollInterval));
        const receipt = await provider.getTransactionReceipt(txHash);
        if (receipt && receipt.blockNumber) {
            return receipt;
        }
    }
    throw new Error(`Timed out waiting for tx ${txHash}`);
}

async function deployContract(factory, ...args) {
    const deployTx = factory.getDeployTransaction(...args);
    const wallet = factory.signer;
    const provider = wallet.provider;

    // Estimate gas
    const gasLimit = await provider.estimateGas({ ...deployTx, from: wallet.address }).catch(() => ethers.BigNumber.from(5000000));
    const gasPrice = await provider.getGasPrice();

    // Send raw transaction
    const tx = await wallet.sendTransaction({
        ...deployTx,
        gasLimit: gasLimit.mul(120).div(100), // +20% buffer
        gasPrice,
    });

    console.log(`  📤 TX submitted: ${tx.hash}`);

    // Poll manually for receipt
    const receipt = await waitForReceipt(provider, tx.hash);

    if (!receipt.contractAddress) {
        throw new Error(`No contract address in receipt for tx ${tx.hash}`);
    }

    // Return a contract instance
    return new ethers.Contract(receipt.contractAddress, factory.interface, wallet);
}

async function main() {
    try {
        const rpcUrl = "https://rpc-amoy.polygon.technology/";
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl, 80002);
        const wallet = new ethers.Wallet(process.env.METAMASK_PRIVATE_KEY, provider);
        const deployerAddress = wallet.address;

        const logs = [];
        const log = (msg) => { console.log(msg); logs.push(msg); };

        const loadArtifact = (file) =>
            JSON.parse(fs.readFileSync(path.join(process.cwd(), `artifacts/contracts/${file}.json`), "utf8"));

        log("🚀 Starting TestUSDT Deployment (Polygon Amoy)");
        log(`👤 Deployer: ${deployerAddress}`);

        const usdtA = loadArtifact("CompanyShares/TestUSDT.sol/TestUSDT");
        log("📦 Deploying TestUSDT...");
        const USDTFactory = new ethers.ContractFactory(usdtA.abi, usdtA.bytecode, wallet);
        const usdtContract = await deployContract(USDTFactory);
        const usdtAddr = usdtContract.address;
        log(`✅ TestUSDT deployed at: ${usdtAddr}`);

        log("💰 Reading totalSupply...");
        const totalSupply = await usdtContract.totalSupply();
        log(`🔢 Total Supply: ${totalSupply.toString()}`);

        log("💸 Transferring supply to deployer...");
        const transferRawTx = await wallet.sendTransaction({
            to: usdtAddr,
            data: usdtContract.interface.encodeFunctionData("transfer", [deployerAddress, totalSupply]),
            gasLimit: 100000,
            gasPrice: await provider.getGasPrice(),
        });
        await waitForReceipt(provider, transferRawTx.hash);
        log("✅ USDT transferred to deployer!");
        log("🎯 TestUSDT Deployment Complete!");

        console.log(JSON.stringify({
            __RESULT: { success: true, walletAddress: deployerAddress, usdtAddress: usdtAddr, logs }
        }));
    } catch (error) {
        console.error("❌ Deployment failed:", error.message);
        console.log(JSON.stringify({ __RESULT: { success: false, error: error.message } }));
        process.exit(1);
    }
}
main();
