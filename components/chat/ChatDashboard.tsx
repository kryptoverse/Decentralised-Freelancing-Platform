"use client";

import { useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAllChatsForUser, getCachedMessages, initSpacetimeDB, refreshSpacetimeDB, ChatRoom, Message } from "@/lib/spacetimedb";
import { SpacetimeChat } from "@/components/chat/SpacetimeChat";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ChatDashboardProps {
    currentUserRole: "client" | "freelancer";
}

export function ChatDashboard({ currentUserRole }: ChatDashboardProps) {
    const account = useActiveAccount();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [chats, setChats] = useState<ChatRoom[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [lastMessages, setLastMessages] = useState<Record<string, Message>>({});

    useEffect(() => {
        if (!account) return;
        const client = initSpacetimeDB();
        client.connect();
        
        const loadData = () => {
            // Load all chats for this user from our mock localStorage database
            const userChats = getAllChatsForUser(account.address);
            setChats(userChats);

            // Fetch all messages efficiently
            const allMessages = getCachedMessages();
            const messagesMap: Record<string, Message> = {};
            
            // Assume messages are ordered sequentially in localStorage
            allMessages.forEach(msg => {
                messagesMap[msg.job_id] = msg; // Overwrites so last one is kept
            });
            
            setLastMessages(messagesMap);

            // Check if there is a specific chat requested in the URL initially
            if (!selectedChatId) {
                const chatIdParam = searchParams.get("chatId");
                if (chatIdParam) {
                    setSelectedChatId(chatIdParam);
                } else if (userChats.length > 0) {
                    if (typeof window !== "undefined" && window.innerWidth >= 768) {
                        setSelectedChatId(userChats[0].job_id);
                    }
                }
            }
        };

        loadData();
        refreshSpacetimeDB().then(loadData);

        // Listen for updates from other components or tabs
        const handleUpdate = () => loadData();
        window.addEventListener("spacetime_update", handleUpdate);
        window.addEventListener("storage", handleUpdate);

        return () => {
            window.removeEventListener("spacetime_update", handleUpdate);
            window.removeEventListener("storage", handleUpdate);
        };
    }, [account, searchParams, selectedChatId]);

    const filteredChats = chats.filter(chat => {
        const otherParty = currentUserRole === "client" ? chat.freelancer_address : chat.client_address;
        return otherParty.toLowerCase().includes(searchQuery.toLowerCase()) || chat.job_id.toLowerCase().includes(searchQuery.toLowerCase());
    });

    if (!account) {
        return <div className="p-8 text-center">Please connect your wallet to view messages.</div>;
    }

    const selectedChat = chats.find(c => c.job_id === selectedChatId);

    return (
        <div className="flex h-[calc(100dvh-7rem)] min-h-[520px] mb-4 bg-surface border border-border rounded-xl overflow-hidden shadow-lg mx-auto w-full max-w-7xl">
            
            {/* LEFT SIDEBAR - CHAT LIST */}
            <div className={`w-full md:w-80 border-r border-border bg-surface-secondary flex-col ${selectedChatId ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-border">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-primary" /> 
                        Messages
                    </h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search chats..." 
                            className="pl-9 bg-background"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <ScrollArea className="flex-1">
                    {filteredChats.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                            No conversations found.
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {filteredChats.map(chat => {
                                const isSelected = selectedChatId === chat.job_id;
                                const otherParty = currentUserRole === "client" ? chat.freelancer_address : chat.client_address;
                                const lastMessage = lastMessages[chat.job_id];

                                return (
                                    <button
                                        key={chat.job_id}
                                        onClick={() => {
                                            setSelectedChatId(chat.job_id);
                                            // Optionally update URL so it can be shared
                                            router.push(`/${currentUserRole}/chat?chatId=${chat.job_id}`);
                                        }}
                                        className={`w-full text-left p-4 border-b border-border/50 hover:bg-muted/50 transition-colors flex gap-3 items-center ${isSelected ? 'bg-muted/80 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                                            <User className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <h3 className="font-semibold text-sm truncate">
                                                    {otherParty.slice(0, 6)}...{otherParty.slice(-4)}
                                                </h3>
                                                {lastMessage && (
                                                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                                        {new Date(lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {lastMessage ? lastMessage.content : "No messages yet"}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
            </div>

            {/* RIGHT PANE - ACTIVE CHAT */}
            <div className={`min-w-0 flex-1 flex-col bg-background ${!selectedChatId ? 'hidden md:flex' : 'flex'}`}>
                {selectedChatId && selectedChat ? (
                    <div className="flex-1 min-h-0 flex flex-col h-full relative">
                        {/* Mobile back button header */}
                        <div className="md:hidden p-3 border-b border-border flex items-center bg-surface-secondary">
                            <button 
                                onClick={() => {
                                    setSelectedChatId(null);
                                    router.push(`/${currentUserRole}/chat`);
                                }}
                                className="mr-3 text-muted-foreground hover:text-foreground"
                            >
                                ← Back
                            </button>
                            <span className="font-semibold text-sm truncate">
                                Chatting with {(currentUserRole === "client" ? selectedChat.freelancer_address : selectedChat.client_address).slice(0, 6)}...
                            </span>
                        </div>
                        
                        {/* We use a key to force remounting SpacetimeChat if we switch rooms */}
                        <div className="flex-1 min-h-0 overflow-hidden" key={selectedChatId}>
                            <SpacetimeChat 
                                jobId={selectedChat.job_id}
                                clientAddress={selectedChat.client_address}
                                freelancerAddress={selectedChat.freelancer_address}
                                currentUserRole={currentUserRole}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center h-full">
                        <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
                        <h2 className="text-xl font-semibold mb-2">Your Messages</h2>
                        <p className="text-sm max-w-sm">
                            Select a conversation from the sidebar or start a new direct message from a freelancer's profile.
                        </p>
                    </div>
                )}
            </div>

        </div>
    );
}
