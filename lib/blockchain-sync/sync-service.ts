import { supabaseAdmin } from '../supabase/client';
import { getContract, prepareEvent, getContractEvents, readContract } from 'thirdweb';
import { client } from '../thirdweb-client';
import { CHAIN } from '../chains';
import { DEPLOYED_CONTRACTS } from '@/constants/deployedContracts';
import type { Database } from '../supabase/types';

/**
 * Blockchain Event Sync Service
 * 
 * Listens to blockchain events and syncs data to Supabase cache
 * This ensures the cache is always up-to-date with blockchain state
 */

// ============================================================================
// JOB SYNC
// ============================================================================

/**
 * Sync a single job to database
 */
export async function syncJobToDatabase(
    jobId: bigint,
    blockNumber?: bigint
): Promise<void> {
    if (!supabaseAdmin) {
        console.warn('[Sync] Supabase not configured, skipping job sync');
        return;
    }

    try {
        const jobBoard = getContract({
            client,
            chain: CHAIN,
            address: DEPLOYED_CONTRACTS.addresses.JobBoard as `0x${string}`,
        });

        // Fetch job data from blockchain
        const rawJob = await readContract({
            contract: jobBoard,
            method: 'function getJob(uint256) view returns (address,string,string,uint256,uint8,address,address,uint64,uint64,uint64,bytes32[],uint256)',
            params: [jobId],
        });

        const jobData: Database['public']['Tables']['jobs']['Insert'] = {
            job_id: Number(jobId),
            client_address: (rawJob[0] as string).toLowerCase(),
            title: rawJob[1] as string,
            description_uri: (rawJob[2] as string) || null,
            description_text: null, // Will be fetched from IPFS later
            budget_usdc: Number(rawJob[3]),
            status: Number(rawJob[4]),
            hired_freelancer: (rawJob[5] as string) !== '0x0000000000000000000000000000000000000000'
                ? (rawJob[5] as string).toLowerCase()
                : null,
            escrow_address: (rawJob[6] as string) !== '0x0000000000000000000000000000000000000000'
                ? (rawJob[6] as string).toLowerCase()
                : null,
            created_at: Number(rawJob[7]),
            updated_at: Number(rawJob[8]),
            expires_at: Number(rawJob[9]),
            tags: Array.isArray(rawJob[10]) ? (rawJob[10] as readonly string[]).map(t => t as string) : [],
            blockchain_block: blockNumber ? Number(blockNumber) : null,
        };

        // Upsert to database
        const { error } = await supabaseAdmin
            .from('jobs')
            .upsert(jobData, { onConflict: 'job_id' });

        if (error) {
            console.error(`[Sync] Failed to sync job ${jobId}:`, error);
        } else {
            console.log(`[Sync] ✓ Synced job ${jobId}`);
        }
    } catch (err) {
        console.error(`[Sync] Error syncing job ${jobId}:`, err);
    }
}

/**
 * Sync freelancer profile to database
 */
export async function syncProfileToDatabase(
    walletAddress: string,
    blockNumber?: bigint
): Promise<void> {
    if (!supabaseAdmin) {
        console.warn('[Sync] Supabase not configured, skipping profile sync');
        return;
    }

    try {
        const profileRegistry = getContract({
            client,
            chain: CHAIN,
            address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory as `0x${string}`,
        });

        // Get profile contract address
        const profileAddr = await readContract({
            contract: profileRegistry,
            method: 'function freelancerProfile(address) view returns (address)',
            params: [walletAddress],
        });

        if (profileAddr === '0x0000000000000000000000000000000000000000') {
            console.log(`[Sync] No profile for ${walletAddress}`);
            return;
        }

        // Fetch profile data
        const profileContract = getContract({
            client,
            chain: CHAIN,
            address: profileAddr as string,
        });

        const [hourlyRate, bio, skills, portfolioURI, totalEarned, jobsCompleted, avgRating, isActive] =
            await Promise.all([
                readContract({ contract: profileContract, method: 'function hourlyRate() view returns (uint256)' }),
                readContract({ contract: profileContract, method: 'function bio() view returns (string)' }),
                readContract({ contract: profileContract, method: 'function getSkills() view returns (string[])' }),
                readContract({ contract: profileContract, method: 'function portfolioURI() view returns (string)' }),
                readContract({ contract: profileContract, method: 'function totalEarned() view returns (uint256)' }),
                readContract({ contract: profileContract, method: 'function jobsCompleted() view returns (uint256)' }),
                readContract({ contract: profileContract, method: 'function averageRating() view returns (uint256)' }),
                readContract({ contract: profileContract, method: 'function isActive() view returns (bool)' }),
            ]);

        const profileData: Database['public']['Tables']['freelancer_profiles']['Insert'] = {
            wallet_address: walletAddress.toLowerCase(),
            profile_contract: (profileAddr as string).toLowerCase(),
            hourly_rate: Number(hourlyRate) || null,
            bio: (bio as string) || null,
            skills: Array.isArray(skills) ? (skills as readonly string[]).map(s => s as string) : [],
            portfolio_uri: (portfolioURI as string) || null,
            total_earned: Number(totalEarned) || 0,
            jobs_completed: Number(jobsCompleted) || 0,
            average_rating: avgRating ? Number(avgRating) / 100 : null, // Assuming rating is stored as 0-500
            kyc_verified: false, // Will be updated separately
            is_active: Boolean(isActive),
            blockchain_block: blockNumber ? Number(blockNumber) : null,
        };

        const { error } = await supabaseAdmin
            .from('freelancer_profiles')
            .upsert(profileData, { onConflict: 'wallet_address' });

        if (error) {
            console.error(`[Sync] Failed to sync profile ${walletAddress}:`, error);
        } else {
            console.log(`[Sync] ✓ Synced profile ${walletAddress}`);
        }
    } catch (err) {
        console.error(`[Sync] Error syncing profile ${walletAddress}:`, err);
    }
}

/**
 * Sync proposal/application to database
 */
export async function syncProposalToDatabase(
    jobId: bigint,
    freelancerAddress: string,
    blockNumber?: bigint
): Promise<void> {
    if (!supabaseAdmin) {
        console.warn('[Sync] Supabase not configured, skipping proposal sync');
        return;
    }

    try {
        const jobBoard = getContract({
            client,
            chain: CHAIN,
            address: DEPLOYED_CONTRACTS.addresses.JobBoard as `0x${string}`,
        });

        // Fetch application details from blockchain
        const appDetails = await readContract({
            contract: jobBoard,
            method: 'function getApplicantDetails(uint256,address) view returns (address,uint64,string,uint256,uint64)',
            params: [jobId, freelancerAddress],
        });

        // Check if application exists (freelancer address should not be zero)
        if (appDetails[0] === '0x0000000000000000000000000000000000000000') {
            console.log(`[Sync] No application for job ${jobId} by ${freelancerAddress}`);
            return;
        }

        const proposalData: Database['public']['Tables']['proposals']['Insert'] = {
            job_id: Number(jobId),
            freelancer_address: freelancerAddress.toLowerCase(),
            proposal_text: (appDetails[2] as string) || null, // proposalURI - will be IPFS URI
            bid_amount: Number(appDetails[3]),
            delivery_days: Number(appDetails[4]),
            applied_at: Number(appDetails[1]),
            status: 'pending', // Default status
        };

        // Upsert to database
        const { error } = await supabaseAdmin
            .from('proposals')
            .upsert(proposalData, { onConflict: 'job_id,freelancer_address' });

        if (error) {
            console.error(`[Sync] Failed to sync proposal for job ${jobId}:`, error);
        } else {
            console.log(`[Sync] ✓ Synced proposal for job ${jobId} by ${freelancerAddress}`);
        }
    } catch (err) {
        console.error(`[Sync] Error syncing proposal for job ${jobId}:`, err);
    }
}


/**
 * Sync escrow to database
 */
export async function syncEscrowToDatabase(
    escrowAddress: string,
    jobId: bigint,
    blockNumber?: bigint
): Promise<void> {
    if (!supabaseAdmin) {
        console.warn('[Sync] Supabase not configured, skipping escrow sync');
        return;
    }

    try {
        const escrow = getContract({
            client,
            chain: CHAIN,
            address: escrowAddress as `0x${string}`,
        });

        const [client_addr, freelancer_addr, amount, delivered, disputed, terminal, deadlines] =
            await Promise.all([
                readContract({ contract: escrow, method: 'function client() view returns (address)' }),
                readContract({ contract: escrow, method: 'function freelancer() view returns (address)' }),
                readContract({ contract: escrow, method: 'function amount() view returns (uint256)' }),
                readContract({ contract: escrow, method: 'function delivered() view returns (bool)' }),
                readContract({ contract: escrow, method: 'function disputed() view returns (bool)' }),
                readContract({ contract: escrow, method: 'function terminal() view returns (bool)' }),
                readContract({ contract: escrow, method: 'function currentDeadlines() view returns (uint64,uint64,uint64)' }),
            ]);

        const escrowData: Database['public']['Tables']['escrows']['Insert'] = {
            escrow_address: escrowAddress.toLowerCase(),
            job_id: Number(jobId),
            client_address: (client_addr as string).toLowerCase(),
            freelancer_address: (freelancer_addr as string).toLowerCase(),
            amount: Number(amount),
            delivered: Boolean(delivered),
            disputed: Boolean(disputed),
            terminal: Boolean(terminal),
            cancel_end: (deadlines as any)[0] ? Number((deadlines as any)[0]) : null,
            delivery_due: (deadlines as any)[1] ? Number((deadlines as any)[1]) : null,
            review_due: (deadlines as any)[2] ? Number((deadlines as any)[2]) : null,
            last_delivery_uri: null, // Will be updated on delivery events
            last_dispute_uri: null, // Will be updated on dispute events
            blockchain_block: blockNumber ? Number(blockNumber) : null,
        };

        const { error } = await supabaseAdmin
            .from('escrows')
            .upsert(escrowData, { onConflict: 'escrow_address' });

        if (error) {
            console.error(`[Sync] Failed to sync escrow ${escrowAddress}:`, error);
        } else {
            console.log(`[Sync] ✓ Synced escrow ${escrowAddress}`);
        }
    } catch (err) {
        console.error(`[Sync] Error syncing escrow ${escrowAddress}:`, err);
    }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handle JobPosted event
 */
export async function handleJobPostedEvent(event: any) {
    const jobId = event.args.jobId;
    const blockNumber = event.blockNumber;

    console.log(`[Event] JobPosted: ${jobId} at block ${blockNumber}`);
    await syncJobToDatabase(jobId, blockNumber);
}

/**
 * Handle JobHired event
 */
export async function handleJobHiredEvent(event: any) {
    const jobId = event.args.jobId;
    const freelancer = event.args.freelancer;
    const escrowAddress = event.args.escrow;
    const blockNumber = event.blockNumber;

    console.log(`[Event] JobHired: ${jobId} → ${freelancer} at block ${blockNumber}`);

    // Update job status
    await syncJobToDatabase(jobId, blockNumber);

    // Sync escrow
    await syncEscrowToDatabase(escrowAddress, jobId, blockNumber);

    // Sync freelancer profile
    await syncProfileToDatabase(freelancer, blockNumber);
}

/**
 * Handle WorkDelivered event
 */
export async function handleWorkDeliveredEvent(event: any) {
    const jobKey = event.args.jobKey;
    const deliveryURI = event.args.deliveryURI;
    const blockNumber = event.blockNumber;
    const timestamp = event.args.timestamp || Math.floor(Date.now() / 1000);

    console.log(`[Event] WorkDelivered: ${jobKey} at block ${blockNumber}`);

    // Update escrow
    if (supabaseAdmin) {
        // Get current delivery count for version number
        const { data: history } = await supabaseAdmin
            .from('delivery_history')
            .select('version')
            .eq('escrow_address', jobKey.toLowerCase())
            .order('version', { ascending: false })
            .limit(1);

        const nextVersion = history && history.length > 0 ? history[0].version + 1 : 1;

        // Add to delivery history
        await supabaseAdmin
            .from('delivery_history')
            .insert({
                escrow_address: jobKey.toLowerCase(),
                delivery_uri: deliveryURI,
                timestamp: Number(timestamp),
                version: nextVersion,
            });

        // Update escrow with latest delivery
        await supabaseAdmin
            .from('escrows')
            .update({
                delivered: true,
                last_delivery_uri: deliveryURI,
            })
            .eq('escrow_address', jobKey.toLowerCase());
    }
}


/**
 * Handle DisputeRaised event
 */
export async function handleDisputeRaisedEvent(event: any) {
    const jobKey = event.args.jobKey;
    const reasonURI = event.args.reasonURI;
    const blockNumber = event.blockNumber;

    console.log(`[Event] DisputeRaised: ${jobKey} at block ${blockNumber}`);

    // Update escrow
    if (supabaseAdmin) {
        await supabaseAdmin
            .from('escrows')
            .update({
                disputed: true,
                last_dispute_uri: reasonURI,
            })
            .eq('escrow_address', jobKey.toLowerCase());
    }
}

/**
 * Handle JobCompleted event
 */
export async function handleJobCompletedEvent(event: any) {
    const jobId = event.args.jobId;
    const blockNumber = event.blockNumber;

    console.log(`[Event] JobCompleted: ${jobId} at block ${blockNumber}`);

    // Update job status
    await syncJobToDatabase(jobId, blockNumber);

    // Mark escrow as terminal
    if (supabaseAdmin) {
        const { data: job } = await supabaseAdmin
            .from('jobs')
            .select('escrow_address')
            .eq('job_id', Number(jobId))
            .single();

        if (job?.escrow_address) {
            await supabaseAdmin
                .from('escrows')
                .update({ terminal: true })
                .eq('escrow_address', job.escrow_address);
        }
    }
}

/**
 * Handle JobApplied event
 */
export async function handleJobAppliedEvent(event: any) {
    const jobId = event.args.jobId;
    const freelancer = event.args.freelancer;
    const blockNumber = event.blockNumber;

    console.log(`[Event] JobApplied: ${jobId} by ${freelancer} at block ${blockNumber}`);

    // Sync proposal to database
    await syncProposalToDatabase(jobId, freelancer, blockNumber);
}


// ============================================================================
// BATCH SYNC
// ============================================================================

/**
 * Sync all jobs from blockchain to database
 * Use this for initial sync or reconciliation
 */
export async function syncAllJobs(fromBlock: bigint = 0n): Promise<void> {
    if (!supabaseAdmin) {
        console.warn('[Sync] Supabase not configured, skipping batch sync');
        return;
    }

    try {
        const jobBoard = getContract({
            client,
            chain: CHAIN,
            address: DEPLOYED_CONTRACTS.addresses.JobBoard as `0x${string}`,
        });

        const nextJobId = await readContract({
            contract: jobBoard,
            method: 'function nextJobId() view returns (uint256)',
        });
        const totalJobs = Number(nextJobId);

        console.log(`[Sync] Starting batch sync of ${totalJobs} jobs...`);

        for (let i = 0; i < totalJobs; i++) {
            await syncJobToDatabase(BigInt(i));

            // Add small delay to avoid rate limiting
            if (i % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        console.log(`[Sync] ✓ Batch sync complete: ${totalJobs} jobs`);
    } catch (err) {
        console.error('[Sync] Batch sync error:', err);
    }
}
