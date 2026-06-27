"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useActiveAccount } from "thirdweb/react";
import { getChatMembersForRoom, getChatRoomById, getMessagesForChat, initSpacetimeDB, initiateChat, ensureChatMember, isCompanyChatId, refreshSpacetimeDB, registerUser, sendMessage, type Message } from "@/lib/spacetimedb";
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
    currentUserRole: "client" | "freelancer" | "founder" | "investor" | "admin";
    title?: string;
    ensureRoom?: boolean;
    disabled?: boolean;
    disabledMessage?: string;
    directChatId?: string;
    directChatHref?: string;
    directChatLabel?: string;
    // Address to send messages AS (and to treat as "me"). Defaults to the
    // connected account. Used for founders: the company is created from their
    // EOA (which is the room's client_address / `clientAddress`), but they
    // connect via a Smart Wallet — sending as the EOA keeps the reducer
    // authorization and the "Founder" label working for everyone.
    senderAddress?: string;
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
    senderAddress,
}: SpacetimeChatProps) {
    const account = useActiveAccount();
    // The address this user actually posts as. Founders post as their company's
    // creation address (EOA); everyone else posts as their connected account.
    const selfAddress = (senderAddress || account?.address || "").toLowerCase();
    const [messages, setMessages] = useState<Message[]>([]);
    // wallet (lowercased) -> member_role ("founder" | "investor") for this room.
    // Used to label senders reliably: a founder who created the company from their
    // EOA but chats from a smart wallet would never match `clientAddress` (the EOA
    // owner), so address-only matching would mislabel their messages as "Investor".
    const [memberRoles, setMemberRoles] = useState<Record<string, string>>({});
    const [inputMsg, setInputMsg] = useState("");
    const [connected, setConnected] = useState(false);
    const [sending, setSending] = useState(false);
    const [directChatExists, setDirectChatExists] = useState(false);

    useEffect(() => {
        if (!account) return;

        // Initialize SpacetimeDB connection
        const client = initSpacetimeDB();
        setMessages(getMessagesForChat(jobId).sort((a, b) => messageTime(a) - messageTime(b)));

        const syncMemberRoles = () => {
            const map: Record<string, string> = {};
            for (const member of getChatMembersForRoom(jobId)) {
                map[member.wallet_address.toLowerCase()] = member.member_role;
            }
            setMemberRoles(map);
        };
        syncMemberRoles();
        
        const offConnect = client.onConnect(async (token: string, identity: any) => {
            setConnected(true);
            console.log("Connected to SpacetimeDB with Identity:", identity);

            // Auto-register user with their wallet. Await it so the User row is
            // committed under this browser's stable identity before initiate_chat
            // / ensure_chat_member run their identity-based authorization checks.
            const displayName = "User " + account.address.slice(0, 4); // In memory URI simulation
            await registerUser(account.address, displayName, currentUserRole);

            // Direct chats start from the client. Project/company chats opt in so participants can open safely.
            if (currentUserRole === "client" || ensureRoom) {
                const initiatorRole = isCompanyChatId(jobId)
                    ? currentUserRole
                    : (ensureRoom ? "client" : currentUserRole);
                initiateChat(jobId, freelancerAddress, clientAddress, initiatorRole).then((ok) => {
                    if (ok && isCompanyChatId(jobId) && account?.address) {
                        ensureChatMember(
                            jobId,
                            account.address,
                            currentUserRole === "founder" ? "founder" : "investor"
                        );
                    }
                });
            }

            // Subscribe to queries
            client.subscribe([
                "SELECT * FROM Message WHERE job_id = '" + jobId + "'",
                "SELECT * FROM ChatRoom WHERE job_id = '" + jobId + "'",
                "SELECT * FROM ChatMember WHERE job_id = '" + jobId + "'"
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
            syncMemberRoles();
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
        const ok = await sendMessage(jobId, message, senderAddress || account?.address);
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
                            {isCompanyChatId(jobId)
                                ? "No messages yet. Say hello to the group!"
                                : `No messages yet. ${currentUserRole === "client" ? "Start the conversation!" : "Waiting for client to initiate."}`}
                        </div>
                    ) : (
                        messages.map(msg => {
                            const sender = msg.sender_address.toLowerCase();
                            const isMe = sender === selfAddress;
                            const isClient = sender === clientAddress.toLowerCase();
                            const isFreelancer = sender === freelancerAddress.toLowerCase();

                            const isCompanyRoom = isCompanyChatId(jobId);
                            let senderLabel = isCompanyRoom ? "Member" : "Admin";
                            if (isCompanyRoom) {
                                // Prefer the on-record membership role (works no matter which
                                // address the founder chats from); fall back to matching the
                                // company owner (`clientAddress`) for legacy rows with no member.
                                const memberRole = memberRoles[sender];
                                senderLabel = (memberRole === "founder" || isClient) ? "Founder" : "Investor";
                            } else {
                                if (isClient) senderLabel = "Client";
                                if (isFreelancer) senderLabel = "Freelancer";
                            }

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
