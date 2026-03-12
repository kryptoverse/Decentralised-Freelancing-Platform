import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

const ESCROW_ABI = [
    "function resolveDispute(uint16 payoutBps, uint8 rating, uint8 outcome)",
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

export async function POST(req: NextRequest) {
    try {
        // Check authentication
        const session = req.cookies.get("admin_session");
        if (session?.value !== "authenticated") {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { escrowAddress, outcome, payoutBps, rating } = await req.json();

        if (!escrowAddress) {
            return NextResponse.json(
                { success: false, error: "Escrow address required" },
                { status: 400 }
            );
        }

        // Get admin private key
        const privateKey = process.env.METAMASK_PRIVATE_KEY;
        if (!privateKey) {
            return NextResponse.json(
                { success: false, error: "Admin wallet not configured" },
                { status: 500 }
            );
        }

        const provider = new ethers.providers.StaticJsonRpcProvider(
            { url: "https://rpc-amoy.polygon.technology/", skipFetchSetup: true },
            80002
        );
        const wallet = new ethers.Wallet(privateKey, provider);

        const escrow = new ethers.Contract(escrowAddress, ESCROW_ABI, wallet);

        // Resolution enum: 0 = PAYOUT, 1 = REFUND
        const resolutionValue = outcome === "REFUND" || payoutBps === 0 ? 1 : 0;

        const gasPrice = await provider.getGasPrice();
        const gasLimit = await escrow.estimateGas
            .resolveDispute(payoutBps || 0, rating || 3, resolutionValue)
            .catch(() => ethers.BigNumber.from(300000));

        const tx = await escrow.resolveDispute(
            payoutBps || 0,
            rating || 3,
            resolutionValue,
            { gasPrice, gasLimit }
        );

        console.log(`Resolve dispute tx: ${tx.hash}`);
        const receipt = await waitForReceipt(provider, tx.hash);

        return NextResponse.json({
            success: true,
            transactionHash: receipt.transactionHash,
            message: "Dispute resolved successfully",
        });
    } catch (error: any) {
        console.error("Error resolving dispute:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to resolve dispute" },
            { status: 500 }
        );
    }
}
