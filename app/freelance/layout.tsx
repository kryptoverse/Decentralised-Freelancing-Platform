import type React from "react"
import type { Metadata } from "next"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import AppSidebar from "@/components/AppSidebar"
import Header from "@/components/Header"
import WalletGuard from "@/components/WalletGuard"

export const metadata: Metadata = {
  title: "Developer Dashboard - FreelanceChain",
  description: "Deploy profiles and companies on-chain, manage wallet",
}

export default function DevLayout({ children }: { children: React.ReactNode }) {
  return (
    <WalletGuard>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <Header />
          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </WalletGuard>
  )
}
