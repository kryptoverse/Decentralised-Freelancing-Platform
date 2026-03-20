"use client";

import { useState } from "react";
import { AIAssistantChat } from "@/components/dashboard/ai-assistant-chat";

export function GlobalChatBot() {
    const [isOpen, setIsOpen] = useState(false);
    return <AIAssistantChat isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)} />;
}
