import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { syncAllJobs } from '@/lib/blockchain-sync/sync-service';
import { getContract, readContract } from 'thirdweb';
import { client } from '@/lib/thirdweb-client';
import { CHAIN } from '@/lib/chains';
import { DEPLOYED_CONTRACTS } from '@/constants/deployedContracts';

/**
 * GET /api/cron/reconcile
 * 
 * Background reconciliation job
 * Ensures database cache is consistent with blockchain
 * 
 * This should be called periodically (e.g., every 5 minutes via Vercel Cron)
 * 
 * Authorization: Requires CRON_SECRET header
 */
export async function GET(req: NextRequest) {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
        );
    }

    if (!supabaseAdmin) {
        return NextResponse.json(
            { error: 'Supabase not configured' },
            { status: 500 }
        );
    }

    try {
        console.log('[Reconcile] Starting reconciliation job...');
        const startTime = Date.now();

        // Get last synced block from database
        const { data: syncStatus } = await supabaseAdmin
            .from('sync_status')
            .select('*')
            .eq('contract_name', 'JobBoard')
            .single();

        const lastSyncedBlock = syncStatus?.last_synced_block || 0;

        // Get current block number
        const currentBlock = await getCurrentBlockNumber();

        console.log(`[Reconcile] Syncing from block ${lastSyncedBlock} to ${currentBlock}`);

        // Sync all jobs (this will update existing and add new ones)
        await syncAllJobs(BigInt(lastSyncedBlock));

        // Update sync status
        await supabaseAdmin
            .from('sync_status')
            .upsert({
                contract_name: 'JobBoard',
                last_synced_block: currentBlock,
                last_synced_at: new Date().toISOString(),
                sync_errors: 0,
                last_error: null,
            });

        const duration = Date.now() - startTime;
        console.log(`[Reconcile] ✓ Reconciliation complete in ${duration}ms`);

        return NextResponse.json({
            success: true,
            lastSyncedBlock,
            currentBlock,
            duration,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('[Reconcile] Error:', error);

        // Log error to database
        try {
            await supabaseAdmin
                .from('sync_status')
                .update({
                    sync_errors: supabaseAdmin.rpc('increment', { row_id: 'JobBoard' }),
                    last_error: error.message,
                })
                .eq('contract_name', 'JobBoard');
        } catch (dbErr) {
            console.error('[Reconcile] Failed to log error:', dbErr);
        }

        return NextResponse.json(
            {
                success: false,
                error: 'Reconciliation failed',
                details: error.message
            },
            { status: 500 }
        );
    }
}

/**
 * Get current block number from blockchain
 */
async function getCurrentBlockNumber(): Promise<number> {
    try {
        const jobBoard = getContract({
            client,
            chain: CHAIN,
            address: DEPLOYED_CONTRACTS.JobBoard,
        });

        // Get a recent transaction to determine current block
        // This is a simple approach - you could also use eth_blockNumber RPC call
        const nextJobId = await readContract({
            contract: jobBoard,
            method: 'function nextJobId() view returns (uint256)',
            params: [],
        });

        // For now, return a placeholder
        // In production, you'd want to use a proper RPC call to get block number
        return Math.floor(Date.now() / 1000); // Use timestamp as proxy
    } catch (err) {
        console.warn('[Reconcile] Failed to get block number:', err);
        return 0;
    }
}
