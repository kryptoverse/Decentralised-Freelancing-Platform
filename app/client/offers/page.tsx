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
import { ipfsToHttp } from "@/utils/ipfs";
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

export default function ClientOffersPage() {
    const account = useActiveAccount();
    const router = useRouter();
    const { toast } = useToast();

    const [offers, setOffers] = useState<DirectOffer[]>([]);
    const [loading, setLoading] = useState(true);
    const [funding, setFunding] = useState<string | null>(null);

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

                // 1. Get List of Job IDs offered by this client
                const jobIds = await readContract({
                    contract: jobBoard,
                    method: "function getOffersFromClient(address) view returns (uint256[])",
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

                        // offerData is a struct/tuple. Order:
                        // 0: jobId
                        // 1: client
                        // 2: freelancer
                        // 3: title
                        // 4: descriptionURI
                        // 5: budgetUSDT
                        // 6: deliveryDays
                        // 7: createdAt
                        // 8: expiresAt
                        // 9: accepted
                        // 10: rejected
                        // 11: cancelled

                        // Also check JOB status to see if it's already "Hired" (Funded)
                        // because "accepted" stays true forever.
                        const jobData = await readContract({
                            contract: jobBoard,
                            method: "function getJob(uint256) view returns (address,string,string,uint256,uint8,address,address,uint64,uint64,uint64,bytes32[],uint256)",
                            params: [idBig]
                        }) as any;

                        // jobData[4] is status enum. 
                        // Unknown=0, Open=1, Hired=2, Cancelled=3, Completed=4, Expired=5
                        // Direct offers start as Unknown(0). Accepted -> Open(1). Hired -> Hired(2).

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

    const handleFundJob = async (offer: DirectOffer) => {
        if (!account) return;
        try {
            setFunding(offer.jobId);

            const budgetVal = BigInt(offer.budgetUSDT);

            // 1. Approve Allowanceto EscrowFactory (Not JobBoard! Factory pulls funds)
            const usdc = getContract({
                client,
                chain: CHAIN,
                address: DEPLOYED_CONTRACTS.addresses.MockUSDT,
            });

            const allowance = await readContract({
                contract: usdc,
                method: "function allowance(address owner, address spender) view returns (uint256)",
                params: [account.address, DEPLOYED_CONTRACTS.addresses.EscrowFactory]
            });

            if (allowance < budgetVal) {
                const approveTx = prepareContractCall({
                    contract: usdc,
                    method: "function approve(address spender, uint256 amount) returns (bool)",
                    params: [DEPLOYED_CONTRACTS.addresses.EscrowFactory, budgetVal]
                });
                await sendTransaction({ transaction: approveTx, account });

                toast({
                    title: "Approved",
                    description: "USDT Approved. Please confirm the funding transaction next.",
                });
            }

            // 2. Call EscrowFactory.createAndFundEscrowForJob
            const escrowFactory = getContract({
                client,
                chain: CHAIN,
                address: DEPLOYED_CONTRACTS.addresses.EscrowFactory,
            });

            // We need metadata URI (we can reuse descriptionURI or just empty for now)
            // Params: jobId, freelancer, amountUSDT, metadataURI, cancelWindow, deliveryDue, reviewWindow, defaultRating

            // Delivery Due Calculation: current time + days? 
            // Or is it relative? `createAndFundEscrow` takes `deliveryDueTs` (timestamp).
            // So we need: now + days * 86400.
            const deliveryTs = BigInt(Math.floor(Date.now() / 1000) + (Number(offer.deliveryDays) * 86400));

            const tx = prepareContractCall({
                contract: escrowFactory,
                method: "function createAndFundEscrowForJob(uint256,address,uint256,string,uint64,uint64,uint64,uint8) returns (address)",
                params: [
                    BigInt(offer.jobId),
                    offer.freelancer,
                    budgetVal,
                    offer.descriptionURI,
                    BigInt(86400 * 3), // Cancel window: 3 days (default)
                    deliveryTs,
                    BigInt(86400 * 3), // Review window: 3 days (default)
                    5 // Default rating 5
                ]
            });

            await sendTransaction({ transaction: tx, account });

            toast({
                title: "Job Funded!",
                description: "Escrow created and job started successfully.",
            });

            // Refresh offers (eager update)
            setOffers(prev => prev.map(o =>
                o.jobId === offer.jobId ? { ...o, jobStatus: 2 } : o
            ));

        } catch (err: any) {
            console.error("Funding failed", err);
            toast({
                title: "Funding Failed",
                description: err.message || "Unknown error",
                variant: "destructive"
            });
        } finally {
            setFunding(null);
        }
    };

    const handleCancel = async (jobId: string) => {
        if (!account) return;
        try {
            const jobBoard = getContract({
                client,
                chain: CHAIN,
                address: DEPLOYED_CONTRACTS.addresses.JobBoard,
            });

            const tx = prepareContractCall({
                contract: jobBoard,
                method: "function cancelDirectOffer(uint256)",
                params: [BigInt(jobId)]
            });

            await sendTransaction({ transaction: tx, account });
            toast({ title: "Offer Cancelled" });

            setOffers(prev => prev.map(o => o.jobId === jobId ? { ...o, cancelled: true } : o));
        } catch (err) {
            toast({ title: "Cancel Failed", variant: "destructive" });
        }
    };

    if (!account) {
        return <div className="p-8">Please connect wallet.</div>;
    }

    if (loading) {
        return <div className="p-8"><Loader2 className="animate-spin" /> Loading offers...</div>;
    }

    const pending = offers.filter(o => !o.accepted && !o.rejected && !o.cancelled);
    const accepted = offers.filter(o => o.accepted && o.jobStatus === 1); // 1 = Open (Accepted but not Hired yet)
    const history = offers.filter(o => o.rejected || o.cancelled || o.jobStatus === 2 || o.jobStatus === 4);
    // 2=Hired, 4=Completed. Note: Once hired, it's basically "history" of the offer, but "active" job. 
    // Maybe we want an "Active Jobs" tab, but client already has "My Jobs". 
    // So putting Funded offers in History is fine, or a separate "Active" tab. 
    // User asked for "My Offers".

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">My Sent Offers</h1>
            </div>

            <Tabs defaultValue="accepted" className="w-full">
                <TabsList>
                    <TabsTrigger value="accepted">Accepted (Action Required)</TabsTrigger>
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                <TabsContent value="accepted" className="space-y-4 pt-4">
                    {accepted.length === 0 && <p className="text-muted-foreground">No accepted offers waiting for funding.</p>}
                    {accepted.map(offer => (
                        <OfferCard
                            key={offer.jobId}
                            offer={offer}
                            onFund={() => handleFundJob(offer)}
                            funding={funding === offer.jobId}
                        />
                    ))}
                </TabsContent>

                <TabsContent value="pending" className="space-y-4 pt-4">
                    {pending.length === 0 && <p className="text-muted-foreground">No pending offers.</p>}
                    {pending.map(offer => (
                        <OfferCard
                            key={offer.jobId}
                            offer={offer}
                            onCancel={() => handleCancel(offer.jobId)}
                        />
                    ))}
                </TabsContent>

                <TabsContent value="history" className="space-y-4 pt-4">
                    {history.length === 0 && <p className="text-muted-foreground">No history.</p>}
                    {history.map(offer => (
                        <OfferCard key={offer.jobId} offer={offer} isHistory />
                    ))}
                </TabsContent>
            </Tabs>
        </div>
    );
}

function OfferCard({
    offer,
    onFund,
    onCancel,
    funding,
    isHistory
}: {
    offer: DirectOffer,
    onFund?: () => void,
    onCancel?: () => void,
    funding?: boolean,
    isHistory?: boolean
}) {
    const statusColor =
        offer.cancelled ? "bg-red-500/10 text-red-500" :
            offer.rejected ? "bg-red-500/10 text-red-500" :
                offer.jobStatus === 2 ? "bg-green-500/10 text-green-500" : // Hired
                    offer.jobStatus === 4 ? "bg-blue-500/10 text-blue-500" : // Completed
                        offer.accepted ? "bg-yellow-500/10 text-yellow-500" : // Accepted (Waiting)
                            "bg-gray-500/10 text-gray-500"; // Pending

    const statusText =
        offer.cancelled ? "Cancelled" :
            offer.rejected ? "Rejected" :
                offer.jobStatus === 2 ? "Hired & Funded" :
                    offer.jobStatus === 4 ? "Completed" :
                        offer.accepted ? "Accepted - Needs Funding" :
                            "Pending";

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>{offer.title}</CardTitle>
                        <CardDescription className="mt-1">
                            To: <span className="font-mono text-xs">{offer.freelancer}</span>
                        </CardDescription>
                    </div>
                    <Badge variant="outline" className={statusColor}>
                        {statusText}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex gap-6 text-sm">
                    <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span>{(Number(offer.budgetUSDT) / 1e6).toFixed(2)} USDT</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span>{offer.deliveryDays} Days</span>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="gap-2 justify-end">
                {onFund && (
                    <Button onClick={onFund} disabled={funding} className="bg-green-600 hover:bg-green-700">
                        {funding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Fund & Start Job
                    </Button>
                )}
                {onCancel && (
                    <Button variant="destructive" onClick={onCancel} size="sm">
                        Cancel Offer
                    </Button>
                )}
                {isHistory && offer.jobStatus === 2 && (
                    <div className="flex items-center gap-2 text-sm text-green-500">
                        <CheckCircle className="w-4 h-4" /> Funded
                    </div>
                )}
            </CardFooter>
        </Card>
    );
}
