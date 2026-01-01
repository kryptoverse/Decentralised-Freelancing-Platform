import { NextRequest, NextResponse } from "next/server";
import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { defineChain } from "thirdweb/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { ethers } from "ethers";

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
        console.log("🔍 Fetching disputes using EVENT-BASED method...");

        const disputes = [];
        let method = "events";

        try {
            // METHOD 1: Event-based using ethers.js (v5 syntax)
            // Explicitly specify network to avoid NETWORK_ERROR
            const provider = new ethers.providers.JsonRpcProvider(
                `https://polygon-amoy.infura.io/v3/${process.env.INFURA_API_KEY}`,
                {
                    chainId: 80002,
                    name: "polygon-amoy"
                }
            );

            // JobBoard contract to get JobHired events
            const jobBoardAbi = [
                "event JobHired(uint256 indexed jobId, address indexed client, address indexed freelancer, address escrow)",
            ];
            const jobBoardContract = new ethers.Contract(
                DEPLOYED_CONTRACTS.addresses.JobBoard,
                jobBoardAbi,
                provider
            );

            // Get all JobHired events
            const filter = jobBoardContract.filters.JobHired();
            const events = await jobBoardContract.queryFilter(filter);

            console.log(`✅ Found ${events.length} hired jobs via events`);

            // Check each escrow for disputes
            for (const event of events) {
                const jobId = event.args?.jobId;
                const client = event.args?.client;
                const freelancer = event.args?.freelancer;
                const escrowAddr = event.args?.escrow;

                if (!escrowAddr || escrowAddr === "0x0000000000000000000000000000000000000000") {
                    continue;
                }

                try {
                    const escrow = getContract({
                        client: infuraClient,
                        chain: polygonAmoyInfura,
                        address: escrowAddr as `0x${string}`,
                    });

                    const [disputed, delivered, terminal, lastDeliveryURI, lastDisputeURI] =
                        await Promise.all([
                            readContract({ contract: escrow, method: "function disputed() view returns (bool)" }).catch(() => false),
                            readContract({ contract: escrow, method: "function delivered() view returns (bool)" }).catch(() => false),
                            readContract({ contract: escrow, method: "function terminal() view returns (bool)" }).catch(() => false),
                            readContract({ contract: escrow, method: "function lastDeliveryURI() view returns (string)" }).catch(() => ""),
                            readContract({ contract: escrow, method: "function lastDisputeURI() view returns (string)" }).catch(() => ""),
                        ]);

                    // Only include active disputes
                    if (disputed && !terminal) {
                        const jobBoard = getContract({
                            client: infuraClient,
                            chain: polygonAmoyInfura,
                            address: DEPLOYED_CONTRACTS.addresses.JobBoard,
                        });

                        // Fetch job details
                        const jobData = await readContract({
                            contract: jobBoard,
                            method:
                                "function getJob(uint256) view returns (address,string,string,uint256,uint8,address,address,uint64,uint64,uint64,bytes32[],uint256)",
                            params: [jobId],
                        }) as any;

                        const [clientAddr, title, descriptionURI, budgetUSDC] = jobData;

                        // Fetch names
                        let clientName = "Unknown";
                        let freelancerName = "Unknown";

                        try {
                            const clientFactory = getContract({
                                client: infuraClient,
                                chain: polygonAmoyInfura,
                                address: DEPLOYED_CONTRACTS.addresses.ClientFactory,
                            });

                            const clientProfileAddr = await readContract({
                                contract: clientFactory,
                                method: "function clientProfiles(address) view returns (address)",
                                params: [clientAddr as `0x${string}`],
                            });

                            if (clientProfileAddr && clientProfileAddr !== "0x0000000000000000000000000000000000000000") {
                                const clientProfile = getContract({
                                    client: infuraClient,
                                    chain: polygonAmoyInfura,
                                    address: clientProfileAddr as `0x${string}`,
                                });

                                clientName = (await readContract({
                                    contract: clientProfile,
                                    method: "function name() view returns (string)",
                                })) as string;
                            }
                        } catch (e) { }

                        try {
                            const freelancerFactory = getContract({
                                client: infuraClient,
                                chain: polygonAmoyInfura,
                                address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory,
                            });

                            const freelancerProfileAddr = await readContract({
                                contract: freelancerFactory,
                                method: "function freelancerProfile(address) view returns (address)",
                                params: [freelancer as `0x${string}`],
                            });

                            if (freelancerProfileAddr && freelancerProfileAddr !== "0x0000000000000000000000000000000000000000") {
                                const freelancerProfile = getContract({
                                    client: infuraClient,
                                    chain: polygonAmoyInfura,
                                    address: freelancerProfileAddr as `0x${string}`,
                                });

                                freelancerName = (await readContract({
                                    contract: freelancerProfile,
                                    method: "function name() view returns (string)",
                                })) as string;
                            }
                        } catch (e) { }

                        // Fetch IPFS content
                        let disputeReason = "No reason provided";
                        if (lastDisputeURI) {
                            try {
                                const ipfsUrl = (lastDisputeURI as string).replace("ipfs://", "https://ipfs.io/ipfs/");
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

                        disputes.push({
                            jobId: Number(jobId),
                            jobTitle: title,
                            escrowAddress: escrowAddr,
                            client: clientAddr,
                            clientName,
                            freelancer,
                            freelancerName,
                            budget: Number(budgetUSDC) / 1e6,
                            disputed: true,
                            delivered,
                            terminal,
                            lastDeliveryURI,
                            lastDisputeURI,
                            disputeReason,
                            jobDescription,
                            createdAt: Date.now(),
                        });
                    }
                } catch (err) {
                    console.error(`Error checking escrow ${escrowAddr}:`, err);
                }
            }

            console.log(`✅ EVENT method found ${disputes.length} active disputes`);
        } catch (eventError) {
            console.error("❌ Event method failed, falling back to sequential:", eventError);
            method = "sequential";

            // METHOD 2: Sequential fallback
            const jobBoard = getContract({
                client: infuraClient,
                chain: polygonAmoyInfura,
                address: DEPLOYED_CONTRACTS.addresses.JobBoard,
            });

            let consecutiveFailures = 0;
            const maxConsecutiveFailures = 10;

            for (let i = 1; i <= 100; i++) {
                try {
                    const jobData = await readContract({
                        contract: jobBoard,
                        method:
                            "function getJob(uint256) view returns (address,string,string,uint256,uint8,address,address,uint64,uint64,uint64,bytes32[],uint256)",
                        params: [BigInt(i)],
                    }) as any;

                    consecutiveFailures = 0;

                    const [clientAddr, title, descriptionURI, budgetUSDC, status, hiredFreelancer, escrowAddr, createdAt] = jobData;

                    if (!escrowAddr || escrowAddr === "0x0000000000000000000000000000000000000000") {
                        continue;
                    }

                    const escrow = getContract({
                        client: infuraClient,
                        chain: polygonAmoyInfura,
                        address: escrowAddr as `0x${string}`,
                    });

                    const [disputed, delivered, terminal, lastDeliveryURI, lastDisputeURI] =
                        await Promise.all([
                            readContract({ contract: escrow, method: "function disputed() view returns (bool)" }).catch(() => false),
                            readContract({ contract: escrow, method: "function delivered() view returns (bool)" }).catch(() => false),
                            readContract({ contract: escrow, method: "function terminal() view returns (bool)" }).catch(() => false),
                            readContract({ contract: escrow, method: "function lastDeliveryURI() view returns (string)" }).catch(() => ""),
                            readContract({ contract: escrow, method: "function lastDisputeURI() view returns (string)" }).catch(() => ""),
                        ]);

                    if (disputed && !terminal) {
                        let clientName = "Unknown";
                        let freelancerName = "Unknown";

                        try {
                            const clientFactory = getContract({
                                client: infuraClient,
                                chain: polygonAmoyInfura,
                                address: DEPLOYED_CONTRACTS.addresses.ClientFactory,
                            });

                            const clientProfileAddr = await readContract({
                                contract: clientFactory,
                                method: "function clientProfiles(address) view returns (address)",
                                params: [clientAddr as `0x${string}`],
                            });

                            if (clientProfileAddr && clientProfileAddr !== "0x0000000000000000000000000000000000000000") {
                                const clientProfile = getContract({
                                    client: infuraClient,
                                    chain: polygonAmoyInfura,
                                    address: clientProfileAddr as `0x${string}`,
                                });

                                clientName = (await readContract({
                                    contract: clientProfile,
                                    method: "function name() view returns (string)",
                                })) as string;
                            }
                        } catch (e) { }

                        try {
                            const freelancerFactory = getContract({
                                client: infuraClient,
                                chain: polygonAmoyInfura,
                                address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory,
                            });

                            const freelancerProfileAddr = await readContract({
                                contract: freelancerFactory,
                                method: "function freelancerProfile(address) view returns (address)",
                                params: [hiredFreelancer as `0x${string}`],
                            });

                            if (freelancerProfileAddr && freelancerProfileAddr !== "0x0000000000000000000000000000000000000000") {
                                const freelancerProfile = getContract({
                                    client: infuraClient,
                                    chain: polygonAmoyInfura,
                                    address: freelancerProfileAddr as `0x${string}`,
                                });

                                freelancerName = (await readContract({
                                    contract: freelancerProfile,
                                    method: "function name() view returns (string)",
                                })) as string;
                            }
                        } catch (e) { }

                        let disputeReason = "No reason provided";
                        if (lastDisputeURI) {
                            try {
                                const ipfsUrl = (lastDisputeURI as string).replace("ipfs://", "https://ipfs.io/ipfs/");
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

                        disputes.push({
                            jobId: i,
                            jobTitle: title,
                            escrowAddress: escrowAddr,
                            client: clientAddr,
                            clientName,
                            freelancer: hiredFreelancer,
                            freelancerName,
                            budget: Number(budgetUSDC) / 1e6,
                            disputed: true,
                            delivered,
                            terminal,
                            lastDeliveryURI,
                            lastDisputeURI,
                            disputeReason,
                            jobDescription,
                            createdAt: Number(createdAt),
                        });
                    }
                } catch (err) {
                    consecutiveFailures++;
                    if (consecutiveFailures >= maxConsecutiveFailures) {
                        break;
                    }
                }
            }

            console.log(`⚠️ SEQUENTIAL fallback found ${disputes.length} disputes`);
        }

        return NextResponse.json({
            success: true,
            disputes,
            count: disputes.length,
            method, // "events" or "sequential"
        });
    } catch (error: any) {
        console.error("Error fetching disputes:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to fetch disputes" },
            { status: 500 }
        );
    }
}
