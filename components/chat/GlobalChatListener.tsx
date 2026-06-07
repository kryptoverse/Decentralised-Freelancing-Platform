"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getContract, readContract } from "thirdweb";
import { useActiveAccount, useActiveWallet } from "thirdweb/react";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { client as thirdwebClient } from "@/lib/thirdweb-client";
import { getAllChatsForUser, getCachedMessages, getCompanyChatId, getCompanyIdFromChatId, getJobIdFromProjectChatId, initSpacetimeDB, isCompanyChatId, isProjectChatId, refreshSpacetimeDB, type ChatRoom } from "@/lib/spacetimedb";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";

export function GlobalChatListener() {
    const account = useActiveAccount();
    const activeWallet = useActiveWallet();
    const router = useRouter();
    
    // Use refs to avoid re-binding callbacks and messing up SpacetimeDB listeners
    const myRooms = useRef<Map<string, ChatRoom>>(new Map());
    const processedMessages = useRef<Set<number>>(new Set());
    const readyForNotifications = useRef(false);
    const companyChatIds = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!account) return;

        const client = initSpacetimeDB();

        const refreshCompanyChatIds = async () => {
            const nextIds = new Set<string>();
            const ownerAddresses = [account.address];
            try {
                const personal = (activeWallet as any)?.getAdminAccount?.();
                if (personal?.address && personal.address.toLowerCase() !== account.address.toLowerCase()) {
                    ownerAddresses.push(personal.address);
                }
            } catch {}

            try {
                const companyRegistry = getContract({
                    client: thirdwebClient,
                    chain: CHAIN,
                    address: DEPLOYED_CONTRACTS.addresses.CompanyRegistry as `0x${string}`,
                });
                for (const ownerAddress of ownerAddresses) {
                    const founderCompanyId = await readContract({
                        contract: companyRegistry,
                        method: "function ownerToCompanyId(address) view returns (uint256)",
                        params: [ownerAddress],
                    }).catch(() => 0n) as bigint;
                    if (founderCompanyId > 0n) nextIds.add(getCompanyChatId(founderCompanyId));
                }
            } catch {}

            try {
                const investorRegistry = getContract({
                    client: thirdwebClient,
                    chain: CHAIN,
                    address: DEPLOYED_CONTRACTS.addresses.InvestorRegistry as `0x${string}`,
                });
                for (const ownerAddress of ownerAddresses) {
                    const companyIds = await readContract({
                        contract: investorRegistry,
                        method: "function getPortfolio(address) view returns (uint256[])",
                        params: [ownerAddress],
                    }).catch(() => []) as bigint[];
                    companyIds.forEach((companyId) => nextIds.add(getCompanyChatId(companyId)));
                }
            } catch {}

            companyChatIds.current = nextIds;
        };

        const refreshMyRooms = async () => {
            await refreshCompanyChatIds();
            getAllChatsForUser(account.address, {
                includeProjectChats: true,
                includeCompanyChatIds: Array.from(companyChatIds.current),
            }).forEach(room => {
                myRooms.current.set(room.job_id, room);
            });
        };

        const markExistingMessagesSeen = async () => {
            await refreshMyRooms();
            getCachedMessages().forEach(message => {
                if (myRooms.current.has(message.job_id)) {
                    processedMessages.current.add(message.id);
                }
            });
            readyForNotifications.current = true;
        };
        
        const onConnect = () => {
            console.log("Global Chat Listener: Connected to SpacetimeDB");
            // In a real app we'd use parameterized queries if supported, 
            // but subscribing to all messages in the mock setup to filter locally.
            client.subscribe(["SELECT * FROM ChatRoom", "SELECT * FROM Message"]);
            refreshSpacetimeDB().then(markExistingMessagesSeen);
        };

        const onRoomInsert = async (row: any) => {
            await refreshCompanyChatIds();
            if (
                row.client_address.toLowerCase() === account.address.toLowerCase() ||
                row.freelancer_address.toLowerCase() === account.address.toLowerCase() ||
                companyChatIds.current.has(row.job_id)
            ) {
                myRooms.current.set(row.job_id, row);
            }
        };

        const onMessageInsert = async (msg: any) => {
            await refreshMyRooms();
            const room = myRooms.current.get(msg.job_id);

            // Is this message in one of our rooms?
            if (room) {
                // Prevent duplicate toasts for the same message
                if (processedMessages.current.has(msg.id)) return;
                processedMessages.current.add(msg.id);

                if (!readyForNotifications.current) return;

                // Is it from someone else?
                if (msg.sender_address.toLowerCase() !== account.address.toLowerCase()) {
                    // Are we NOT already looking at this chat?
                    const activeChatId = new URLSearchParams(window.location.search).get("chatId");
                    const projectJobId = isProjectChatId(msg.job_id) ? getJobIdFromProjectChatId(msg.job_id) : null;
                    const companyId = isCompanyChatId(msg.job_id) ? getCompanyIdFromChatId(msg.job_id) : null;
                    const isViewingProjectChat = projectJobId
                        ? window.location.pathname === `/client/jobs/${projectJobId}` || window.location.pathname === `/freelancer/jobs/${projectJobId}`
                        : false;
                    const isViewingCompanyChat = companyId
                        ? (window.location.pathname === "/founder/chat" || window.location.pathname === "/investor/chat") && (!activeChatId || activeChatId === msg.job_id)
                        : false;
                    const isViewingChat = window.location.pathname === `/chat/${msg.job_id}` || activeChatId === msg.job_id || isViewingProjectChat || isViewingCompanyChat;
                    
                    if (!isViewingChat) {
                        const isClientViewer = room.client_address.toLowerCase() === account.address.toLowerCase();
                        const chatPath = projectJobId
                            ? (isClientViewer ? `/client/jobs/${projectJobId}` : `/freelancer/jobs/${projectJobId}`)
                            : companyId
                                ? (isClientViewer ? `/founder/chat?chatId=${msg.job_id}` : `/investor/chat?chatId=${msg.job_id}`)
                            : (isClientViewer ? `/client/chat?chatId=${msg.job_id}` : `/freelancer/chat?chatId=${msg.job_id}`);

                        toast(companyId ? "New company chat message" : projectJobId ? "New project message received" : "New message received", {
                            description: msg.content.length > 50 ? msg.content.substring(0, 50) + "..." : msg.content,
                            icon: <MessageCircle className="w-4 h-4 text-primary" />,
                            action: {
                                label: "Open Chat",
                                onClick: () => router.push(chatPath),
                            },
                            duration: 5000,
                            position: "top-right",
                            className: "border-primary/20 bg-surface shadow-xl"
                        });
                    }
                }
            }
        };

        // Attach listeners
        const offConnect = client.onConnect(onConnect);
        const offRoomInsert = client.on("ChatRoom", "insert", onRoomInsert);
        const offMessageInsert = client.on("Message", "insert", onMessageInsert);
        const handleSpacetimeUpdate = () => {
            void refreshMyRooms();
        };
        window.addEventListener("spacetime_update", handleSpacetimeUpdate);

        // Auto connect if not connected
        client.connect();

        return () => {
            window.removeEventListener("spacetime_update", handleSpacetimeUpdate);
            offConnect();
            offRoomInsert();
            offMessageInsert();
            // Cleanup listeners if the component unmounts
            // Not strictly disconnecting here because other components (like SpacetimeChat) might share the instance
        };
    }, [account, activeWallet, router]);

    return null; // This is a background listener component
}
