"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useContractEvents } from "thirdweb/react";
import { getContract, prepareEvent } from "thirdweb";
import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";

interface ClientEventsContextType {
    latestJobApplied: {
        jobId: string;
        freelancer: string;
        timestamp: number;
    } | null;
    latestJobPosted: {
        jobId: string;
        client: string;
        timestamp: number;
    } | null;
    latestJobHired: {
        jobId: string;
        client: string;
        freelancer: string;
        escrow: string;
        timestamp: number;
    } | null;
    latestWorkDelivered: {
        jobKey: string;
        escrowAddress: string;
        deliveryURI: string;
        timestamp: number;
    } | null;
    latestPayment: {
        jobKey: string;
        escrowAddress: string;
        to: string;
        amount: string;
        timestamp: number;
    } | null;
}

const ClientEventsContext = createContext<ClientEventsContextType | undefined>(undefined);

export function ClientEventsProvider({ children }: { children: React.ReactNode }) {
    const [latestJobApplied, setLatestJobApplied] = useState<ClientEventsContextType["latestJobApplied"]>(null);
    const [latestJobPosted, setLatestJobPosted] = useState<ClientEventsContextType["latestJobPosted"]>(null);
    const [latestJobHired, setLatestJobHired] = useState<ClientEventsContextType["latestJobHired"]>(null);
    const [latestWorkDelivered, setLatestWorkDelivered] = useState<ClientEventsContextType["latestWorkDelivered"]>(null);
    const [latestPayment, setLatestPayment] = useState<ClientEventsContextType["latestPayment"]>(null);

    // 1. Get Contracts
    const jobBoard = useMemo(
        () =>
            getContract({
                client,
                chain: CHAIN,
                address: DEPLOYED_CONTRACTS.addresses.JobBoard,
            }),
        []
    );

    const escrowFactory = useMemo(
        () =>
            getContract({
                client,
                chain: CHAIN,
                address: DEPLOYED_CONTRACTS.addresses.EscrowFactory,
            }),
        []
    );

    // 2. Prepare JobBoard Events
    const jobAppliedEvent = useMemo(() => prepareEvent({
        signature: "event JobApplied(uint256 indexed jobId, address indexed freelancer, uint64 appliedAt)",
    }), []);

    const jobPostedEvent = useMemo(() => prepareEvent({
        signature: "event JobPosted(uint256 indexed jobId, address indexed client, string title, string descriptionURI, uint256 budgetUSDC, bytes32[] tags, uint64 expiresAt)",
    }), []);

    const jobHiredEvent = useMemo(() => prepareEvent({
        signature: "event JobHired(uint256 indexed jobId, address indexed client, address indexed freelancer, address escrow)",
    }), []);

    // 3. Prepare Escrow Events (from JobEscrow contract)
    const workDeliveredEvent = useMemo(() => prepareEvent({
        signature: "event WorkDelivered(bytes32 indexed jobKey, string uri)",
    }), []);

    const paidEvent = useMemo(() => prepareEvent({
        signature: "event Paid(bytes32 indexed jobKey, address indexed to, uint256 netAmount, uint256 feeAmount)",
    }), []);

    // 4. Listen to JobBoard events
    const { data: jobBoardEvents } = useContractEvents({
        contract: jobBoard,
        events: [jobAppliedEvent, jobPostedEvent, jobHiredEvent],
        watch: true,
    });

    // 5. Listen to Escrow events (via EscrowFactory or global)
    // Note: We'll listen to these events globally since they come from individual escrow contracts
    const { data: escrowEvents } = useContractEvents({
        contract: escrowFactory,
        events: [workDeliveredEvent, paidEvent],
        watch: true,
    });

    // 6. Update State on JobBoard Events
    useEffect(() => {
        if (!jobBoardEvents || jobBoardEvents.length === 0) return;

        const latest = jobBoardEvents[jobBoardEvents.length - 1];
        const eventName = latest.eventName;
        const args = latest.args as any;

        if (eventName === "JobApplied") {
            setLatestJobApplied((prev) => {
                if (prev?.jobId === args.jobId.toString() && prev?.freelancer === args.freelancer && prev?.timestamp === Number(args.appliedAt)) {
                    return prev;
                }

                console.log("🔔 Global Context: JobApplied Event", args);
                return {
                    jobId: args.jobId.toString(),
                    freelancer: args.freelancer,
                    timestamp: Number(args.appliedAt),
                };
            });
        } else if (eventName === "JobPosted") {
            setLatestJobPosted((prev) => {
                if (prev?.jobId === args.jobId.toString()) {
                    return prev;
                }

                console.log("📝 Global Context: JobPosted Event", args);
                return {
                    jobId: args.jobId.toString(),
                    client: args.client,
                    timestamp: Date.now(),
                };
            });
        } else if (eventName === "JobHired") {
            setLatestJobHired((prev) => {
                if (prev?.jobId === args.jobId.toString() && prev?.freelancer === args.freelancer) {
                    return prev;
                }

                console.log("🤝 Global Context: JobHired Event", args);
                return {
                    jobId: args.jobId.toString(),
                    client: args.client,
                    freelancer: args.freelancer,
                    escrow: args.escrow,
                    timestamp: Date.now(),
                };
            });
        }
    }, [jobBoardEvents]);

    // 7. Update State on Escrow Events
    useEffect(() => {
        if (!escrowEvents || escrowEvents.length === 0) return;

        const latest = escrowEvents[escrowEvents.length - 1];
        const eventName = latest.eventName;
        const args = latest.args as any;
        const txInfo = latest.transactionHash;

        if (eventName === "WorkDelivered") {
            setLatestWorkDelivered((prev) => {
                // Avoid duplicates using jobKey
                if (prev?.jobKey === args.jobKey) {
                    return prev;
                }

                console.log("📦 Global Context: WorkDelivered Event", args);
                return {
                    jobKey: args.jobKey,
                    escrowAddress: txInfo || "",
                    deliveryURI: args.uri,
                    timestamp: Date.now(),
                };
            });
        } else if (eventName === "Paid") {
            setLatestPayment((prev) => {
                // Avoid duplicates
                if (prev?.jobKey === args.jobKey && prev?.to === args.to) {
                    return prev;
                }

                console.log("💰 Global Context: Paid Event", args);
                return {
                    jobKey: args.jobKey,
                    escrowAddress: txInfo || "",
                    to: args.to,
                    amount: (Number(args.netAmount) / 1e6).toFixed(2), // Convert from USDT decimals
                    timestamp: Date.now(),
                };
            });
        }
    }, [escrowEvents]);

    return (
        <ClientEventsContext.Provider
            value={{
                latestJobApplied,
                latestJobPosted,
                latestJobHired,
                latestWorkDelivered,
                latestPayment,
            }}
        >
            {children}
        </ClientEventsContext.Provider>
    );
}

export function useClientEvents() {
    const context = useContext(ClientEventsContext);
    if (context === undefined) {
        throw new Error("useClientEvents must be used within a ClientEventsProvider");
    }
    return context;
}
