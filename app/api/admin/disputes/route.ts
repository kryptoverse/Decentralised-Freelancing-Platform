import { NextRequest, NextResponse } from "next/server";
import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { defineChain } from "thirdweb/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { ethers } from "ethers";
import { supabase } from "@/lib/supabase";

// Create Infura-based client for admin operations
const infuraClient = createThirdwebClient({
    secretKey: process.env.NEXT_PUBLIC_THIRDWEB_SECRET_KEY || "",
});

// Custom RPC for Infura
const polygonAmoyInfura = defineChain({
    id: 80002,
    rpc: `https://polygon-amoy.infura.io/v3/${process.env.INFURA_API_KEY}`,
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

        console.log("🔍 Fetching disputes from SUPABASE...");

        // 1. Fetch open disputes from Supabase
        const { data: dbDisputes, error } = await supabase
            .from('disputes')
            .select('*')
            .eq('status', 'OPEN')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const disputes = [];

        // 2. Hydrate with blockchain data for live status
        // We do this in parallel for performance
        const results = await Promise.all(dbDisputes.map(async (record: any) => {
            try {
                // Get job details to find escrow address
                const jobBoard = getContract({
                    client: infuraClient,
                    chain: polygonAmoyInfura,
                    address: DEPLOYED_CONTRACTS.addresses.JobBoard,
                });

                const jobData = await readContract({
                    contract: jobBoard,
                    method:
                        "function getJob(uint256) view returns (address,string,string,uint256,uint8,address,address,uint64,uint64,uint64,bytes32[],uint256)",
                    params: [BigInt(record.job_id)],
                }) as any;

                const [clientAddr, title, descriptionURI, budgetUSDC, status, hiredFreelancer, escrowAddr] = jobData;

                if (!escrowAddr || escrowAddr === "0x0000000000000000000000000000000000000000") {
                    return null; // Job might not have escrow or invalid state
                }

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

                // Even if not disputed on-chain yet (edge case), if it's in DB we show it.
                // But generally we want to confirm it's still active.
                // If terminal, maybe we should close it in DB? For now just show status.

                // Fetch names (Optional enhancement)
                let clientName = "Unknown";
                let freelancerName = "Unknown";
                // ... (Name fetching logic can be added here if needed, keeping it simple for speed for now)

                // Fetch Dispute Reason content
                let disputeReason = "No reason provided";
                if (record.dispute_reason_uri) {
                    try {
                        const ipfsUrl = record.dispute_reason_uri.replace("ipfs://", "https://ipfs.io/ipfs/");
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
                    jobId: Number(record.job_id),
                    jobTitle: title,
                    escrowAddress: escrowAddr,
                    client: clientAddr,
                    clientName,
                    freelancer: hiredFreelancer,
                    freelancerName,
                    budget: Number(budgetUSDC) / 1e6,
                    disputed,
                    delivered,
                    terminal,
                    lastDeliveryURI,
                    lastDisputeURI: record.dispute_reason_uri,
                    disputeReason,
                    jobDescription,
                    createdAt: new Date(record.created_at).getTime(),
                    dbId: record.id // Internal DB ID
                };

            } catch (err) {
                console.error(`Error hydrating dispute ${record.id}:`, err);
                return null;
            }
        }));

        // Filter out nulls
        const validDisputes = results.filter((d: any) => d !== null);

        return NextResponse.json({
            success: true,
            disputes: validDisputes,
            count: validDisputes.length,
            method: "supabase",
        });
    } catch (error: any) {
        console.error("Error fetching disputes:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to fetch disputes" },
            { status: 500 }
        );
    }
}
