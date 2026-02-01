import { NextResponse } from "next/server";
import { createThirdwebClient, getContract, prepareContractCall, sendTransaction } from "thirdweb";
import { privateKeyToAccount } from "thirdweb/wallets";
import { polygonAmoy } from "thirdweb/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";

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

        // Create client
        const client = createThirdwebClient({
            secretKey: process.env.NEXT_PUBLIC_THIRDWEB_SECRET_KEY as string,
        });

        // Create wallet from private key
        const account = privateKeyToAccount({
            client,
            privateKey: privateKey as `0x${string}`,
        });

        // Get FreelancerFactory contract
        const factory = getContract({
            client,
            chain: polygonAmoy,
            address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory,
        });

        // Prepare transaction to set KYC
        const transaction = prepareContractCall({
            contract: factory,
            method: "function setKYCFor(address freelancer, bool status)",
            params: [freelancerAddress as `0x${string}`, approve],
        });

        // Send transaction
        const result = await sendTransaction({
            transaction,
            account,
        });

        return NextResponse.json({
            success: true,
            transactionHash: result.transactionHash,
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
