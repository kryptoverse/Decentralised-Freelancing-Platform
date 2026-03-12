import { NextRequest, NextResponse } from "next/server";
import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { defineChain } from "thirdweb/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { ethers } from "ethers";
import { supabase } from "@/lib/supabase";

// Check keys and setup robust RPC
const secretKey = process.env.NEXT_PUBLIC_THIRDWEB_SECRET_KEY;
const infuraKey = process.env.INFURA_API_KEY;

if (!secretKey) {
    console.error("❌ ADMIN API: Missing NEXT_PUBLIC_THIRDWEB_SECRET_KEY");
}
if (!infuraKey) {
    console.warn("⚠️ ADMIN API: Missing INFURA_API_KEY, falling back to public RPC");
}

// Create client
const infuraClient = createThirdwebClient({
    secretKey: secretKey || "", // specific error will be thrown by SDK if empty
});

// Custom RPC for Infura with Fallback
const rpcUrl = infuraKey
    ? `https://polygon-amoy.infura.io/v3/${infuraKey}`
    : "https://rpc-amoy.polygon.technology/";

const polygonAmoyInfura = defineChain({
    id: 80002,
    rpc: rpcUrl,
});

export async function GET(req: NextRequest) {
    try {
        // Check authentication
        const session = req.cookies.get("admin_session");
        if (session?.value !== "authenticated") {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        console.log("🔍 Fetching disputes from EscrowFactory on-chain...");

        const escrowFactory = getContract({
            client: infuraClient,
            chain: polygonAmoyInfura,
            address: DEPLOYED_CONTRACTS.addresses.EscrowFactory,
        });

        // 1. Fetch open disputes from EscrowFactory
        const activeDisputes = await readContract({
            contract: escrowFactory,
            method: "function getActiveDisputes() view returns ((uint256 jobId, address escrow, address client, address freelancer, string reasonURI, bool resolved)[])",
            params: [],
        }) as any[];

        if (!activeDisputes || activeDisputes.length === 0) {
            return NextResponse.json({
                success: true,
                disputes: [],
                count: 0,
                method: "on-chain",
            });
        }

        const jobBoard = getContract({
            client: infuraClient,
            chain: polygonAmoyInfura,
            address: DEPLOYED_CONTRACTS.addresses.JobBoard,
        });

        // 2. Hydrate with blockchain data for live status
        const results = await Promise.all(activeDisputes.map(async (record: any, index: number) => {
            try {
                const jobId = record.jobId;
                const escrowAddr = record.escrow;
                const clientAddr = record.client;
                const freelancerAddr = record.freelancer;
                const disputeReasonURI = record.reasonURI;

                const jobData = await readContract({
                    contract: jobBoard,
                    method:
                        "function getJob(uint256) view returns (address,string,string,uint256,uint8,address,address,uint64,uint64,uint64,bytes32[],uint256)",
                    params: [jobId],
                }) as any;

                const [_, title, descriptionURI, budgetUSDC, status, hiredFreelancer, actualEscrowAddr] = jobData;

                // Check active status on escrow
                const escrow = getContract({
                    client: infuraClient,
                    chain: polygonAmoyInfura,
                    address: escrowAddr as `0x${string}`,
                });

                const [disputed, delivered, terminal, lastDeliveryURI] =
                    await Promise.all([
                        readContract({ contract: escrow, method: "function disputed() view returns (bool)" }).catch(() => false),
                        readContract({ contract: escrow, method: "function delivered() view returns (bool)" }).catch(() => false),
                        readContract({ contract: escrow, method: "function terminal() view returns (bool)" }).catch(() => false),
                        readContract({ contract: escrow, method: "function lastDeliveryURI() view returns (string)" }).catch(() => ""),
                    ]);

                let clientName = "Unknown";
                let freelancerName = "Unknown";

                // Fetch Dispute Reason content
                let disputeReason = "No reason provided";
                if (disputeReasonURI) {
                    try {
                        const ipfsUrl = disputeReasonURI.replace("ipfs://", "https://ipfs.io/ipfs/");
                        const response = await fetch(ipfsUrl);
                        const data = await response.json();
                        disputeReason = data.reason || data.description || JSON.stringify(data);
                    } catch (e) { }
                }

                let jobDescription = "No description";
                if (descriptionURI) {
                    try {
                        const ipfsUrl = descriptionURI.replace("ipfs://", "https://ipfs.io/ipfs/");
                        const response = await fetch(ipfsUrl);
                        const data = await response.json();
                        jobDescription = data.description || data.details || JSON.stringify(data);
                    } catch (e) { }
                }

                return {
                    jobId: Number(jobId),
                    jobTitle: title,
                    escrowAddress: escrowAddr,
                    client: clientAddr,
                    clientName,
                    freelancer: freelancerAddr,
                    freelancerName,
                    budget: Number(budgetUSDC) / 1e6,
                    disputed,
                    delivered,
                    terminal,
                    lastDeliveryURI,
                    lastDisputeURI: disputeReasonURI,
                    disputeReason,
                    jobDescription,
                    createdAt: Date.now(), // approximation, we don't store dispute creation time on-chain in this record
                    dbId: index.toString()
                };

            } catch (err: any) {
                console.error(`Error hydrating dispute ${index}:`, err);
                return {
                    jobId: Number(record.jobId),
                    jobTitle: `Job #${record.jobId} (Sync Error)`,
                    escrowAddress: record.escrow,
                    client: "Unknown",
                    clientName: "Unknown",
                    freelancer: "Unknown",
                    freelancerName: "Unknown",
                    budget: 0,
                    disputed: true,
                    delivered: false,
                    terminal: false,
                    lastDeliveryURI: "",
                    lastDisputeURI: record.reasonURI,
                    disputeReason: "Failed to sync with blockchain: " + (err.message || "Unknown error"),
                    jobDescription: "Blockchain sync failed",
                    createdAt: Date.now(),
                    dbId: index.toString(),
                    isError: true
                };
            }
        }));

        const validDisputes = results.filter((d: any) => d !== null);

        return NextResponse.json({
            success: true,
            disputes: validDisputes,
            count: validDisputes.length,
            method: "on-chain",
        });
    } catch (error: any) {
        console.error("Error fetching disputes:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to fetch disputes" },
            { status: 500 }
        );
    }
}
