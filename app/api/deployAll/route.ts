// app/api/deployAll/route.ts
export const runtime = "nodejs";

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
    // ============================================================
    //  INIT
    // ============================================================
    const client = createThirdwebClient({
      secretKey: process.env.NEXT_PUBLIC_THIRDWEB_SECRET_KEY!,
    });

    const account = privateKeyToAccount({
      client,
      privateKey: process.env.METAMASK_PRIVATE_KEY as `0x${string}`,
    });

    const deployerAddress = account.address;
    const chain = polygonAmoy;

    console.log("👤 Deployer Wallet:", deployerAddress);

    const logs: string[] = [];
    const log = (msg: string) => {
      console.log(msg);
      logs.push(msg);
    };

    const loadArtifact = (file: string) =>
      JSON.parse(
        fs.readFileSync(
          path.join(process.cwd(), `artifacts/contracts/${file}.json`),
          "utf8"
        )
      );

    // ============================================================
    // 1️⃣ USE EXTERNAL USDT (no mock deployment)
    // ============================================================
    const usdtAddr = process.env.USDT_ADDRESS!;
    if (!usdtAddr) throw new Error("USDT_ADDRESS is missing in .env");

    log(`💰 Using external USDT token: ${usdtAddr}`);

    // ============================================================
    // 2️⃣ Deploy FreelancerFactory
    // ============================================================
    log("\n🚀 Deploying FreelancerFactory...");
    const ffA = loadArtifact("FreelancerFactory.sol/FreelancerFactory");
    const freelancerFactoryAddr = await deployContract({
      client,
      chain,
      account,
      abi: ffA.abi as Abi,
      bytecode: ffA.bytecode as `0x${string}`,
    });
    log(`✅ FreelancerFactory deployed at: ${freelancerFactoryAddr}`);

    // ============================================================
    // 3️⃣ Deploy ClientFactory
    // ============================================================
    log("\n🚀 Deploying ClientFactory...");
    const cfA = loadArtifact("ClientFactory.sol/ClientFactory");
    const clientFactoryAddr = await deployContract({
      client,
      chain,
      account,
      abi: cfA.abi as Abi,
      bytecode: cfA.bytecode as `0x${string}`,
    });
    log(`✅ ClientFactory deployed at: ${clientFactoryAddr}`);

    // ============================================================
    // 4️⃣ Deploy JobBoard
    // ============================================================
    log("\n🚀 Deploying JobBoard...");
    const jbA = loadArtifact("JobBoard.sol/JobBoard");
    const jobBoardAddr = await deployContract({
      client,
      chain,
      account,
      abi: jbA.abi as Abi,
      bytecode: jbA.bytecode as `0x${string}`,
      constructorParams: { _owner: deployerAddress },
    });
    log(`✅ JobBoard deployed at: ${jobBoardAddr}`);

    // ============================================================
    // 5️⃣ Deploy EscrowFactory (6 params!)
    // ============================================================
    log("\n🚀 Deploying EscrowFactory...");
    const efA = loadArtifact("EscrowFactory.sol/EscrowFactory");

    const platformWallet = deployerAddress;
    const resolver = deployerAddress;
    const platformFeeBps = 200;

    const escrowFactoryAddr = await deployContract({
      client,
      chain,
      account,
      abi: efA.abi as Abi,
      bytecode: efA.bytecode as `0x${string}`,
      constructorParams: {
        _freelancerFactory: freelancerFactoryAddr,
        _usdt: usdtAddr,                 // external USDT
        _platformWallet: platformWallet,
        _platformFeeBps: platformFeeBps,
        _resolver: resolver,
        _jobBoard: jobBoardAddr,         // REQUIRED NEW PARAM
      },
    });
    log(`✅ EscrowFactory deployed at: ${escrowFactoryAddr}`);

    // ============================================================
    // 6️⃣ Contract Objects
    // ============================================================
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

    const callTx = async (contract: any, method: string, params: any[]) => {
      const prepared = await prepareContractCall({
        contract,
        method,
        params,
      });
      await sendTransaction({ account, transaction: prepared });
    };

    // ============================================================
    // 🔗 Wiring Smart Contracts
    // ============================================================

    // 1. Authorize EscrowFactory inside FreelancerFactory
    log("\n🔗 Authorizing EscrowFactory in FreelancerFactory...");
    await callTx(
      freelancerFactory,
      "function setEscrowDeployer(address,bool)",
      [escrowFactoryAddr, true]
    );
    log("✅ EscrowFactory authorized in FreelancerFactory.");

    // 2. JobBoard → allow EscrowFactory to call markAsHired()
    log("🔗 Allowing EscrowFactory in JobBoard...");
    await callTx(
      jobBoard,
      "function setAllowedFactory(address,bool)",
      [escrowFactoryAddr, true]
    );
    log("✅ EscrowFactory allowed in JobBoard.");

    // 3. JobBoard → set external USDT token
    log("🔗 Setting USDT in JobBoard...");
    await callTx(jobBoard, "function setUSDC(address)", [usdtAddr]);
    log("✅ USDT set in JobBoard.");

    // 4. Optionally remove application requirement
    log("🔗 Disabling requireApplicationToHire...");
    await callTx(jobBoard, "function setRequireApplicationToHire(bool)", [
      false,
    ]);
    log("✅ requireApplicationToHire disabled.");

    // ============================================================
    // DONE
    // ============================================================
    log("\n============================================");
    log("🎯 Deployment Complete!");
    log(`USDT:               ${usdtAddr}`);
    log(`FreelancerFactory:  ${freelancerFactoryAddr}`);
    log(`ClientFactory:      ${clientFactoryAddr}`);
    log(`JobBoard:           ${jobBoardAddr}`);
    log(`EscrowFactory:      ${escrowFactoryAddr}`);
    log("============================================\n");

    return NextResponse.json({
      success: true,
      walletAddress: deployerAddress,
      logs,
      deployed: {
        USDT: usdtAddr,
        FreelancerFactory: freelancerFactoryAddr,
        ClientFactory: clientFactoryAddr,
        JobBoard: jobBoardAddr,
        EscrowFactory: escrowFactoryAddr,
      },
    });
  } catch (error: any) {
    console.error("❌ Deployment failed:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
