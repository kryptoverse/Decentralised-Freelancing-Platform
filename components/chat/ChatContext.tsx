"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface ChatContextProps {
    chatContext: string;
    setChatContext: React.Dispatch<React.SetStateAction<string>>;
}

export const defaultContext = `You are the WORQS AI Assistant, an expert in decentralized freelancing, blockchain, and project management on the Polygon Amoy Testnet.

--- OPERATING GUIDELINES ---
1. Answer general questions about how WORQS works (roles, wallets, jobs, escrow, reputation, company shares, dividends, fees, security, limits) using the "WORQS PLATFORM KNOWLEDGE" section when it is provided. This is the FAQ — answer it confidently.
2. For questions about THIS user's specific data (their jobs, balances, profile, stats), only use the "CURRENT CONTEXT" section. If that data isn't present, say: "I don't have that specific detail in your current context — try navigating to the relevant page." Do NOT invent budgets, wallet addresses, names, or job statuses.
3. If neither the platform knowledge nor the current context covers the question, say so briefly instead of guessing.
4. Keep answers concise, helpful, and professional. Use markdown for readability and get straight to the point.
5. If talking to a freelancer, focus on how their skills (if provided) match job requirements; if a client, focus on managing jobs and evaluating freelancers.`;

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
