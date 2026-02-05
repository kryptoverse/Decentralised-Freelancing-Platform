
import { createThirdwebClient, getContract, readContract, defineChain } from "thirdweb";
import fs from 'fs';
import path from 'path';

// --- Env Loader ---
function loadEnv(filePath: string) {
    try {
        const absolutePath = path.resolve(process.cwd(), filePath);
        if (fs.existsSync(absolutePath)) {
            const content = fs.readFileSync(absolutePath, 'utf-8');
            content.split('\n').forEach(line => {
                const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
                if (match) {
                    const key = match[1];
                    let value = match[2] || '';
                    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
                    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
                    if (!process.env[key]) process.env[key] = value;
                }
            });
        }
    } catch (e) { }
}
loadEnv('.env');
loadEnv('.env.local');
// ------------------

import { DEPLOYED_CONTRACTS } from "../constants/deployedContracts";

const secretKey = process.env.NEXT_PUBLIC_THIRDWEB_SECRET_KEY;
if (!secretKey) {
    console.error("Missing NEXT_PUBLIC_THIRDWEB_SECRET_KEY");
    process.exit(1);
}

const client = createThirdwebClient({ secretKey });

const chain = defineChain({
    id: 80002,
    rpc: `https://polygon-amoy.infura.io/v3/${process.env.INFURA_API_KEY}`,
});

async function inspectJob(jobId: bigint) {
    console.log(`\n🔍 Inspecting Job ID: ${jobId} on Chain 80002...`);
    console.log(`JobBoard Address: ${DEPLOYED_CONTRACTS.addresses.JobBoard}`);

    const jobBoard = getContract({
        client,
        chain,
        address: DEPLOYED_CONTRACTS.addresses.JobBoard,
    });

    try {
        const jobData = await readContract({
            contract: jobBoard,
            method: "function getJob(uint256) view returns (address,string,string,uint256,uint8,address,address,uint64,uint64,uint64,bytes32[],uint256)",
            params: [jobId],
        }) as any;

        const [clientAddr, title, descriptionURI, budgetUSDC, status, hiredFreelancer, escrowAddr] = jobData;

        console.log("\n--- ON-CHAIN DATA ---");
        console.log(`Title: "${title}"`);
        console.log(`Client: ${clientAddr}`);
        console.log(`Status: ${status} (0=Unknown, 1=Open, 2=Hired, 3=Cancelled, 4=Completed)`);
        console.log(`Freelancer: ${hiredFreelancer}`);
        console.log(`Escrow Address: ${escrowAddr}`);

        if (escrowAddr === "0x0000000000000000000000000000000000000000") {
            console.log("\n⚠️  WARNING: Escrow Address is ZERO. Expected an address if the job was hired.");
        } else {
            console.log("\n✅ Escrow address present.");
        }

    } catch (error) {
        console.error("Error reading contract:", error);
    }
}

// Check the Job ID found in the dispute record (Job ID 18)
inspectJob(18n);
