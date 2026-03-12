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
        if (receipt && receipt.blockNumber) return receipt;
    }
    throw new Error(`Timed out waiting for tx ${txHash}`);
}

async function deployContract(factory, ...args) {
    const deployTx = factory.getDeployTransaction(...args);
    const wallet = factory.signer;
    const provider = wallet.provider;
    const gasLimit = await provider.estimateGas({ ...deployTx, from: wallet.address }).catch(() => ethers.BigNumber.from(5000000));
    const gasPrice = await provider.getGasPrice();
    const tx = await wallet.sendTransaction({
        ...deployTx,
        gasLimit: gasLimit.mul(120).div(100),
        gasPrice,
    });
    console.log(`  📤 TX submitted: ${tx.hash}`);
    const receipt = await waitForReceipt(provider, tx.hash);
    if (!receipt.contractAddress) throw new Error(`No contract address in receipt for tx ${tx.hash}`);
    return new ethers.Contract(receipt.contractAddress, factory.interface, wallet);
}

async function callContract(contract, method, ...args) {
    const wallet = contract.signer;
    const provider = wallet.provider;
    const gasPrice = await provider.getGasPrice();
    const gasLimit = await contract.estimateGas[method](...args).catch(() => ethers.BigNumber.from(200000));
    const tx = await contract[method](...args, { gasLimit, gasPrice });
    console.log(`  📤 ${method} TX: ${tx.hash}`);
    await waitForReceipt(provider, tx.hash);
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

        const usdtAddr = process.env.USDT_ADDRESS;
        if (!usdtAddr) throw new Error("USDT_ADDRESS is missing in .env.local");

        log(`💰 Using external USDT token: ${usdtAddr}`);

        log("\n🚀 Deploying FreelancerFactory...");
        const ffA = loadArtifact("Freelancing/FreelancerFactory.sol/FreelancerFactory");
        const freelancerFactory = await deployContract(new ethers.ContractFactory(ffA.abi, ffA.bytecode, wallet));
        const freelancerFactoryAddr = freelancerFactory.address;
        log(`✅ FreelancerFactory deployed at: ${freelancerFactoryAddr}`);

        log("\n🚀 Deploying ClientFactory...");
        const cfA = loadArtifact("Freelancing/ClientFactory.sol/ClientFactory");
        const clientFactory = await deployContract(new ethers.ContractFactory(cfA.abi, cfA.bytecode, wallet));
        const clientFactoryAddr = clientFactory.address;
        log(`✅ ClientFactory deployed at: ${clientFactoryAddr}`);

        log("\n🚀 Deploying JobBoard...");
        const jbA = loadArtifact("Freelancing/JobBoard.sol/JobBoard");
        const jobBoard = await deployContract(new ethers.ContractFactory(jbA.abi, jbA.bytecode, wallet), deployerAddress);
        const jobBoardAddr = jobBoard.address;
        log(`✅ JobBoard deployed at: ${jobBoardAddr}`);

        log("\n🚀 Deploying EscrowFactory...");
        const efA = loadArtifact("Freelancing/EscrowFactory.sol/EscrowFactory");
        const platformWallet = deployerAddress;
        const resolver = deployerAddress;
        const platformFeeBps = 200;
        const escrowFactory = await deployContract(
            new ethers.ContractFactory(efA.abi, efA.bytecode, wallet),
            freelancerFactoryAddr, usdtAddr, platformWallet, platformFeeBps, resolver, jobBoardAddr
        );
        const escrowFactoryAddr = escrowFactory.address;
        log(`✅ EscrowFactory deployed at: ${escrowFactoryAddr}`);

        log("\n🚀 Deploying CompanyRegistry...");
        const crA = loadArtifact("CompanyShares/CompanyRegistry.sol/CompanyRegistry");
        const companyRegistry = await deployContract(
            new ethers.ContractFactory(crA.abi, crA.bytecode, wallet),
            usdtAddr, platformFeeBps, platformWallet, freelancerFactoryAddr
        );
        const companyRegistryAddr = companyRegistry.address;
        log(`✅ CompanyRegistry deployed at: ${companyRegistryAddr}`);

        log("\n🔍 Getting Auto-Deployed InvestorRegistry address...");
        const investorRegistryAddr = await companyRegistry.investorRegistry();
        log(`✅ InvestorRegistry found at: ${investorRegistryAddr}`);

        log("\n🚀 Deploying FundraiseFactory...");
        const funA = loadArtifact("Freelancing/FundraiseFactory.sol/FundraiseFactory");
        const fundraiseFactory = await deployContract(
            new ethers.ContractFactory(funA.abi, funA.bytecode, wallet),
            ethers.constants.AddressZero,
            investorRegistryAddr
        );
        const fundraiseFactoryAddr = fundraiseFactory.address;
        log(`✅ FundraiseFactory deployed at: ${fundraiseFactoryAddr}`);

        log("\n🔗 Wiring Investor Registry back to FundraiseFactory...");
        // CompanyRegistry auto-deploys InvestorRegistry and the deployer (this script) is the owner
        const irA = loadArtifact("CompanyShares/InvestorRegistry.sol/InvestorRegistry");
        const investorRegistry = new ethers.Contract(investorRegistryAddr, irA.abi, wallet);
        await callContract(investorRegistry, "setRegistries", companyRegistryAddr, fundraiseFactoryAddr);
        log("✅ InvestorRegistry successfully cross-linked.");

        log("\n🔗 Authorizing EscrowFactory in FreelancerFactory...");
        await callContract(freelancerFactory, "setEscrowDeployer", escrowFactoryAddr, true);
        log("✅ EscrowFactory authorized.");

        log("🔗 Authorizing CompanyRegistry in FreelancerFactory...");
        await callContract(freelancerFactory, "setCompanyRegistry", companyRegistryAddr);
        log("✅ CompanyRegistry authorized.");

        log("🔗 Allowing EscrowFactory in JobBoard...");
        await callContract(jobBoard, "setAllowedFactory", escrowFactoryAddr, true);
        log("✅ EscrowFactory allowed in JobBoard.");

        log("🔗 Setting USDT in JobBoard...");
        await callContract(jobBoard, "setUSDC", usdtAddr);
        log("✅ USDT set in JobBoard.");

        log("🔗 Disabling requireApplicationToHire...");
        await callContract(jobBoard, "setRequireApplicationToHire", false);
        log("✅ Done.");

        log("\n🎯 Deployment Complete!");
        log(`USDT:               ${usdtAddr}`);
        log(`FreelancerFactory:  ${freelancerFactoryAddr}`);
        log(`ClientFactory:      ${clientFactoryAddr}`);
        log(`JobBoard:           ${jobBoardAddr}`);
        log(`EscrowFactory:      ${escrowFactoryAddr}`);
        log(`FundraiseFactory:   ${fundraiseFactoryAddr}`);
        log(`CompanyRegistry:    ${companyRegistryAddr}`);
        log(`InvestorRegistry:   ${investorRegistryAddr}`);

        console.log(JSON.stringify({
            __RESULT: {
                success: true,
                walletAddress: deployerAddress,
                logs,
                deployed: {
                    USDT: usdtAddr,
                    FreelancerFactory: freelancerFactoryAddr,
                    ClientFactory: clientFactoryAddr,
                    JobBoard: jobBoardAddr,
                    EscrowFactory: escrowFactoryAddr,
                    FundraiseFactory: fundraiseFactoryAddr,
                    CompanyRegistry: companyRegistryAddr,
                    InvestorRegistry: investorRegistryAddr,
                }
            }
        }));
    } catch (error) {
        console.error("❌ Deployment failed:", error.message);
        console.log(JSON.stringify({ __RESULT: { success: false, error: error.message } }));
        process.exit(1);
    }
}
main();
