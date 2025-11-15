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
    // 1️⃣ Deploy MockUSDT
    // ============================================================
    log("🚀 Deploying MockUSDT...");
    const usdtA = loadArtifact("TestUSDT.sol/MockUSDT");
    const usdtAddr = await deployContract({
      client,
      chain,
      account,
      abi: usdtA.abi as Abi,
      bytecode: usdtA.bytecode as `0x${string}`,
    });
    log(`✅ MockUSDT deployed at: ${usdtAddr}`);

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
    // 3️⃣ Deploy ClientFactory (NEW)
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
    // 4️⃣ Deploy EscrowFactory
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
        _usdt: usdtAddr,
        _platformWallet: platformWallet,
        _platformFeeBps: platformFeeBps,
        _resolver: resolver,
      },
    });
    log(`✅ EscrowFactory deployed at: ${escrowFactoryAddr}`);

    // ============================================================
    // 5️⃣ Deploy JobBoard
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
    // 6️⃣ Setup contract objects
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
    // 🔗 Wiring
    // ============================================================

    // 1. FreelancerFactory → EscrowFactory
    log("\n🔗 Authorizing EscrowFactory in FreelancerFactory...");
    await callTx(
      freelancerFactory,
      "function setEscrowDeployer(address,bool)",
      [escrowFactoryAddr, true]
    );
    log("✅ FreelancerFactory wired.");

    // 2. JobBoard → allow EscrowFactory
    log("🔗 Allowing EscrowFactory in JobBoard...");
    await callTx(
      jobBoard,
      "function setAllowedFactory(address,bool)",
      [escrowFactoryAddr, true]
    );
    log("✅ EscrowFactory allowed in JobBoard.");

    // 3. JobBoard → set USDT token
    log("🔗 Setting USDT on JobBoard...");
    await callTx(jobBoard, "function setUSDC(address)", [usdtAddr]);
    log("✅ USDT set on JobBoard");

    // 4. Disable hiring application requirement
    log("🔗 Disabling requireApplicationToHire...");
    await callTx(jobBoard, "function setRequireApplicationToHire(bool)", [
      false,
    ]);
    log("✅ Hiring restriction disabled");

    // ============================================================
    // DONE
    // ============================================================
    log("\n============================================");
    log("🎯 Deployment Complete!");
    log(`MockUSDT:           ${usdtAddr}`);
    log(`FreelancerFactory:  ${freelancerFactoryAddr}`);
    log(`ClientFactory:      ${clientFactoryAddr}`);
    log(`EscrowFactory:      ${escrowFactoryAddr}`);
    log(`JobBoard:           ${jobBoardAddr}`);
    log("============================================\n");

    return NextResponse.json({
      success: true,
      walletAddress: deployerAddress,
      logs,
      deployed: {
        MockUSDT: usdtAddr,
        FreelancerFactory: freelancerFactoryAddr,
        ClientFactory: clientFactoryAddr,
        EscrowFactory: escrowFactoryAddr,
        JobBoard: jobBoardAddr,
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
