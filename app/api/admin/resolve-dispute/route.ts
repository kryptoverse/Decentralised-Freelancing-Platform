import { NextRequest, NextResponse } from "next/server";
import { createThirdwebClient, getContract, prepareContractCall, sendTransaction } from "thirdweb";
import { privateKeyToAccount } from "thirdweb/wallets";
import { polygonAmoy } from "thirdweb/chains";

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

        // Create client and admin wallet
        const client = createThirdwebClient({
            secretKey: process.env.NEXT_PUBLIC_THIRDWEB_SECRET_KEY || "",
        });

        const adminWallet = privateKeyToAccount({
            client,
            privateKey,
        });

        // Get escrow contract
        const escrow = getContract({
            client,
            chain: polygonAmoy,
            address: escrowAddress as `0x${string}`,
        });

        // Determine resolution enum value
        // Resolution { PAYOUT, REFUND }
        let resolutionValue = 0; // PAYOUT
        if (outcome === "REFUND" || payoutBps === 0) {
            resolutionValue = 1; // REFUND
        }

        // Prepare transaction
        const transaction = prepareContractCall({
            contract: escrow,
            method: "function resolveDispute(uint16 payoutBps, uint8 rating, uint8 outcome)",
            params: [
                payoutBps || 0,
                rating || 3,
                resolutionValue,
            ],
        });

        // Send transaction
        const result = await sendTransaction({
            transaction,
            account: adminWallet,
        });

        return NextResponse.json({
            success: true,
            transactionHash: result.transactionHash,
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
