import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";

const FREELANCER_FACTORY_ABI = [
    "function setKYCFor(address freelancer, bool status)",
];

async function waitForReceipt(
    provider: ethers.providers.Provider,
    txHash: string,
    maxWaitMs = 60000
) {
    const pollInterval = 3000;
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        await new Promise((r) => setTimeout(r, pollInterval));
        const receipt = await provider.getTransactionReceipt(txHash);
        if (receipt && receipt.blockNumber) return receipt;
    }
    throw new Error(`Timed out waiting for tx ${txHash}`);
}

export async function POST(request: Request) {
    try {
        // Check authentication
        const cookies = (request as any).cookies;
        const session = cookies?.get?.("admin_session");
        if (session?.value !== "authenticated") {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { freelancerAddress, approve } = await request.json();

        if (!freelancerAddress) {
            return NextResponse.json(
                { success: false, error: "Freelancer address is required" },
                { status: 400 }
            );
        }

        // Get private key from environment
        const privateKey = process.env.METAMASK_PRIVATE_KEY;
        if (!privateKey) {
            return NextResponse.json(
                { success: false, error: "METAMASK_PRIVATE_KEY not configured" },
                { status: 500 }
            );
        }

        const provider = new ethers.providers.StaticJsonRpcProvider(
            { url: "https://rpc-amoy.polygon.technology/", skipFetchSetup: true },
            80002
        );
        const wallet = new ethers.Wallet(privateKey, provider);

        const factory = new ethers.Contract(
            DEPLOYED_CONTRACTS.addresses.FreelancerFactory,
            FREELANCER_FACTORY_ABI,
            wallet
        );

        // Send the KYC transaction
        const gasPrice = await provider.getGasPrice();
        const gasLimit = await factory.estimateGas
            .setKYCFor(freelancerAddress, approve)
            .catch(() => ethers.BigNumber.from(200000));

        const tx = await factory.setKYCFor(freelancerAddress, approve, {
            gasPrice,
            gasLimit,
        });

        console.log(`KYC tx submitted: ${tx.hash}`);
        const receipt = await waitForReceipt(provider, tx.hash);

        return NextResponse.json({
            success: true,
            transactionHash: receipt.transactionHash,
            message: approve ? "KYC approved successfully" : "KYC revoked successfully",
        });
    } catch (error: any) {
        console.error("KYC update error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to update KYC status" },
            { status: 500 }
        );
    }
}
