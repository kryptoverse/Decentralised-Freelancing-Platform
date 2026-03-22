// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { ThirdwebProvider } from "thirdweb/react";
import { ChatProvider } from "@/components/chat/ChatContext";
import { GlobalChatBot } from "@/components/chat/GlobalChatBot";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WORQS",
  description: "work it own it",
  icons: {
    icon: "/ico.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThirdwebProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <ChatProvider>
              {children}
              <GlobalChatBot />
            </ChatProvider>
          </ThemeProvider>
        </ThirdwebProvider>
      </body>
    </html>
  );
}
