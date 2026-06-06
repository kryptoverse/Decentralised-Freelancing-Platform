"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useActiveAccount } from "thirdweb/react";
import { getChatRoomById, getMessagesForChat, initSpacetimeDB, initiateChat, refreshSpacetimeDB, registerUser, sendMessage, type Message } from "@/lib/spacetimedb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquare, Send } from "lucide-react";

const messageTime = (message: Message) => {
    return typeof message.timestamp === "number"
        ? message.timestamp
        : new Date(message.timestamp).getTime();
};

interface SpacetimeChatProps {
    jobId: string;
    clientAddress: string;
    freelancerAddress: string;
    currentUserRole: "client" | "freelancer" | "admin";
    title?: string;
    ensureRoom?: boolean;
    disabled?: boolean;
    disabledMessage?: string;
    directChatId?: string;
    directChatHref?: string;
    directChatLabel?: string;
}

export function SpacetimeChat({
    jobId,
    clientAddress,
    freelancerAddress,
    currentUserRole,
    title = "Real-time Chat (SpacetimeDB)",
    ensureRoom = false,
    disabled = false,
    disabledMessage = "This chat is closed.",
    directChatId,
    directChatHref,
    directChatLabel = "Open main chat",
}: SpacetimeChatProps) {
    const account = useActiveAccount();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMsg, setInputMsg] = useState("");
    const [connected, setConnected] = useState(false);
    const [sending, setSending] = useState(false);
    const [directChatExists, setDirectChatExists] = useState(false);

    useEffect(() => {
        if (!account) return;

        // Initialize SpacetimeDB connection
        const client = initSpacetimeDB();
        setMessages(getMessagesForChat(jobId).sort((a, b) => messageTime(a) - messageTime(b)));
        
        const offConnect = client.onConnect((token: string, identity: any) => {
            setConnected(true);
            console.log("Connected to SpacetimeDB with Identity:", identity);
            
            // Auto-register user with their wallet
            const displayName = "User " + account.address.slice(0, 4); // In memory URI simulation
            registerUser(account.address, displayName, currentUserRole);
            
            // Direct chats start from the client. Project chats opt in so both parties can open the job page safely.
            if (currentUserRole === "client" || ensureRoom) {
                initiateChat(jobId, freelancerAddress, clientAddress, ensureRoom ? "client" : currentUserRole);
            }

            // Subscribe to queries
            client.subscribe([
                "SELECT * FROM Message WHERE job_id = '" + jobId + "'",
                "SELECT * FROM ChatRoom WHERE job_id = '" + jobId + "'"
            ]);
            refreshSpacetimeDB();
        });

        // Listen for new messages
        const offMessageInsert = client.on("Message", "insert", (row: any) => {
            if (row.job_id === jobId) {
                setMessages(prev => {
                    // Prevent duplicates
                    if (prev.find(m => m.id === row.id)) return prev;
                    return [...prev, row].sort((a, b) => messageTime(a) - messageTime(b));
                });
            }
        });

        const handleUpdate = () => {
            setMessages(getMessagesForChat(jobId).sort((a, b) => messageTime(a) - messageTime(b)));
            setDirectChatExists(Boolean(directChatId && getChatRoomById(directChatId)));
        };
        window.addEventListener("spacetime_update", handleUpdate);

        client.connect();
        setDirectChatExists(Boolean(directChatId && getChatRoomById(directChatId)));

        return () => {
            window.removeEventListener("spacetime_update", handleUpdate);
            offConnect();
            offMessageInsert();
            client.disconnect();
        };
    }, [account, jobId, clientAddress, freelancerAddress, currentUserRole, ensureRoom, directChatId]);

    const handleSend = async () => {
        if (!inputMsg.trim() || !connected || sending || disabled) return;

        const message = inputMsg.trim();
        setSending(true);
        setInputMsg("");
        const ok = await sendMessage(jobId, message, account?.address);
        if (!ok) setInputMsg(message);
        setSending(false);
    };

    if (!account) {
        return <div className="p-4 border rounded-md text-center">Please connect your wallet to chat.</div>;
    }

    return (
        <div className="flex flex-col h-full min-h-0 border rounded-lg overflow-hidden bg-background">
            <div className="shrink-0 p-3 bg-muted/50 border-b flex justify-between items-center">
                <span className="font-semibold text-sm">{title}</span>
                {!connected && <span className="flex items-center text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin mr-1"/> Connecting...</span>}
                {connected && <span className="text-xs text-green-500 flex items-center">● Connected</span>}
            </div>
            
            <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-4 p-4 pb-6">
                    {messages.length === 0 ? (
                        <div className="text-center text-muted-foreground text-sm mt-10">
                            No messages yet. {currentUserRole === "client" ? "Start the conversation!" : "Waiting for client to initiate."}
                        </div>
                    ) : (
                        messages.map(msg => {
                            const isMe = msg.sender_address.toLowerCase() === account.address.toLowerCase();
                            const isClient = msg.sender_address.toLowerCase() === clientAddress.toLowerCase();
                            const isFreelancer = msg.sender_address.toLowerCase() === freelancerAddress.toLowerCase();
                            
                            let senderLabel = "Admin";
                            if (isClient) senderLabel = "Client";
                            if (isFreelancer) senderLabel = "Freelancer";

                            return (
                                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                    <span className="text-[10px] text-muted-foreground mb-1 px-1">
                                        {senderLabel} ({msg.sender_address.slice(0,6)})
                                    </span>
                                    <div className={`px-3 py-2 rounded-lg max-w-[80%] text-sm ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                        {msg.content}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </ScrollArea>

            {disabled ? (
                <div className="shrink-0 p-3 md:p-4 border-t bg-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-sm text-muted-foreground">{disabledMessage}</p>
                    {directChatExists && directChatHref && (
                        <Button asChild variant="outline" className="shrink-0">
                            <Link href={directChatHref}>
                                <MessageSquare className="w-4 h-4 mr-2" />
                                {directChatLabel}
                            </Link>
                        </Button>
                    )}
                </div>
            ) : (
                <div className="shrink-0 p-3 md:p-4 border-t bg-muted/20 flex gap-2">
                    <Input
                        value={inputMsg}
                        onChange={(e) => setInputMsg(e.target.value)}
                        placeholder="Type your message..."
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        disabled={!connected || sending}
                        className="min-h-11"
                    />
                    <Button size="icon" className="h-11 w-11 shrink-0" onClick={handleSend} disabled={!connected || sending || !inputMsg.trim()}>
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}
