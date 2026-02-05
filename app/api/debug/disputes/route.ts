
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createThirdwebClient, getContract, readContract, defineChain } from "thirdweb";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";

export async function GET(req: NextRequest) {
    const report: any = {
        env: {
            NEXT_PUBLIC_THIRDWEB_SECRET_KEY: process.env.NEXT_PUBLIC_THIRDWEB_SECRET_KEY ? "Set (Encoded)" : "MISSING",
            INFURA_API_KEY: process.env.INFURA_API_KEY ? "Set" : "MISSING",
        },
        steps: []
    };

    try {
        // 1. Check DB
        report.steps.push("Fetching disputes from DB...");
        const { data: dbDisputes, error } = await supabase
            .from('disputes')
            .select('*');

        if (error) {
            throw new Error(`DB Error: ${error.message}`);
        }
        report.steps.push(`Found ${dbDisputes?.length} disputes`);

        if (!dbDisputes || dbDisputes.length === 0) {
            return NextResponse.json({ success: true, report });
        }

        // 2. Setup Blockchain Client
        const secretKey = process.env.NEXT_PUBLIC_THIRDWEB_SECRET_KEY;
        const infuraKey = process.env.INFURA_API_KEY;

        if (!secretKey) throw new Error("Missing NEXT_PUBLIC_THIRDWEB_SECRET_KEY");
        if (!infuraKey) throw new Error("Missing INFURA_API_KEY");

        const client = createThirdwebClient({ secretKey });
        const chain = defineChain({
            id: 80002,
            rpc: `https://polygon-amoy.infura.io/v3/${infuraKey}`,
        });

        // 3. Try to fetch Job 18 (or first available)
        const targetJobId = dbDisputes[0].job_id;
        report.steps.push(`Attempting to fetch Job ${targetJobId} from Blockchain...`);

        const jobBoard = getContract({
            client,
            chain,
            address: DEPLOYED_CONTRACTS.addresses.JobBoard,
        });

        report.contractAddress = DEPLOYED_CONTRACTS.addresses.JobBoard;

        const jobData = await readContract({
            contract: jobBoard,
            method: "function getJob(uint256) view returns (address,string,string,uint256,uint8,address,address,uint64,uint64,uint64,bytes32[],uint256)",
            params: [BigInt(targetJobId)],
        }) as any;

        report.steps.push("Successfully read job data");
        report.jobDataSample = {
            client: jobData[0],
            status: jobData[4],
            escrow: jobData[6]
        };

        return NextResponse.json({
            success: true,
            status: "HEALTHY",
            report,
        });

    } catch (error: any) {
        console.error("DEBUG: Error:", error);
        report.error = error.message;
        report.stack = error.stack;
        return NextResponse.json(
            { success: false, status: "ERROR", report },
            { status: 500 }
        );
    }
}
