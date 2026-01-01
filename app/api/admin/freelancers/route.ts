import { NextResponse } from "next/server";
import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { polygonAmoy } from "thirdweb/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";

export async function GET() {
    try {
        // Create client
        const client = createThirdwebClient({
            secretKey: process.env.NEXT_PUBLIC_THIRDWEB_SECRET_KEY as string,
        });

        // Get FreelancerFactory contract
        const factory = getContract({
            client,
            chain: polygonAmoy,
            address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory,
        });

        // Get all freelancer addresses
        const freelancerAddresses = (await readContract({
            contract: factory,
            method: "function getAllFreelancers() view returns (address[])",
        })) as string[];

        // Fetch profile data for each freelancer
        const freelancers = await Promise.all(
            freelancerAddresses.map(async (address) => {
                try {
                    // Get profile address
                    const profileAddress = (await readContract({
                        contract: factory,
                        method: "function freelancerProfile(address) view returns (address)",
                        params: [address as `0x${string}`],
                    })) as string;

                    if (profileAddress === "0x0000000000000000000000000000000000000000") {
                        return {
                            address,
                            profileAddress: null,
                            name: "No Profile",
                            isKYCVerified: false,
                        };
                    }

                    // Get profile contract
                    const profile = getContract({
                        client,
                        chain: polygonAmoy,
                        address: profileAddress as `0x${string}`,
                    });

                    // Read profile data
                    const [name, isKYCVerified] = await Promise.all([
                        readContract({
                            contract: profile,
                            method: "function name() view returns (string)",
                        }).catch(() => "Unknown"),
                        readContract({
                            contract: profile,
                            method: "function isKYCVerified() view returns (bool)",
                        }).catch(() => false),
                    ]);

                    return {
                        address,
                        profileAddress,
                        name: name as string,
                        isKYCVerified: isKYCVerified as boolean,
                    };
                } catch (error) {
                    console.error(`Error fetching data for ${address}:`, error);
                    return {
                        address,
                        profileAddress: null,
                        name: "Error loading",
                        isKYCVerified: false,
                    };
                }
            })
        );

        return NextResponse.json({
            success: true,
            freelancers,
        });
    } catch (error: any) {
        console.error("Fetch freelancers error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to fetch freelancers" },
            { status: 500 }
        );
    }
}
