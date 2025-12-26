"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getContract, readContract, prepareContractCall, sendTransaction } from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface DirectOffer {
    jobId: string;
    client: string;
    freelancer: string;
    title: string;
    descriptionURI: string;
    budgetUSDT: string; // 6 decimals
    deliveryDays: string;
    createdAt: string;
    expiresAt: string;
    accepted: boolean;
    rejected: boolean;
    cancelled: boolean;
    jobStatus?: number; // 0=Unknown, 1=Open, 2=Hired, etc.
}

export default function FreelancerProposalsPage() {
    const account = useActiveAccount();
    const router = useRouter();
    const { toast } = useToast();

    const [offers, setOffers] = useState<DirectOffer[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        if (!account) return;

        async function fetchOffers() {
            try {
                setLoading(true);
                const jobBoard = getContract({
                    client,
                    chain: CHAIN,
                    address: DEPLOYED_CONTRACTS.addresses.JobBoard,
                });

                // 1. Get List of Job IDs offered TO this freelancer
                const jobIds = await readContract({
                    contract: jobBoard,
                    method: "function getOffersToFreelancer(address) view returns (uint256[])",
                    params: [account!.address],
                });

                if (!jobIds || jobIds.length === 0) {
                    setOffers([]);
                    return;
                }

                // 2. Fetch details for each offer
                const offerPromises = [...jobIds].reverse().map(async (idBig) => {
                    try {
                        const offerData = await readContract({
                            contract: jobBoard,
                            method: "function getDirectOffer(uint256) view returns ((uint256,address,address,string,string,uint256,uint64,uint64,uint64,bool,bool,bool))",
                            params: [idBig]
                        }) as any;

                        // Also check JOB status
                        const jobData = await readContract({
                            contract: jobBoard,
                            method: "function getJob(uint256) view returns (address,string,string,uint256,uint8,address,address,uint64,uint64,uint64,bytes32[],uint256)",
                            params: [idBig]
                        }) as any;

                        return {
                            jobId: idBig.toString(),
                            client: offerData[1],
                            freelancer: offerData[2],
                            title: offerData[3],
                            descriptionURI: offerData[4],
                            budgetUSDT: offerData[5].toString(),
                            deliveryDays: offerData[6].toString(),
                            createdAt: offerData[7].toString(),
                            expiresAt: offerData[8].toString(),
                            accepted: offerData[9],
                            rejected: offerData[10],
                            cancelled: offerData[11],
                            jobStatus: Number(jobData[4])
                        };
                    } catch (e) {
                        console.error("Error fetching offer", idBig, e);
                        return null;
                    }
                });

                const results = await Promise.all(offerPromises);
                setOffers(results.filter(o => o !== null) as DirectOffer[]);

            } catch (err) {
                console.error("Failed to load offers", err);
            } finally {
                setLoading(false);
            }
        }

        fetchOffers();
    }, [account]);

    const handleAccept = async (jobId: string) => {
        if (!account) return;
        try {
            setProcessing(jobId);

            const jobBoard = getContract({
                client,
                chain: CHAIN,
                address: DEPLOYED_CONTRACTS.addresses.JobBoard,
            });

            const tx = prepareContractCall({
                contract: jobBoard,
                method: "function acceptDirectOffer(uint256)",
                params: [BigInt(jobId)]
            });

            await sendTransaction({ transaction: tx, account });

            toast({
                title: "Offer Accepted!",
                description: "Waiting for client to fund the escrow.",
            });

            // Update local state
            setOffers(prev => prev.map(o =>
                o.jobId === jobId ? { ...o, accepted: true, jobStatus: 1 } : o
            ));

        } catch (err: any) {
            console.error("Accept failed", err);
            toast({
                title: "Failed to Accept",
                description: err.message || "Unknown error",
                variant: "destructive"
            });
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async (jobId: string) => {
        if (!account) return;
        try {
            setProcessing(jobId);
            const jobBoard = getContract({
                client,
                chain: CHAIN,
                address: DEPLOYED_CONTRACTS.addresses.JobBoard,
            });

            const tx = prepareContractCall({
                contract: jobBoard,
                method: "function rejectDirectOffer(uint256)",
                params: [BigInt(jobId)]
            });

            await sendTransaction({ transaction: tx, account });
            toast({ title: "Offer Rejected" });

            setOffers(prev => prev.map(o => o.jobId === jobId ? { ...o, rejected: true } : o));
        } catch (err) {
            toast({ title: "Reject Failed", variant: "destructive" });
        } finally {
            setProcessing(null);
        }
    };

    if (!account) {
        return <div className="p-8">Please connect wallet.</div>;
    }

    if (loading) {
        return <div className="p-8"><Loader2 className="animate-spin" /> Loading proposals...</div>;
    }

    const pending = offers.filter(o => !o.accepted && !o.rejected && !o.cancelled);
    // Accepted offers that are NOT yet Hired (Status 1 = Open)
    const waitingFunding = offers.filter(o => o.accepted && o.jobStatus === 1);
    // Active/Completed/History
    const active = offers.filter(o => o.jobStatus === 2 || o.jobStatus === 4); // Hired or Completed
    const archived = offers.filter(o => o.rejected || o.cancelled || o.jobStatus === 3 || o.jobStatus === 5);

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Direct Proposals</h1>
            </div>

            <Tabs defaultValue="pending" className="w-full">
                <TabsList>
                    <TabsTrigger value="pending">Received Proposals ({pending.length})</TabsTrigger>
                    <TabsTrigger value="waiting">Waiting for Funding ({waitingFunding.length})</TabsTrigger>
                    <TabsTrigger value="active">Active/Completed Jobs</TabsTrigger>
                    <TabsTrigger value="archived">Archived</TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="space-y-4 pt-4">
                    {pending.length === 0 && <p className="text-muted-foreground">No new proposals.</p>}
                    {pending.map(offer => (
                        <ProposalCard
                            key={offer.jobId}
                            offer={offer}
                            onAccept={() => handleAccept(offer.jobId)}
                            onReject={() => handleReject(offer.jobId)}
                            processing={processing === offer.jobId}
                        />
                    ))}
                </TabsContent>

                <TabsContent value="waiting" className="space-y-4 pt-4">
                    {waitingFunding.length === 0 && <p className="text-muted-foreground">No proposals waiting for funding.</p>}
                    {waitingFunding.map(offer => (
                        <ProposalCard key={offer.jobId} offer={offer} isWaiting />
                    ))}
                </TabsContent>

                <TabsContent value="active" className="space-y-4 pt-4">
                    {active.length === 0 && <p className="text-muted-foreground">No active direct jobs.</p>}
                    {active.map(offer => (
                        <ProposalCard key={offer.jobId} offer={offer} isActive />
                    ))}
                </TabsContent>

                <TabsContent value="archived" className="space-y-4 pt-4">
                    {archived.length === 0 && <p className="text-muted-foreground">No archived proposals.</p>}
                    {archived.map(offer => (
                        <ProposalCard key={offer.jobId} offer={offer} isArchived />
                    ))}
                </TabsContent>
            </Tabs>
        </div>
    );
}

import { ipfsToHttp } from "@/utils/ipfs";

function ProposalCard({
    offer,
    onAccept,
    onReject,
    processing,
    isWaiting,
    isActive,
    isArchived
}: {
    offer: DirectOffer,
    onAccept?: () => void,
    onReject?: () => void,
    processing?: boolean,
    isWaiting?: boolean,
    isActive?: boolean,
    isArchived?: boolean
}) {
    const [description, setDescription] = useState<string>("");
    const [isFetching, setIsFetching] = useState(false);

    useEffect(() => {
        async function fetchDesc() {
            if (!offer.descriptionURI) return;
            if (!offer.descriptionURI.startsWith("ipfs://")) {
                setDescription(offer.descriptionURI); // Assume plain text
                return;
            }

            try {
                setIsFetching(true);
                const res = await fetch(ipfsToHttp(offer.descriptionURI));
                const data = await res.json();
                if (data.description) {
                    setDescription(data.description);
                } else {
                    setDescription(JSON.stringify(data));
                }
            } catch (err) {
                console.error("Failed to fetch proposal description", err);
                setDescription("Failed to load description details.");
            } finally {
                setIsFetching(false);
            }
        }
        fetchDesc();
    }, [offer.descriptionURI]);

    const statusColor =
        offer.cancelled ? "bg-red-500/10 text-red-500" :
            offer.rejected ? "bg-red-500/10 text-red-500" :
                offer.jobStatus === 2 ? "bg-green-500/10 text-green-500" : // Hired
                    offer.jobStatus === 4 ? "bg-blue-500/10 text-blue-500" : // Completed
                        offer.accepted ? "bg-yellow-500/10 text-yellow-500" :
                            "bg-primary/10 text-primary";

    const statusText =
        offer.cancelled ? "Cancelled by Client" :
            offer.rejected ? "Rejected" :
                offer.jobStatus === 2 ? "Active (Funded)" :
                    offer.jobStatus === 4 ? "Completed" :
                        offer.accepted ? "Accepted (Waiting for Funding)" :
                            "New Proposal";

    return (
        <Card className="border-border">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>{offer.title}</CardTitle>
                        <CardDescription className="mt-1">
                            From Client: <span className="font-mono text-xs">{offer.client}</span>
                        </CardDescription>
                    </div>
                    <Badge variant="outline" className={statusColor}>
                        {statusText}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="text-sm text-foreground-secondary whitespace-pre-wrap">
                        {isFetching ? (
                            <span className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="w-3 h-3 animate-spin" /> Loading details...
                            </span>
                        ) : (
                            description || <span className="italic text-muted-foreground">No description provided.</span>
                        )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                        Valid until: {offer.expiresAt === "0" ? "No Expiry" : new Date(Number(offer.expiresAt) * 1000).toLocaleDateString()}
                    </p>

                    <div className="flex gap-6 text-sm">
                        <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-green-600" />
                            <span className="font-bold">{(Number(offer.budgetUSDT) / 1e6).toFixed(2)} USDT</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-600" />
                            <span>{offer.deliveryDays} Days Delivery</span>
                        </div>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="gap-2 justify-end">
                {onAccept && onReject && !isWaiting && !isActive && !isArchived && (
                    <>
                        <Button variant="outline" onClick={onReject} disabled={processing}>
                            Reject
                        </Button>
                        <Button onClick={onAccept} disabled={processing} className="bg-primary hover:bg-primary/90">
                            {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Accept Proposal
                        </Button>
                    </>
                )}
                {isWaiting && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Client needs to fund this job to start.
                    </span>
                )}
                {isActive && (
                    <Button variant="secondary" size="sm" asChild>
                        <a href={`/freelancer/jobs/${offer.jobId}`}>View Job Details</a>
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
}
