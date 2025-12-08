import { NextRequest, NextResponse } from "next/server";
import { createThirdwebClient, getContract, prepareContractCall, sendTransaction } from "thirdweb";
import { privateKeyToAccount } from "thirdweb/wallets";
import { polygonAmoy } from "thirdweb/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";

// Rate limiting: store last request time per address
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: NextRequest) {
    try {
        const { recipientAddress } = await req.json();

        if (!recipientAddress || !recipientAddress.startsWith("0x")) {
            return NextResponse.json(
                { error: "Invalid recipient address" },
                { status: 400 }
            );
        }

        // Rate limiting check
        const now = Date.now();
        const lastRequest = rateLimitMap.get(recipientAddress.toLowerCase());
        if (lastRequest && now - lastRequest < RATE_LIMIT_MS) {
            const remainingMs = RATE_LIMIT_MS - (now - lastRequest);
            const remainingMin = Math.ceil(remainingMs / 60000);
            return NextResponse.json(
                { error: `Please wait ${remainingMin} minutes before requesting again` },
                { status: 429 }
            );
        }

        // Get private key from environment
        const privateKey = process.env.METAMASK_PRIVATE_KEY;
        if (!privateKey) {
            return NextResponse.json(
                { error: "Faucet not configured" },
                { status: 500 }
            );
        }

        // Create client and wallet
        const client = createThirdwebClient({
            secretKey: process.env.NEXT_PUBLIC_THIRDWEB_SECRET_KEY || "",
        });

        const faucetWallet = privateKeyToAccount({
            client,
            privateKey,
        });

        // Check faucet balance before sending
        const { getWalletBalance } = await import("thirdweb/wallets");

        const maticBalance = await getWalletBalance({
            client,
            chain: polygonAmoy,
            address: faucetWallet.address,
        });

        const maticAmount = parseFloat(maticBalance.displayValue);
        if (maticAmount < 0.5) {
            return NextResponse.json(
                { error: "Faucet has insufficient MATIC balance" },
                { status: 503 }
            );
        }

        // Get USDT contract
        const usdtContract = getContract({
            client,
            chain: polygonAmoy,
            address: DEPLOYED_CONTRACTS.addresses.MockUSDT,
        });

        // Check USDT balance
        const { readContract } = await import("thirdweb");
        const usdtBalance = await readContract({
            contract: usdtContract,
            method: "function balanceOf(address) view returns (uint256)",
            params: [faucetWallet.address],
        });

        const usdtAmount = Number(usdtBalance) / 1e6; // Assuming 6 decimals
        if (usdtAmount < 500) {
            return NextResponse.json(
                { error: "Faucet has insufficient USDT balance" },
                { status: 503 }
            );
        }

        // Send 0.5 MATIC
        const maticTx = await sendTransaction({
            transaction: {
                to: recipientAddress,
                value: BigInt(5 * 10 ** 17), // 0.5 MATIC in wei
                chain: polygonAmoy,
                client,
            },
            account: faucetWallet,
        });

        // Send 500 USDT
        const usdtTx = prepareContractCall({
            contract: usdtContract,
            method: "function transfer(address to, uint256 amount) returns (bool)",
            params: [recipientAddress, BigInt(500 * 10 ** 6)], // 500 USDT (6 decimals)
        });

        const usdtReceipt = await sendTransaction({
            transaction: usdtTx,
            account: faucetWallet,
        });

        // Update rate limit
        rateLimitMap.set(recipientAddress.toLowerCase(), now);

        return NextResponse.json({
            success: true,
            maticTxHash: maticTx.transactionHash,
            usdtTxHash: usdtReceipt.transactionHash,
            message: "Successfully sent 0.5 MATIC and 500 USDT",
        });
    } catch (error: any) {
        console.error("Faucet error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to send tokens" },
            { status: 500 }
        );
    }
}
