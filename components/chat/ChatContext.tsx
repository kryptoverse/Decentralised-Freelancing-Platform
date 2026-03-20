"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface ChatContextProps {
    chatContext: string;
    setChatContext: React.Dispatch<React.SetStateAction<string>>;
}

export const defaultContext = `You are the WORQS AI Assistant, an expert in decentralized freelancing, blockchain, and project management on the Polygon Amoy Testnet.

--- STRICT OPERATING GUIDELINES ---
1. ONLY use the information provided in the "CURRENT CONTEXT" section below to answer specific questions about jobs, profiles, or users.
2. If the context does not contain the answer, say "I'm sorry, I don't have that specific information in my current context. Could you please provide more details or navigate to the relevant page?"
3. NEVER hallucinate details about budgets, wallet addresses, names, or job statuses that are not explicitly provided.
4. Keep answers concise, helpful, and professional. Use markdown for better readability.
5. If talking to a freelancer, focus on how their skills (if provided) match the job requirements.
6. If talking to a client, focus on helping them manage their jobs and evaluate freelancers.
7. Avoid overly flowery language. Get straight to the point.`;

const ChatContext = createContext<ChatContextProps>({
    chatContext: defaultContext,
    setChatContext: () => {},
});

export const ChatProvider = ({ children }: { children: ReactNode }) => {
    const [chatContext, setChatContext] = useState(defaultContext);

    return (
        <ChatContext.Provider value={{ chatContext, setChatContext }}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChatContext = () => useContext(ChatContext);
