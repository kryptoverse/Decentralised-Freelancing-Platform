import { NextRequest, NextResponse } from 'next/server';
import { getCachedJobs, getCachedJob, isCacheEnabled } from '@/lib/blockchain-cache';
import { getContract, readContract } from 'thirdweb';
import { client } from '@/lib/thirdweb-client';
import { CHAIN } from '@/lib/chains';
import { DEPLOYED_CONTRACTS } from '@/constants/deployedContracts';

/**
 * GET /api/jobs
 * 
 * Fetch jobs with optional filters
 * Uses cache-first approach with blockchain fallback
 * 
 * Query params:
 * - status: Job status filter (0-5)
 * - client: Client address filter
 * - limit: Number of results
 * - offset: Pagination offset
 * - jobId: Get specific job by ID
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const jobIdParam = searchParams.get('jobId');
        const statusParam = searchParams.get('status');
        const clientParam = searchParams.get('client');
        const limitParam = searchParams.get('limit');
        const offsetParam = searchParams.get('offset');

        // Single job request
        if (jobIdParam) {
            const jobId = BigInt(jobIdParam);

            // Try cache first
            const cached = await getCachedJob(jobId);
            if (cached) {
                return NextResponse.json({
                    job: cached,
                    source: 'cache',
                });
            }

            // Fallback to blockchain
            const job = await getJobFromBlockchain(jobId);
            return NextResponse.json({
                job,
                source: 'blockchain',
            });
        }

        // Multiple jobs request
        const filters = {
            status: statusParam ? parseInt(statusParam) : undefined,
            client: clientParam || undefined,
            limit: limitParam ? parseInt(limitParam) : 50,
            offset: offsetParam ? parseInt(offsetParam) : 0,
        };

        // Try cache first
        if (isCacheEnabled()) {
            const cached = await getCachedJobs(filters);
            if (cached.length > 0) {
                return NextResponse.json({
                    jobs: cached,
                    count: cached.length,
                    source: 'cache',
                });
            }
        }

        // Fallback to blockchain
        const jobs = await getJobsFromBlockchain(filters);
        return NextResponse.json({
            jobs,
            count: jobs.length,
            source: 'blockchain',
        });
    } catch (error: any) {
        console.error('[API Error] /api/jobs:', error);
        return NextResponse.json(
            { error: 'Failed to fetch jobs', details: error.message },
            { status: 500 }
        );
    }
}

// ============================================================================
// BLOCKCHAIN FALLBACK FUNCTIONS
// ============================================================================

async function getJobFromBlockchain(jobId: bigint) {
    const jobBoard = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.JobBoard,
    });

    const rawJob = await readContract({
        contract: jobBoard,
        method: 'function getJob(uint256) view returns (uint256,address,string,string,uint256,uint8,address,address,uint64,uint64,uint64,string[])',
        params: [jobId],
    });

    return {
        job_id: Number(rawJob[0]),
        client_address: rawJob[1],
        title: rawJob[2],
        description_uri: rawJob[3],
        budget_usdc: Number(rawJob[4]),
        status: rawJob[5],
        hired_freelancer: rawJob[6],
        escrow_address: rawJob[7],
        created_at: Number(rawJob[8]),
        updated_at: Number(rawJob[9]),
        expires_at: Number(rawJob[10]),
        tags: rawJob[11],
    };
}

async function getJobsFromBlockchain(filters: {
    status?: number;
    client?: string;
    limit?: number;
    offset?: number;
}) {
    const jobBoard = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.JobBoard,
    });

    // Get total job count
    const totalJobs = await readContract({
        contract: jobBoard,
        method: 'function nextJobId() view returns (uint256)',
        params: [],
    });

    const jobs = [];
    const start = filters.offset || 0;
    const limit = filters.limit || 50;
    const end = Math.min(start + limit, Number(totalJobs));

    // Fetch jobs in range
    for (let i = start; i < end; i++) {
        try {
            const job = await getJobFromBlockchain(BigInt(i));

            // Apply filters
            if (filters.status !== undefined && job.status !== filters.status) {
                continue;
            }
            if (filters.client && job.client_address.toLowerCase() !== filters.client.toLowerCase()) {
                continue;
            }

            jobs.push(job);
        } catch (err) {
            // Job might not exist, skip
            continue;
        }
    }

    return jobs;
}
