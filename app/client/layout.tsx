"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopNavbar } from "@/components/dashboard/top-navbar";
import { WalletSessionGuard } from "@/components/auth/WalletSessionGuard";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [userRole, setUserRole] = useState<
    "freelancer" | "client" | "founder" | "investor"
  >("client");

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
      <div className="flex h-screen">
        {/* Sidebar */}
        <Sidebar
          userRole={userRole}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isOpen={isOpen}
          onToggle={() => setIsOpen(!isOpen)}
          isCollapsed={isCollapsed}
          onCollapse={() => setIsCollapsed(!isCollapsed)}
        />

        {/* Main Content */}
        <div
          className={`flex-1 flex flex-col transition-all duration-300 ${
            isCollapsed ? "ml-[5rem]" : "ml-[16rem]"
          }`}
        >
          <TopNavbar
            userRole={userRole}
            onLogout={handleLogout}
            onRoleChange={handleRoleChange}
          />

          <main className="flex-1 p-8 overflow-y-auto space-y-8">
            {children}
          </main>
        </div>
      </div>
    </WalletSessionGuard>
  );
}
