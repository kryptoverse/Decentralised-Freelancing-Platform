import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import Providers from "@/components/Providers"
import "./globals.css"
import { Suspense } from "react"
import ChatWidget from "@/components/ChatWidget"

export const metadata: Metadata = {
  title: "FreelanceChain - Decentralized Freelancing & Shares",
  description: "Connect with freelancers and invest in companies using blockchain technology",
  
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <Suspense fallback={<div>Loading...</div>}>
          <Providers>
            {children}
            {/* Floating AI chat */}
            <ChatWidget />
          </Providers>
        </Suspense>
        <Analytics />
      </body>
    </html>
  )
}
