// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { ThirdwebProvider } from "thirdweb/react";
import { ChatProvider } from "@/components/chat/ChatContext";
import { GlobalChatBot } from "@/components/chat/GlobalChatBot";
import { GlobalChatListener } from "@/components/chat/GlobalChatListener";
import { GlobalAvatar } from "@/components/avatar/GlobalAvatar";
import { Toaster as SonnerToaster } from "sonner";

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
              <GlobalChatListener />
              {/* Optional, fully isolated 3D avatar. Lazy-loaded and crash-safe;
                  if it fails or is disabled, the rest of the app is unaffected. */}
              <GlobalAvatar />
            </ChatProvider>
            <SonnerToaster position="top-right" expand={true} richColors />
          </ThemeProvider>
        </ThirdwebProvider>
      </body>
    </html>
  );
}
