"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { getAllChatsForUser, getCachedMessages, getJobIdFromProjectChatId, initSpacetimeDB, isProjectChatId, refreshSpacetimeDB, type ChatRoom } from "@/lib/spacetimedb";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";

export function GlobalChatListener() {
    const account = useActiveAccount();
    const router = useRouter();
    
    // Use refs to avoid re-binding callbacks and messing up SpacetimeDB listeners
    const myRooms = useRef<Map<string, ChatRoom>>(new Map());
    const processedMessages = useRef<Set<number>>(new Set());
    const readyForNotifications = useRef(false);

    useEffect(() => {
        if (!account) return;

        const client = initSpacetimeDB();

        const refreshMyRooms = () => {
            getAllChatsForUser(account.address, { includeProjectChats: true }).forEach(room => {
                myRooms.current.set(room.job_id, room);
            });
        };

        const markExistingMessagesSeen = () => {
            refreshMyRooms();
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

        const onRoomInsert = (row: any) => {
            if (
                row.client_address.toLowerCase() === account.address.toLowerCase() ||
                row.freelancer_address.toLowerCase() === account.address.toLowerCase()
            ) {
                myRooms.current.set(row.job_id, row);
            }
        };

        const onMessageInsert = (msg: any) => {
            refreshMyRooms();
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
                    const isViewingProjectChat = projectJobId
                        ? window.location.pathname === `/client/jobs/${projectJobId}` || window.location.pathname === `/freelancer/jobs/${projectJobId}`
                        : false;
                    const isViewingChat = window.location.pathname === `/chat/${msg.job_id}` || activeChatId === msg.job_id || isViewingProjectChat;
                    
                    if (!isViewingChat) {
                        const isClientViewer = room.client_address.toLowerCase() === account.address.toLowerCase();
                        const chatPath = projectJobId
                            ? (isClientViewer ? `/client/jobs/${projectJobId}` : `/freelancer/jobs/${projectJobId}`)
                            : (isClientViewer ? `/client/chat?chatId=${msg.job_id}` : `/freelancer/chat?chatId=${msg.job_id}`);

                        toast(projectJobId ? "New project message received" : "New message received", {
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
        window.addEventListener("spacetime_update", refreshMyRooms);

        // Auto connect if not connected
        client.connect();

        return () => {
            window.removeEventListener("spacetime_update", refreshMyRooms);
            offConnect();
            offRoomInsert();
            offMessageInsert();
            // Cleanup listeners if the component unmounts
            // Not strictly disconnecting here because other components (like SpacetimeChat) might share the instance
        };
    }, [account, router]);

    return null; // This is a background listener component
}
