"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AIAssistantChat } from "@/components/dashboard/ai-assistant-chat";

export function GlobalChatBot() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    if (pathname === "/client/chat" || pathname === "/freelancer/chat" || pathname.startsWith("/chat/")) {
        return null;
    }

    return <AIAssistantChat isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)} />;
}
