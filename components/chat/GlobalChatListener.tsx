"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { initSpacetimeDB } from "@/lib/spacetimedb";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";

export function GlobalChatListener() {
    const account = useActiveAccount();
    const pathname = usePathname();
    const router = useRouter();
    
    // Use refs to avoid re-binding callbacks and messing up SpacetimeDB listeners
    const myRooms = useRef<Set<string>>(new Set());
    const processedMessages = useRef<Set<number>>(new Set());

    useEffect(() => {
        if (!account) return;

        const client = initSpacetimeDB();
        
        const onConnect = () => {
            console.log("Global Chat Listener: Connected to SpacetimeDB");
            // In a real app we'd use parameterized queries if supported, 
            // but subscribing to all messages in the mock setup to filter locally.
            client.subscribe(["SELECT * FROM ChatRoom", "SELECT * FROM Message"]);
        };

        const onRoomInsert = (row: any) => {
            if (
                row.client_address.toLowerCase() === account.address.toLowerCase() ||
                row.freelancer_address.toLowerCase() === account.address.toLowerCase()
            ) {
                myRooms.current.add(row.job_id);
            }
        };

        const onMessageInsert = (msg: any) => {
            // Prevent duplicate toasts for the same message
            if (processedMessages.current.has(msg.id)) return;
            processedMessages.current.add(msg.id);

            // Is this message in one of our rooms?
            if (myRooms.current.has(msg.job_id)) {
                // Is it from someone else?
                if (msg.sender_address.toLowerCase() !== account.address.toLowerCase()) {
                    // Are we NOT already looking at this chat?
                    const isViewingChat = window.location.pathname === `/chat/${msg.job_id}`;
                    
                    if (!isViewingChat) {
                        toast("New message received", {
                            description: msg.content.length > 50 ? msg.content.substring(0, 50) + "..." : msg.content,
                            icon: <MessageCircle className="w-4 h-4 text-primary" />,
                            action: {
                                label: "Open Chat",
                                onClick: () => router.push(`/chat/${msg.job_id}`),
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
        client.onConnect(onConnect);
        client.on("ChatRoom", "insert", onRoomInsert);
        client.on("Message", "insert", onMessageInsert);

        // Auto connect if not connected
        client.connect();

        return () => {
            // Cleanup listeners if the component unmounts
            // Not strictly disconnecting here because other components (like SpacetimeChat) might share the instance
        };
    }, [account, router]);

    return null; // This is a background listener component
}
