"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, User, ExternalLink, Scale } from "lucide-react";
import { ipfsToHttp } from "@/utils/ipfs";

interface DisputeInfoPanelProps {
    lastDisputeURI: string;
    clientAddr: string;
    freelancerAddr: string;
    terminal: boolean;         // true = escrow is settled (dispute resolved by admin)
    delivered: boolean;        // whether freelancer delivered any work
    lastDeliveryURI?: string;  // IPFS uri of latest delivery
    /** Pass 'freelancer' or 'client' to highlight which side YOU are */
    viewerRole?: "freelancer" | "client";
}

export default function DisputeInfoPanel({
    lastDisputeURI,
    clientAddr,
    freelancerAddr,
    terminal,
    delivered,
    lastDeliveryURI,
    viewerRole,
}: DisputeInfoPanelProps) {
    const [reason, setReason] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!lastDisputeURI) return;
        setLoading(true);

        const fetchReason = async () => {
            try {
                const url = ipfsToHttp(lastDisputeURI);
                const res = await fetch(url);
                const data = await res.json();
                setReason(data.reason || data.description || JSON.stringify(data));
            } catch {
                setReason("Could not load dispute reason from IPFS.");
            } finally {
                setLoading(false);
            }
        };

        fetchReason();
    }, [lastDisputeURI]);

    const resolved = terminal;
    const borderColor = resolved ? "border-green-500/30" : "border-red-500/40";
    const bgColor = resolved ? "bg-green-500/5" : "bg-red-500/5";
    const titleColor = resolved ? "text-green-400" : "text-red-400";
    const iconColor = resolved ? "text-green-400" : "text-red-400";

    return (
        <section
            className={`p-5 border rounded-2xl space-y-4 ${borderColor} ${bgColor}`}
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Scale className={`w-5 h-5 ${iconColor}`} />
                    <h3 className={`text-base font-semibold ${titleColor}`}>
                        {resolved ? "✅ Dispute Resolved" : "⚠️ Dispute Active"}
                    </h3>
                </div>
                <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium border ${resolved
                            ? "bg-green-500/10 text-green-400 border-green-500/30"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        }`}
                >
                    {resolved ? "Resolved" : "Pending Admin Decision"}
                </span>
            </div>

            {/* Status context */}
            {!resolved && (
                <p className="text-sm text-muted-foreground">
                    This job is currently under review by a platform administrator. Both parties should wait for the admin decision. The escrow funds are frozen until resolution.
                    {viewerRole === "freelancer" && " You can still submit additional work versions to strengthen your case."}
                </p>
            )}
            {resolved && (
                <p className="text-sm text-muted-foreground">
                    The admin has reviewed this dispute and issued a final decision. The escrow is now finalized. Check your completed or cancelled jobs for the outcome.
                </p>
            )}

            {/* Dispute Reason */}
            <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dispute Reason</p>
                <div className={`p-3 rounded-xl text-sm ${resolved ? "bg-surface-secondary" : "bg-red-500/5 border border-red-500/20"}`}>
                    {loading ? (
                        <span className="text-muted-foreground italic">Loading reason from IPFS…</span>
                    ) : reason ? (
                        <p className="whitespace-pre-wrap">{reason}</p>
                    ) : lastDisputeURI ? (
                        <a href={ipfsToHttp(lastDisputeURI)} target="_blank" rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1 text-xs">
                            View on IPFS <ExternalLink className="w-3 h-3" />
                        </a>
                    ) : (
                        <span className="text-muted-foreground italic">No reason provided</span>
                    )}
                </div>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-surface-secondary space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <User className="w-3.5 h-3.5" />
                        <span>Client{viewerRole === "client" ? " (You)" : ""}</span>
                    </div>
                    <p className="text-xs font-mono text-foreground leading-relaxed break-all">{clientAddr}</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-secondary space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <User className="w-3.5 h-3.5" />
                        <span>Freelancer{viewerRole === "freelancer" ? " (You)" : ""}</span>
                    </div>
                    <p className="text-xs font-mono text-foreground leading-relaxed break-all">{freelancerAddr}</p>
                </div>
            </div>

            {/* Freelancer Delivery Reference */}
            {delivered && lastDeliveryURI && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-surface-secondary">
                    <span className="text-xs text-muted-foreground">Latest submitted work</span>
                    <a
                        href={ipfsToHttp(lastDeliveryURI)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                        View Delivery <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
            )}

            {/* Admin Status */}
            <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium ${resolved
                    ? "bg-green-500/10 text-green-400 border border-green-500/20"
                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                }`}>
                {resolved
                    ? <><CheckCircle2 className="w-4 h-4 shrink-0" /> Admin decision finalized. The escrow has been settled.</>
                    : <><Clock className="w-4 h-4 shrink-0" /> Awaiting admin review. No action required from you at this time.</>
                }
            </div>
        </section>
    );
}
