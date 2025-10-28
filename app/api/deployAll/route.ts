// app/api/deployAll/route.ts
export const runtime = "nodejs"; // ✅ ensures Node runtime on Vercel

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { Abi } from "viem";
import {
  createThirdwebClient,
  getContract,
  prepareContractCall,
  sendTransaction,
} from "thirdweb";
import { deployContract } from "thirdweb/deploys";
import { polygonAmoy } from "thirdweb/chains";
import { privateKeyToAccount } from "thirdweb/wallets";

export async function POST() {
  try {
    // ✅ Initialize Thirdweb client with your secret key
    const client = createThirdwebClient({
      secretKey: process.env.NEXT_PUBLIC_THIRDWEB_SECRET_KEY!,
    });

    // ✅ Create an account from your Metamask private key
    const account = privateKeyToAccount({
      client,
      privateKey: process.env.METAMASK_PRIVATE_KEY as `0x${string}`,
    });

    const deployerAddress = account.address;
    console.log("👤 Deployer Wallet:", deployerAddress);

    const chain = polygonAmoy;
    const logs: string[] = [];
    const log = (msg: string) => {
      console.log(msg);
      logs.push(msg);
    };

    // ---------- 1️⃣ Deploy MockUSDT ----------
    const usdtArtifact = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), "artifacts/contracts/TestUSDT.sol/MockUSDT.json"),
        "utf8"
      )
    );
    log("🚀 Deploying MockUSDT...");
    const usdtAddr = await deployContract({
      client,
      chain,
      account,
      abi: usdtArtifact.abi as Abi,
      bytecode: usdtArtifact.bytecode as `0x${string}`,
    });
    log(`✅ MockUSDT deployed at: ${usdtAddr}`);

    // ---------- 2️⃣ Deploy FreelancerFactory ----------
    const freelancerFactoryArtifact = JSON.parse(
      fs.readFileSync(
        path.join(
          process.cwd(),
          "artifacts/contracts/FreelancerFactory.sol/FreelancerFactory.json"
        ),
        "utf8"
      )
    );
    log("\n🚀 Deploying FreelancerFactory...");
    const freelancerFactoryAddr = await deployContract({
      client,
      chain,
      account,
      abi: freelancerFactoryArtifact.abi as Abi,
      bytecode: freelancerFactoryArtifact.bytecode as `0x${string}`,
    });
    log(`✅ FreelancerFactory deployed at: ${freelancerFactoryAddr}`);

    // ---------- 3️⃣ Deploy EscrowFactory ----------
    const escrowFactoryArtifact = JSON.parse(
      fs.readFileSync(
        path.join(
          process.cwd(),
          "artifacts/contracts/EscrowFactory.sol/EscrowFactory.json"
        ),
        "utf8"
      )
    );

    const platformWallet = deployerAddress;
    const resolver = deployerAddress;
    const platformFeeBps = 200;

    log("\n🚀 Deploying EscrowFactory...");
    const escrowFactoryAddr = await deployContract({
      client,
      chain,
      account,
      abi: escrowFactoryArtifact.abi as Abi,
      bytecode: escrowFactoryArtifact.bytecode as `0x${string}`,
      constructorParams: {
        _freelancerFactory: freelancerFactoryAddr,
        _usdt: usdtAddr,
        _platformWallet: platformWallet,
        _platformFeeBps: platformFeeBps,
        _resolver: resolver,
      },
    });
    log(`✅ EscrowFactory deployed at: ${escrowFactoryAddr}`);

    // ---------- 4️⃣ Deploy JobBoard ----------
    const jobBoardArtifact = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), "artifacts/contracts/JobBoard.sol/JobBoard.json"),
        "utf8"
      )
    );
    log("\n🚀 Deploying JobBoard...");
    const jobBoardAddr = await deployContract({
      client,
      chain,
      account,
      abi: jobBoardArtifact.abi as Abi,
      bytecode: jobBoardArtifact.bytecode as `0x${string}`,
      constructorParams: { _owner: deployerAddress },
    });
    log(`✅ JobBoard deployed at: ${jobBoardAddr}`);

    // ---------- 5️⃣ Post-deployment wiring ----------
    const freelancerFactory = getContract({
      client,
      chain,
      address: freelancerFactoryAddr,
    });
    const jobBoard = getContract({
      client,
      chain,
      address: jobBoardAddr,
    });

    async function callTx(contract: any, method: string, params: any[]) {
      const tx = await prepareContractCall({ contract, method, params });
      await sendTransaction({ account, transaction: tx });
    }

    log("\n🔗 Authorizing EscrowFactory in FreelancerFactory...");
    await callTx(freelancerFactory, "function setEscrowDeployer(address,bool)", [
      escrowFactoryAddr,
      true,
    ]);
    log("✅ EscrowFactory authorized in FreelancerFactory");

    log("🔗 Allowing EscrowFactory in JobBoard...");
    await callTx(jobBoard, "function setAllowedFactory(address,bool)", [
      escrowFactoryAddr,
      true,
    ]);
    log("✅ EscrowFactory allowed in JobBoard");

    log("🔗 Setting USDT in JobBoard...");
    await callTx(jobBoard, "function setUSDC(address)", [usdtAddr]);
    log("✅ USDT set on JobBoard");

    log("\n============================================");
    log("🎯 Deployment Complete!");
    log(`MockUSDT:           ${usdtAddr}`);
    log(`FreelancerFactory:  ${freelancerFactoryAddr}`);
    log(`EscrowFactory:      ${escrowFactoryAddr}`);
    log(`JobBoard:           ${jobBoardAddr}`);
    log(`Owner/Treasury:     ${platformWallet}`);
    log(`Resolver:           ${resolver}`);
    log("============================================\n");

    return NextResponse.json({
      success: true,
      walletAddress: deployerAddress,
      logs,
      deployed: {
        MockUSDT: usdtAddr,
        FreelancerFactory: freelancerFactoryAddr,
        EscrowFactory: escrowFactoryAddr,
        JobBoard: jobBoardAddr,
      },
    });
  } catch (err: any) {
    console.error("❌ Deployment failed:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
