"use client";

import { useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { getMessagesForChat, initSpacetimeDB, initiateChat, refreshSpacetimeDB, registerUser, sendMessage, type Message } from "@/lib/spacetimedb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send } from "lucide-react";

interface SpacetimeChatProps {
    jobId: string;
    clientAddress: string;
    freelancerAddress: string;
    currentUserRole: "client" | "freelancer" | "admin";
}

export function SpacetimeChat({ jobId, clientAddress, freelancerAddress, currentUserRole }: SpacetimeChatProps) {
    const account = useActiveAccount();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMsg, setInputMsg] = useState("");
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        if (!account) return;

        // Initialize SpacetimeDB connection
        const client = initSpacetimeDB();
        setMessages(getMessagesForChat(jobId).sort((a, b) => a.timestamp - b.timestamp));
        
        client.onConnect((token: string, identity: any) => {
            setConnected(true);
            console.log("Connected to SpacetimeDB with Identity:", identity);
            
            // Auto-register user with their wallet
            const displayName = "User " + account.address.slice(0, 4); // In memory URI simulation
            registerUser(account.address, displayName, currentUserRole);
            
            // If client, ensure chat room is initiated
            if (currentUserRole === "client") {
                initiateChat(jobId, freelancerAddress, clientAddress, currentUserRole);
            }

            // Subscribe to queries
            client.subscribe([
                "SELECT * FROM Message WHERE job_id = '" + jobId + "'",
                "SELECT * FROM ChatRoom WHERE job_id = '" + jobId + "'"
            ]);
            refreshSpacetimeDB();
        });

        // Listen for new messages
        client.on("Message", "insert", (row: any) => {
            if (row.job_id === jobId) {
                setMessages(prev => {
                    // Prevent duplicates
                    if (prev.find(m => m.id === row.id)) return prev;
                    return [...prev, row].sort((a, b) => a.timestamp - b.timestamp);
                });
            }
        });

        const handleUpdate = () => {
            setMessages(getMessagesForChat(jobId).sort((a, b) => a.timestamp - b.timestamp));
        };
        window.addEventListener("spacetime_update", handleUpdate);

        client.connect();

        return () => {
            window.removeEventListener("spacetime_update", handleUpdate);
            client.disconnect();
        };
    }, [account, jobId, clientAddress, freelancerAddress, currentUserRole]);

    const handleSend = () => {
        if (!inputMsg.trim() || !connected) return;
        
        sendMessage(jobId, inputMsg.trim(), account?.address);
        setInputMsg("");
    };

    if (!account) {
        return <div className="p-4 border rounded-md text-center">Please connect your wallet to chat.</div>;
    }

    return (
        <div className="flex flex-col h-full border rounded-lg overflow-hidden bg-background">
            <div className="p-3 bg-muted/50 border-b flex justify-between items-center">
                <span className="font-semibold text-sm">Real-time Chat (SpacetimeDB)</span>
                {!connected && <span className="flex items-center text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin mr-1"/> Connecting...</span>}
                {connected && <span className="text-xs text-green-500 flex items-center">● Connected</span>}
            </div>
            
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
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

            <div className="p-3 border-t bg-muted/20 flex gap-2">
                <Input 
                    value={inputMsg}
                    onChange={(e) => setInputMsg(e.target.value)}
                    placeholder="Type your message..."
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    disabled={!connected}
                />
                <Button size="icon" onClick={handleSend} disabled={!connected || !inputMsg.trim()}>
                    <Send className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}
