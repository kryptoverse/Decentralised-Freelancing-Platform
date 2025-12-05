// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { ThirdwebProvider } from "thirdweb/react";
import { ClientEventsProvider } from "@/contexts/ClientEventsContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FYP",
  description:
    "Final Year Project",
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
          <ClientEventsProvider>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
              {children}
              <Toaster />
            </ThemeProvider>
          </ClientEventsProvider>
        </ThirdwebProvider>
      </body>
    </html>
  );
}
