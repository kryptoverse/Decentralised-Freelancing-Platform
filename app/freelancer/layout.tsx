"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopNavbar } from "@/components/dashboard/top-navbar";
import { WalletSessionGuard } from "@/components/auth/WalletSessionGuard";

export default function FreelancerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  // Check if public profile page
  const isPublicProfile = /^\/freelancer\/0x[a-fA-F0-9]{40}$/i.test(pathname);

  const [userRole, setUserRole] = useState<
    "freelancer" | "client" | "founder" | "investor"
  >("freelancer");

  // Store current role in sessionStorage for public pages
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isPublicProfile) {
      const storedRole = sessionStorage.getItem("currentUserRole") as
        | "freelancer"
        | "client"
        | "founder"
        | "investor"
        | null;

      if (storedRole) {
        setUserRole(storedRole);
      } else {
        const referrer = document.referrer;
        if (referrer.includes("/client/")) setUserRole("client");
        else if (referrer.includes("/founder/")) setUserRole("founder");
        else if (referrer.includes("/investor/")) setUserRole("investor");
      }
    } else {
      setUserRole("freelancer");
      sessionStorage.setItem("currentUserRole", "freelancer");
    }
  }, [isPublicProfile]);

  // Detect active dashboard tab
  const [activeTab, setActiveTab] = useState("home");
  useEffect(() => {
    if (isPublicProfile) return;

    if (pathname.includes("/profile")) setActiveTab("profile");
    else if (pathname.includes("/settings")) setActiveTab("settings");
    else if (pathname.includes("/orders")) setActiveTab("orders");
    else if (pathname.includes("/find-work")) setActiveTab("find-work");
    else setActiveTab("home");
  }, [pathname, isPublicProfile]);

  const handleRoleChange = (
    role: "freelancer" | "client" | "founder" | "investor"
  ) => setUserRole(role);

  const handleLogout = () => console.log("logout clicked");

  return (
    <WalletSessionGuard>
      <div className="flex h-screen w-full overflow-hidden">

        {/* ----------- SIDEBAR (Always Mounted → Fix Mobile Burger!) ----------- */}
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
    </WalletSessionGuard>
  );
}
