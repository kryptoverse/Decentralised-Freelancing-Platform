"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getContract, readContract } from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { SpacetimeChat } from "@/components/chat/SpacetimeChat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Briefcase } from "lucide-react";

export default function ChatPage() {
    const { jobId } = useParams();
    const router = useRouter();
    const account = useActiveAccount();
    
    const [loading, setLoading] = useState(true);
    const [jobData, setJobData] = useState<any>(null);
    const [role, setRole] = useState<"client" | "freelancer" | "admin" | null>(null);

    useEffect(() => {
        if (!account || !jobId) return;

        async function fetchJobDetails() {
            try {
                const jobBoard = getContract({
                    client,
                    chain: CHAIN,
                    address: DEPLOYED_CONTRACTS.addresses.JobBoard,
                });

                // Fetch job info
                // Job Struct: client, title, description, budget, status, freelancer...
                const data = await readContract({
                    contract: jobBoard,
                    method: "function getJob(uint256) view returns (address,string,string,uint256,uint8,address,address,uint64,uint64,uint64,bytes32[],uint256)",
                    params: [BigInt(jobId as string)]
                }) as any;

                const clientAddress = data[0];
                const freelancerAddress = data[5];

                setJobData({
                    client: clientAddress,
                    title: data[1],
                    descriptionURI: data[2],
                    budget: data[3].toString(),
                    freelancer: freelancerAddress
                });

                // Determine role
                if (account?.address.toLowerCase() === clientAddress.toLowerCase()) {
                    setRole("client");
                } else if (account?.address.toLowerCase() === freelancerAddress.toLowerCase()) {
                    setRole("freelancer");
                } else {
                    // In a real app we'd verify admin status properly, for now if not client/freelancer, assume admin
                    setRole("admin");
                }

            } catch (err) {
                console.error("Failed to fetch job", err);
            } finally {
                setLoading(false);
            }
        }

        fetchJobDetails();
    }, [account, jobId]);

    if (!account) return <div className="p-8">Please connect wallet.</div>;
    if (loading) return <div className="p-8"><Loader2 className="animate-spin" /> Loading chat...</div>;
    if (!jobData) return <div className="p-8">Job not found.</div>;
    if (!role) return <div className="p-8">Unauthorized.</div>;

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
            <Button variant="ghost" onClick={() => router.back()} className="mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Project Details */}
                <div className="col-span-1 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Briefcase className="w-5 h-5 text-primary" />
                                Project Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <h3 className="font-semibold text-sm text-muted-foreground">Title</h3>
                                <p className="font-medium">{jobData.title}</p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm text-muted-foreground">Description</h3>
                                <p className="text-sm line-clamp-4">{jobData.descriptionURI}</p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm text-muted-foreground">Budget</h3>
                                <p className="text-sm">{(Number(jobData.budget) / 1e6).toFixed(2)} USDT</p>
                            </div>
                            <div className="pt-4 border-t">
                                <h3 className="font-semibold text-sm text-muted-foreground">Client</h3>
                                <p className="text-xs font-mono">{jobData.client}</p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm text-muted-foreground">Freelancer</h3>
                                <p className="text-xs font-mono">{jobData.freelancer || "Not assigned yet"}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Chat Section */}
                <div className="col-span-1 md:col-span-2">
                    <SpacetimeChat 
                        jobId={jobId as string}
                        clientAddress={jobData.client}
                        freelancerAddress={jobData.freelancer}
                        currentUserRole={role}
                    />
                </div>
            </div>
        </div>
    );
}
