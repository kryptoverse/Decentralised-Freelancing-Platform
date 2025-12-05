"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { getContract, readContract } from "thirdweb";
import { toast } from "sonner";
import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { useClientEvents } from "@/contexts/ClientEventsContext";
import { executeWithFallback } from "@/lib/multi-rpc-client";

export function ClientGlobalNotifications() {
    const router = useRouter();
    const activeAccount = useActiveAccount();
    const [myJobIds, setMyJobIds] = useState<string[]>([]);

    // Keep the live listener for when client is online
    const { latestJobApplied } = useClientEvents();

    // Standard contract for live operations
    const jobBoard = useMemo(
        () =>
            getContract({
                client,
                chain: CHAIN,
                address: DEPLOYED_CONTRACTS.addresses.JobBoard,
            }),
        []
    );

    // 1. Fetch Jobs & Check for Missed Applicants (State Diff Approach)
    // This runs ONCE when user logs in and checks what they missed
    useEffect(() => {
        if (!activeAccount) {
            setMyJobIds([]);
            return;
        }

        const checkMissedApplicants = async () => {
            try {
                console.log("🔍 Checking for missed applications...");

                // A. Get all Job IDs for this client (using standard RPC)
                const ids = (await readContract({
                    contract: jobBoard,
                    method: "function jobsByClient(address) view returns (uint256[])",
                    params: [activeAccount.address],
                })) as bigint[];

                const stringIds = ids.map((id) => id.toString());
                setMyJobIds(stringIds);

                if (stringIds.length === 0) {
                    console.log("📭 No jobs posted yet");
                    return;
                }

                // B. Check applicant counts using Multi-RPC with fallback
                // 🔄 This operation uses: Infura API → Alchemy API (fallback) → Thirdweb (fallback)
                let totalNew = 0;
                const jobsWithNew: string[] = [];

                for (const jobId of stringIds) {
                    try {
                        // Use multi-RPC fallback for this operation to avoid rate limits
                        const currentCount = await executeWithFallback(async (multiClient) => {
                            const multiJobBoard = getContract({
                                client: multiClient,
                                chain: CHAIN,
                                address: DEPLOYED_CONTRACTS.addresses.JobBoard,
                            });

                            const countBig = await readContract({
                                contract: multiJobBoard,
                                method: "function getApplicantCount(uint256) view returns (uint256)",
                                params: [BigInt(jobId)],
                            });

                            return Number(countBig);
                        });

                        // Get stored count from local storage (what we knew about last time)
                        const storageKey = `job_applicants_${activeAccount.address}_${jobId}`;
                        const storedCount = parseInt(localStorage.getItem(storageKey) || "0");

                        // Compare: Do we have NEW applicants?
                        if (currentCount > storedCount) {
                            const newCount = currentCount - storedCount;
                            totalNew += newCount;
                            jobsWithNew.push(jobId);

                            console.log(`📬 Job #${jobId}: ${newCount} new applicant(s) (was ${storedCount}, now ${currentCount})`);

                            // Update storage so we don't notify again on refresh
                            localStorage.setItem(storageKey, currentCount.toString());
                        } else if (currentCount < storedCount) {
                            // Edge case: contract reset or re-deployment
                            console.log(`🔄 Job #${jobId}: Count decreased (contract reset?)`);
                            localStorage.setItem(storageKey, currentCount.toString());
                        } else {
                            // No change
                            console.log(`✓ Job #${jobId}: No new applicants (${currentCount} total)`);
                        }

                    } catch (err: any) {
                        console.error(`❌ Failed to check job #${jobId}:`, err.message);
                    }
                }

                // C. Notify user if they missed anything while offline
                if (totalNew > 0) {
                    toast.info("📬 While you were away...", {
                        description: `You received ${totalNew} new job application${totalNew > 1 ? 's' : ''}.`,
                        action: {
                            label: "View Jobs",
                            onClick: () => router.push("/client/dashboard"),
                        },
                        duration: 8000,
                    });
                } else {
                    console.log("✅ All caught up! No new applications.");
                }

            } catch (err) {
                console.error("❌ Error checking missed notifications:", err);
            }
        };

        checkMissedApplicants();
    }, [activeAccount, jobBoard, router]);

    // 2. Handle Live Events (Real-time when user is online)
    useEffect(() => {
        if (!latestJobApplied || !activeAccount) return;

        const { jobId } = latestJobApplied;

        // Check if this job belongs to the current user
        if (jobId && myJobIds.includes(jobId)) {
            console.log("🔔 Live notification: New applicant for job", jobId);

            // Fetch job title for the notification
            const showNotificationWithTitle = async () => {
                try {
                    // Get job details to extract title
                    const jobData = await readContract({
                        contract: jobBoard,
                        method: "function getJob(uint256) view returns (address,string,string,uint256,uint8,address,address,uint64,uint64,uint64,bytes32[],uint256)",
                        params: [BigInt(jobId)],
                    });

                    const jobTitle = jobData[1] as string; // Title is second field

                    // Update local storage count immediately (+1)
                    const storageKey = `job_applicants_${activeAccount.address}_${jobId}`;
                    const current = parseInt(localStorage.getItem(storageKey) || "0");
                    localStorage.setItem(storageKey, (current + 1).toString());

                    // Show toast with job title
                    toast.success("✨ New Application Received!", {
                        description: `A freelancer just applied to "${jobTitle}"`,
                        action: {
                            label: "View",
                            onClick: () => router.push(`/client/jobs/${jobId}`),
                        },
                        duration: 5000,
                    });
                } catch (err) {
                    console.error("Error fetching job title for notification:", err);

                    // Fallback to job ID if title fetch fails
                    const storageKey = `job_applicants_${activeAccount.address}_${jobId}`;
                    const current = parseInt(localStorage.getItem(storageKey) || "0");
                    localStorage.setItem(storageKey, (current + 1).toString());

                    toast.success("✨ New Application Received!", {
                        description: `A freelancer just applied to job #${jobId}`,
                        action: {
                            label: "View",
                            onClick: () => router.push(`/client/jobs/${jobId}`),
                        },
                        duration: 5000,
                    });
                }
            };

            showNotificationWithTitle();
        }
    }, [latestJobApplied, myJobIds, activeAccount, router, jobBoard]);

    return null;
}
