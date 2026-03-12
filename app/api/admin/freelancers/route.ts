import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";

const FREELANCER_FACTORY_ABI = [
    "function getAllFreelancers() view returns (address[])",
    "function freelancerProfile(address) view returns (address)",
];

const FREELANCER_PROFILE_ABI = [
    "function name() view returns (string)",
    "function isKYCVerified() view returns (bool)",
];

function getProvider() {
    return new ethers.providers.StaticJsonRpcProvider(
        { url: "https://rpc-amoy.polygon.technology/", skipFetchSetup: true },
        80002
    );
}

export async function GET(req: Request) {
    try {
        // Check authentication
        const cookies = (req as any).cookies;
        const session = cookies?.get?.("admin_session");
        if (session?.value !== "authenticated") {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        const provider = getProvider();

        const factory = new ethers.Contract(
            DEPLOYED_CONTRACTS.addresses.FreelancerFactory,
            FREELANCER_FACTORY_ABI,
            provider
        );

        // Get all freelancer addresses
        const freelancerAddresses: string[] = await factory.getAllFreelancers();

        // Fetch profile data for each freelancer
        const freelancers = await Promise.all(
            freelancerAddresses.map(async (address) => {
                try {
                    const profileAddress: string = await factory.freelancerProfile(address);

                    if (profileAddress === "0x0000000000000000000000000000000000000000") {
                        return {
                            address,
                            profileAddress: null,
                            name: "No Profile",
                            isKYCVerified: false,
                        };
                    }

                    const profile = new ethers.Contract(
                        profileAddress,
                        FREELANCER_PROFILE_ABI,
                        provider
                    );

                    const [name, isKYCVerified] = await Promise.all([
                        profile.name().catch(() => "Unknown"),
                        profile.isKYCVerified().catch(() => false),
                    ]);

                    return { address, profileAddress, name, isKYCVerified };
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

        return NextResponse.json({ success: true, freelancers });
    } catch (error: any) {
        console.error("Fetch freelancers error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to fetch freelancers" },
            { status: 500 }
        );
    }
}
