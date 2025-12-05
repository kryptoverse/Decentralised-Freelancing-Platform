"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopNavbar } from "@/components/dashboard/top-navbar";
import { WalletSessionGuard } from "@/components/auth/WalletSessionGuard";
import { ClientGlobalNotifications } from "@/components/client/ClientGlobalNotifications";
import { ClientEventsProvider } from "@/contexts/ClientEventsContext";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  const [userRole, setUserRole] = useState<
    "freelancer" | "client" | "founder" | "investor"
  >("client");

  // Store client role globally for sidebar/navbar
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("currentUserRole", "client");
    }
  }, []);

  // Detect active tab
  const [activeTab, setActiveTab] = useState("home");

  useEffect(() => {
    if (pathname.includes("/find-freelancer")) setActiveTab("find-freelancer");
    else if (pathname.includes("/orders")) setActiveTab("orders");
    else if (pathname.includes("/settings")) setActiveTab("settings");
    else setActiveTab("home");
  }, [pathname]);

  const handleRoleChange = (
    role: "freelancer" | "client" | "founder" | "investor"
  ) => setUserRole(role);

  const handleLogout = () => console.log("Client logout clicked");

  return (
    <WalletSessionGuard>
      <ClientEventsProvider>
        <ClientGlobalNotifications />
        {/* Prevent ANY horizontal overflow */}
        <div className="flex h-screen w-full overflow-hidden">

          {/* ----------- SIDEBAR (ALWAYS MOUNTED, FIXES MOBILE BURGER) ----------- */}
          <Sidebar
            userRole={userRole}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isOpen={isOpen}
            onToggle={() => setIsOpen(!isOpen)}
            isCollapsed={isCollapsed}
            onCollapse={() => setIsCollapsed(!isCollapsed)}
          />

          {/* ----------- MAIN CONTENT ----------- */}
          <div
            className={`
            flex-1 flex flex-col 
            w-full h-full
            transition-all duration-300
            overflow-hidden
            ${isCollapsed ? "sm:ml-[5rem]" : "sm:ml-[16rem]"}
          `}
          >
            {/* Top Navbar */}
            <TopNavbar
              userRole={userRole}
              onLogout={handleLogout}
              onRoleChange={handleRoleChange}
            />

            {/* Page Content */}
            <main
              className="
              flex-1 
              p-4 md:p-6 lg:p-8
              overflow-y-auto 
              w-full max-w-full
              overflow-x-hidden
              space-y-8
            "
            >
              {children}
            </main>
          </div>
        </div>
      </ClientEventsProvider>
    </WalletSessionGuard>
  );
}
