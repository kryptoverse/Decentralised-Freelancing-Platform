"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopNavbar } from "@/components/dashboard/top-navbar";
import { WalletSessionGuard } from "@/components/auth/WalletSessionGuard";

export default function FounderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  const [activeTab, setActiveTab] = useState("home");
  const [userRole, setUserRole] = useState<
    "freelancer" | "client" | "founder" | "investor"
  >("founder");

  // ✅ Store current role in sessionStorage for public profile pages
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("currentUserRole", "founder");
    }
  }, []);

  // ✅ Detect active tab by path
  useEffect(() => {
    if (pathname.includes("/projects")) setActiveTab("projects");
    else if (pathname.includes("/profile")) setActiveTab("profile");
    else if (pathname.includes("/settings")) setActiveTab("settings");
    else setActiveTab("home");
  }, [pathname]);

  const handleLogout = () => console.log("Founder logged out");

  // ✅ Updated handler type includes "client"
  const handleRoleChange = (
    role: "freelancer" | "client" | "founder" | "investor"
  ) => setUserRole(role);

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

        {/* Main content area */}
        <div
          className={`flex-1 flex flex-col transition-all duration-300 ${
            isCollapsed ? "ml-[5rem]" : "ml-[16rem]"
          }`}
        >
          {/* Top Navbar */}
          <TopNavbar
            userRole={userRole}
            onLogout={handleLogout}
            onRoleChange={handleRoleChange}
          />

          {/* Page Content */}
          <main className="flex-1 p-8 overflow-y-auto space-y-8">
            {children}
          </main>
        </div>
      </div>
    </WalletSessionGuard>
  );
}
