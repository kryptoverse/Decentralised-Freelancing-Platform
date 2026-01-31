import { supabase, supabaseAdmin, isCacheEnabled, isCacheFresh, safeQuery } from '../supabase/client';
import { getContract, readContract } from 'thirdweb';
import { client } from '../thirdweb-client';
import { CHAIN } from '../chains';
import { DEPLOYED_CONTRACTS } from '@/constants/deployedContracts';

/**
 * Blockchain Cache Layer
 * 
 * This module provides cache-first read patterns with automatic blockchain fallback.
 * 
 * Architecture:
 * 1. Try to read from Supabase cache
 * 2. Check if cache is fresh (< 5 minutes old)
 * 3. If cache miss or stale, fallback to blockchain
 * 4. Never write directly to cache - only sync service does that
 */

// ============================================================================
// JOB CACHING
// ============================================================================

export interface CachedJob {
    job_id: number;
    client_address: string;
    title: string;
    description_uri: string | null;
    description_text: string | null;
    budget_usdc: number;
    status: number;
    hired_freelancer: string | null;
    escrow_address: string | null;
    created_at: number;
    updated_at: number;
    expires_at: number;
    tags: string[];
    synced_at: string;
}

/**
 * Get a single job - cache-first with blockchain fallback
 */
export async function getCachedJob(jobId: bigint): Promise<CachedJob | null> {
    // Try cache first
    if (isCacheEnabled()) {
        const cached = await safeQuery<CachedJob>(() =>
            supabase!
                .from('jobs')
                .select('*')
                .eq('job_id', Number(jobId))
                .single()
        );

        if (cached && isCacheFresh(cached.synced_at)) {
            console.log(`[Cache HIT] Job ${jobId}`);
            return cached;
        }
    }

    // Fallback to blockchain
    console.log(`[Cache MISS] Job ${jobId} - fetching from blockchain`);
    return null; // Caller should fetch from blockchain
}

/**
 * Get multiple jobs with filters - cache-first
 */
export async function getCachedJobs(filters?: {
    status?: number;
    client?: string;
    limit?: number;
    offset?: number;
}): Promise<CachedJob[]> {
    if (!isCacheEnabled()) {
        return []; // Caller should fetch from blockchain
    }

    try {
        let query = supabase!.from('jobs').select('*');

        // Apply filters
        if (filters?.status !== undefined) {
            query = query.eq('status', filters.status);
        }
        if (filters?.client) {
            query = query.eq('client_address', filters.client.toLowerCase());
        }

        // Pagination
        if (filters?.limit) {
            query = query.limit(filters.limit);
        }
        if (filters?.offset) {
            query = query.range(filters.offset, (filters.offset + (filters.limit || 10)) - 1);
        }

        // Order by created_at descending
        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) {
            console.warn('[Cache ERROR] Jobs query failed:', error);
            return [];
        }

        console.log(`[Cache HIT] Found ${data?.length || 0} jobs`);
        return data || [];
    } catch (err) {
        console.warn('[Cache ERROR] Jobs query exception:', err);
        return [];
    }
}

// ============================================================================
// FREELANCER PROFILE CACHING
// ============================================================================

export interface CachedProfile {
    wallet_address: string;
    profile_contract: string;
    hourly_rate: number | null;
    bio: string | null;
    skills: string[];
    portfolio_uri: string | null;
    total_earned: number;
    jobs_completed: number;
    average_rating: number | null;
    kyc_verified: boolean;
    is_active: boolean;
    synced_at: string;
}

/**
 * Get freelancer profile - cache-first
 */
export async function getCachedProfile(walletAddress: string): Promise<CachedProfile | null> {
    if (!isCacheEnabled()) {
        return null;
    }

    const cached = await safeQuery<CachedProfile>(() =>
        supabase!
            .from('freelancer_profiles')
            .select('*')
            .eq('wallet_address', walletAddress.toLowerCase())
            .single()
    );

    if (cached && isCacheFresh(cached.synced_at)) {
        console.log(`[Cache HIT] Profile ${walletAddress}`);
        return cached;
    }

    console.log(`[Cache MISS] Profile ${walletAddress}`);
    return null;
}

/**
 * Get multiple freelancer profiles
 */
export async function getCachedProfiles(filters?: {
    kyc_verified?: boolean;
    is_active?: boolean;
    limit?: number;
}): Promise<CachedProfile[]> {
    if (!isCacheEnabled()) {
        return [];
    }

    try {
        let query = supabase!.from('freelancer_profiles').select('*');

        if (filters?.kyc_verified !== undefined) {
            query = query.eq('kyc_verified', filters.kyc_verified);
        }
        if (filters?.is_active !== undefined) {
            query = query.eq('is_active', filters.is_active);
        }
        if (filters?.limit) {
            query = query.limit(filters.limit);
        }

        query = query.order('average_rating', { ascending: false, nullsFirst: false });

        const { data, error } = await query;

        if (error) {
            console.warn('[Cache ERROR] Profiles query failed:', error);
            return [];
        }

        console.log(`[Cache HIT] Found ${data?.length || 0} profiles`);
        return data || [];
    } catch (err) {
        console.warn('[Cache ERROR] Profiles query exception:', err);
        return [];
    }
}

// ============================================================================
// PROPOSAL CACHING
// ============================================================================

export interface CachedProposal {
    id: number;
    job_id: number;
    freelancer_address: string;
    proposal_text: string | null;
    bid_amount: number;
    delivery_days: number;
    applied_at: number;
    status: string;
    synced_at: string;
}

/**
 * Get proposals for a job
 */
export async function getCachedProposals(jobId: bigint): Promise<CachedProposal[]> {
    if (!isCacheEnabled()) {
        return [];
    }

    try {
        const { data, error } = await supabase!
            .from('proposals')
            .select('*')
            .eq('job_id', Number(jobId))
            .order('applied_at', { ascending: false });

        if (error) {
            console.warn('[Cache ERROR] Proposals query failed:', error);
            return [];
        }

        console.log(`[Cache HIT] Found ${data?.length || 0} proposals for job ${jobId}`);
        return data || [];
    } catch (err) {
        console.warn('[Cache ERROR] Proposals query exception:', err);
        return [];
    }
}

/**
 * Get proposals by freelancer
 */
export async function getCachedProposalsByFreelancer(
    freelancerAddress: string
): Promise<CachedProposal[]> {
    if (!isCacheEnabled()) {
        return [];
    }

    try {
        const { data, error } = await supabase!
            .from('proposals')
            .select('*')
            .eq('freelancer_address', freelancerAddress.toLowerCase())
            .order('applied_at', { ascending: false });

        if (error) {
            console.warn('[Cache ERROR] Freelancer proposals query failed:', error);
            return [];
        }

        console.log(`[Cache HIT] Found ${data?.length || 0} proposals by ${freelancerAddress}`);
        return data || [];
    } catch (err) {
        console.warn('[Cache ERROR] Freelancer proposals query exception:', err);
        return [];
    }
}

// ============================================================================
// ESCROW CACHING
// ============================================================================

export interface CachedEscrow {
    escrow_address: string;
    job_id: number;
    client_address: string;
    freelancer_address: string;
    amount: number;
    delivered: boolean;
    disputed: boolean;
    terminal: boolean;
    cancel_end: number | null;
    delivery_due: number | null;
    review_due: number | null;
    last_delivery_uri: string | null;
    last_dispute_uri: string | null;
    synced_at: string;
}

/**
 * Get escrow data - cache-first
 */
export async function getCachedEscrow(escrowAddress: string): Promise<CachedEscrow | null> {
    if (!isCacheEnabled()) {
        return null;
    }

    const cached = await safeQuery<CachedEscrow>(() =>
        supabase!
            .from('escrows')
            .select('*')
            .eq('escrow_address', escrowAddress.toLowerCase())
            .single()
    );

    if (cached && isCacheFresh(cached.synced_at)) {
        console.log(`[Cache HIT] Escrow ${escrowAddress}`);
        return cached;
    }

    console.log(`[Cache MISS] Escrow ${escrowAddress}`);
    return null;
}

/**
 * Get escrow by job ID
 */
export async function getCachedEscrowByJob(jobId: bigint): Promise<CachedEscrow | null> {
    if (!isCacheEnabled()) {
        return null;
    }

    const cached = await safeQuery<CachedEscrow>(() =>
        supabase!
            .from('escrows')
            .select('*')
            .eq('job_id', Number(jobId))
            .single()
    );

    if (cached && isCacheFresh(cached.synced_at)) {
        console.log(`[Cache HIT] Escrow for job ${jobId}`);
        return cached;
    }

    console.log(`[Cache MISS] Escrow for job ${jobId}`);
    return null;
}

// ============================================================================
// DELIVERY HISTORY CACHING
// ============================================================================

export interface CachedDelivery {
    id: number;
    escrow_address: string;
    delivery_uri: string;
    timestamp: number;
    version: number;
    synced_at: string;
}

/**
 * Get delivery history for an escrow
 */
export async function getCachedDeliveryHistory(escrowAddress: string): Promise<CachedDelivery[]> {
    if (!isCacheEnabled()) {
        return [];
    }

    try {
        const { data, error } = await supabase!
            .from('delivery_history')
            .select('*')
            .eq('escrow_address', escrowAddress.toLowerCase())
            .order('version', { ascending: true });

        if (error) {
            console.warn('[Cache ERROR] Delivery history query failed:', error);
            return [];
        }

        console.log(`[Cache HIT] Found ${data?.length || 0} deliveries for escrow ${escrowAddress}`);
        return data || [];
    } catch (err) {
        console.warn('[Cache ERROR] Delivery history query exception:', err);
        return [];
    }
}

// ============================================================================
// CACHE STATISTICS
// ============================================================================

export interface CacheStats {
    enabled: boolean;
    jobs_count: number;
    profiles_count: number;
    proposals_count: number;
    escrows_count: number;
    last_sync: {
        JobBoard: { block: number; time: string } | null;
        FreelancerProfile: { block: number; time: string } | null;
        JobEscrow: { block: number; time: string } | null;
    };
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<CacheStats> {
    const stats: CacheStats = {
        enabled: isCacheEnabled(),
        jobs_count: 0,
        profiles_count: 0,
        proposals_count: 0,
        escrows_count: 0,
        last_sync: {
            JobBoard: null,
            FreelancerProfile: null,
            JobEscrow: null,
        },
    };

    if (!isCacheEnabled()) {
        return stats;
    }

    try {
        // Get counts
        const [jobs, profiles, proposals, escrows, syncStatus] = await Promise.all([
            supabase!.from('jobs').select('*', { count: 'exact', head: true }),
            supabase!.from('freelancer_profiles').select('*', { count: 'exact', head: true }),
            supabase!.from('proposals').select('*', { count: 'exact', head: true }),
            supabase!.from('escrows').select('*', { count: 'exact', head: true }),
            supabase!.from('sync_status').select('*'),
        ]);

        stats.jobs_count = jobs.count || 0;
        stats.profiles_count = profiles.count || 0;
        stats.proposals_count = proposals.count || 0;
        stats.escrows_count = escrows.count || 0;

        // Get sync status
        if (syncStatus.data) {
            for (const sync of syncStatus.data) {
                const contractName = sync.contract_name as keyof typeof stats.last_sync;
                if (contractName in stats.last_sync) {
                    stats.last_sync[contractName] = {
                        block: sync.last_synced_block,
                        time: sync.last_synced_at,
                    };
                }
            }
        }
    } catch (err) {
        console.warn('[Cache ERROR] Failed to get stats:', err);
    }

    return stats;
}
