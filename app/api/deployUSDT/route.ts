// app/api/deployUSDT/route.ts
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
  readContract,
} from "thirdweb";

import { deployContract } from "thirdweb/deploys";
import { polygonAmoy } from "thirdweb/chains";
import { privateKeyToAccount } from "thirdweb/wallets";

export async function POST() {
  try {
    // ============================================================
    // INIT
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

    log("🚀 Starting TestUSDT Deployment (Polygon Amoy)");
    log(`👤 Deployer: ${deployerAddress}`);

    // ============================================================
    // DEPLOY TestUSDT
    // ============================================================
    const usdtA = loadArtifact("TestUSDT.sol/MockUSDT");

    log("📦 Deploying TestUSDT...");
    const usdtAddr = await deployContract({
      client,
      chain,
      account,
      abi: usdtA.abi as Abi,
      bytecode: usdtA.bytecode as `0x${string}`,
    });
    log(`✅ TestUSDT deployed at: ${usdtAddr}`);

    // ============================================================
    // CREATE CONTRACT INSTANCE
    // ============================================================
    const usdtContract = getContract({
      client,
      chain,
      address: usdtAddr as `0x${string}`,
    });

    // ============================================================
    // READ totalSupply()
    // ============================================================
    log("💰 Reading totalSupply...");

    const totalSupply = (await readContract({
      contract: usdtContract,
      method: "function totalSupply() view returns (uint256)",
    })) as bigint;

    log(`🔢 Total Supply: ${totalSupply}`);

    // ============================================================
    // TRANSFER ALL SUPPLY TO DEPLOYER
    // ============================================================
    log("💸 Transferring supply to deployer...");

    const transferTx = await prepareContractCall({
      contract: usdtContract,
      method: "function transfer(address,uint256)",
      params: [deployerAddress, totalSupply],
    });

    await sendTransaction({ account, transaction: transferTx });
    log("✅ USDT transferred to deployer!");

    // ============================================================
    // DONE
    // ============================================================
    log("🎯 TestUSDT Deployment Complete!");

    return NextResponse.json({
      success: true,
      walletAddress: deployerAddress,
      usdtAddress: usdtAddr,
      logs,
    });
  } catch (error: any) {
    console.error("❌ Deployment failed:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
