import { NextRequest, NextResponse } from 'next/server';
import { syncAllJobs, syncJobToDatabase, syncProfileToDatabase, syncEscrowToDatabase, syncProposalToDatabase } from '@/lib/blockchain-sync/sync-service';

/**
 * POST /api/sync/manual
 * 
 * Manually trigger sync for specific entities or batch sync
 * 
 * Body:
 * - type: 'job' | 'profile' | 'escrow' | 'proposal' | 'all'
 * - id: entity ID (for single sync)
 * - fromBlock: starting block (for batch sync)
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { type, id, fromBlock, jobId, escrowAddress, freelancerAddress } = body;

        switch (type) {
            case 'job':
                if (!id) {
                    return NextResponse.json(
                        { error: 'Job ID required' },
                        { status: 400 }
                    );
                }
                await syncJobToDatabase(BigInt(id));
                return NextResponse.json({
                    success: true,
                    message: `Job ${id} synced`
                });

            case 'profile':
                if (!id) {
                    return NextResponse.json(
                        { error: 'Wallet address required' },
                        { status: 400 }
                    );
                }
                await syncProfileToDatabase(id);
                return NextResponse.json({
                    success: true,
                    message: `Profile ${id} synced`
                });

            case 'escrow':
                if (!escrowAddress || !jobId) {
                    return NextResponse.json(
                        { error: 'Escrow address and job ID required' },
                        { status: 400 }
                    );
                }
                await syncEscrowToDatabase(escrowAddress, BigInt(jobId));
                return NextResponse.json({
                    success: true,
                    message: `Escrow ${escrowAddress} synced`
                });

            case 'proposal':
                if (!jobId || !freelancerAddress) {
                    return NextResponse.json(
                        { error: 'Job ID and freelancer address required' },
                        { status: 400 }
                    );
                }
                await syncProposalToDatabase(BigInt(jobId), freelancerAddress);
                return NextResponse.json({
                    success: true,
                    message: `Proposal for job ${jobId} by ${freelancerAddress} synced`
                });

            case 'all':
                // Trigger batch sync in background
                syncAllJobs(fromBlock ? BigInt(fromBlock) : 0n).catch(err => {
                    console.error('[Sync] Background sync error:', err);
                });
                return NextResponse.json({
                    success: true,
                    message: 'Batch sync started in background'
                });

            default:
                return NextResponse.json(
                    { error: 'Invalid sync type. Use: job, profile, escrow, proposal, or all' },
                    { status: 400 }
                );
        }
    } catch (error: any) {
        console.error('[API Error] /api/sync/manual:', error);
        return NextResponse.json(
            { error: 'Sync failed', details: error.message },
            { status: 500 }
        );
    }
}


/**
 * GET /api/sync/manual
 * 
 * Get sync status and instructions
 */
export async function GET(req: NextRequest) {
    return NextResponse.json({
        message: 'Manual sync endpoint',
        usage: {
            method: 'POST',
            examples: [
                {
                    description: 'Sync single job',
                    body: { type: 'job', id: '0' }
                },
                {
                    description: 'Sync freelancer profile',
                    body: { type: 'profile', id: '0x...' }
                },
                {
                    description: 'Sync escrow',
                    body: { type: 'escrow', escrowAddress: '0x...', jobId: '0' }
                },
                {
                    description: 'Batch sync all jobs',
                    body: { type: 'all', fromBlock: '0' }
                }
            ]
        }
    });
}
