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

export function FreelancerHiredNotification() {
    const router = useRouter();
    const activeAccount = useActiveAccount();
    const [myHiredJobs, setMyHiredJobs] = useState<string[]>([]);

    // Listen to global events
    const { latestJobHired } = useClientEvents();

    // Contract reference
    const jobBoard = useMemo(
        () =>
            getContract({
                client,
                chain: CHAIN,
                address: DEPLOYED_CONTRACTS.addresses.JobBoard,
            }),
        []
    );

    // 1. Check for missed hiring notifications on mount
    useEffect(() => {
        if (!activeAccount) {
            setMyHiredJobs([]);
            return;
        }

        const checkMissedHirings = async () => {
            try {
                console.log("🔍 Checking for missed hiring notifications...");

                // A. Get all jobs freelancer applied to
                const appliedJobIds = (await readContract({
                    contract: jobBoard,
                    method: "function getJobsAppliedBy(address) view returns (uint256[])",
                    params: [activeAccount.address],
                })) as bigint[];

                if (appliedJobIds.length === 0) {
                    console.log("📭 No applied jobs yet");
                    return;
                }

                const stringIds = appliedJobIds.map((id) => id.toString());

                // B. Check which ones hired me
                let totalNewHires = 0;
                const newHired: string[] = [];

                for (const jobId of stringIds) {
                    try {
                        // Get job details
                        const jobData = await readContract({
                            contract: jobBoard,
                            method: "function getJob(uint256) view returns (address,string,string,uint256,uint8,address,address,uint64,uint64,uint64,bytes32[],uint256)",
                            params: [BigInt(jobId)],
                        });

                        const [, title, , , status, hiredFreelancer] = jobData as any;

                        // Check if I was hired (status 2 = Hired, hiredFreelancer = me)
                        if (
                            Number(status) === 2 &&
                            hiredFreelancer.toLowerCase() === activeAccount.address.toLowerCase()
                        ) {
                            // Check if we already notified about this
                            const storageKey = `freelancer_hired_${activeAccount.address}_${jobId}`;
                            const wasNotified = localStorage.getItem(storageKey);

                            if (!wasNotified) {
                                totalNewHires++;
                                newHired.push(jobId);
                                console.log(`🎉 Newly hired for job #${jobId}: "${title}"`);

                                // Mark as notified
                                localStorage.setItem(storageKey, "true");
                            }
                        }
                    } catch (err) {
                        console.error(`Error checking job #${jobId}:`, err);
                    }
                }

                setMyHiredJobs(newHired);

                // C. Show aggregated notification for missed hirings
                if (totalNewHires > 0) {
                    toast.success("🎉 Congratulations!", {
                        description: totalNewHires === 1
                            ? "You were hired for a new job while you were away!"
                            : `You were hired for ${totalNewHires} jobs while you were away!`,
                        action: {
                            label: "View Jobs",
                            onClick: () => router.push("/freelancer"),
                        },
                        duration: 8000,
                    });
                } else {
                    console.log("✅ All caught up! No new hirings.");
                }

            } catch (err) {
                console.error("❌ Error checking missed hirings:", err);
            }
        };

        checkMissedHirings();
    }, [activeAccount, jobBoard, router]);

    // 2. Handle Live Hiring Events (Real-time when online)
    useEffect(() => {
        if (!latestJobHired || !activeAccount) return;

        const { jobId, freelancer } = latestJobHired;

        // Check if I was hired
        if (freelancer.toLowerCase() === activeAccount.address.toLowerCase()) {
            console.log("🎉 Live notification: You were hired for job", jobId);

            // Fetch job title for the notification
            const showHiredNotification = async () => {
                try {
                    // Get job details to extract title
                    const jobData = await readContract({
                        contract: jobBoard,
                        method: "function getJob(uint256) view returns (address,string,string,uint256,uint8,address,address,uint64,uint64,uint64,bytes32[],uint256)",
                        params: [BigInt(jobId)],
                    });

                    const jobTitle = jobData[1] as string;

                    // Mark as notified in localStorage
                    const storageKey = `freelancer_hired_${activeAccount.address}_${jobId}`;
                    localStorage.setItem(storageKey, "true");

                    // Show toast with job title
                    toast.success("🎉 You've Been Hired!", {
                        description: `Congratulations! The client hired you for "${jobTitle}"`,
                        action: {
                            label: "View Job",
                            onClick: () => router.push(`/freelancer/jobs/${jobId}`),
                        },
                        duration: 6000,
                    });

                    // Update state to refresh dashboard if needed
                    setMyHiredJobs((prev) => [...prev, jobId]);

                } catch (err) {
                    console.error("Error fetching job title for hired notification:", err);

                    // Fallback notification without title
                    const storageKey = `freelancer_hired_${activeAccount.address}_${jobId}`;
                    localStorage.setItem(storageKey, "true");

                    toast.success("🎉 You've Been Hired!", {
                        description: `Congratulations! You were hired for job #${jobId}`,
                        action: {
                            label: "View Job",
                            onClick: () => router.push(`/freelancer/jobs/${jobId}`),
                        },
                        duration: 6000,
                    });
                }
            };

            showHiredNotification();
        }
    }, [latestJobHired, activeAccount, router, jobBoard]);

    return null;
}
