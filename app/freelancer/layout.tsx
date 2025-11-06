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
  
  // ✅ Check if this is a public profile route (/freelancer/[address])
  const isPublicProfile = /^\/freelancer\/0x[a-fA-F0-9]{40}$/i.test(pathname);
  
  const [userRole, setUserRole] = useState<
    "freelancer" | "client" | "founder" | "investor"
  >("freelancer");

  // ✅ Store current role in sessionStorage for public profile pages
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // If viewing a public profile, preserve the user's actual role from sessionStorage
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
        // Fallback: detect from referrer
        const referrer = document.referrer;
        if (referrer.includes("/client/")) {
          setUserRole("client");
        } else if (referrer.includes("/founder/")) {
          setUserRole("founder");
        } else if (referrer.includes("/investor/")) {
          setUserRole("investor");
        }
        // Default stays "freelancer" if can't determine
      }
    } else {
      // Normal freelancer route - set and store freelancer role
      setUserRole("freelancer");
      sessionStorage.setItem("currentUserRole", "freelancer");
    }
  }, [isPublicProfile]);

  // automatically detect current tab (skip for public profiles)
  const [activeTab, setActiveTab] = useState("home");
  useEffect(() => {
    // Don't set active tab for public profile routes
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

          {/* Page Content */}
          <main className="flex-1 p-8 overflow-y-auto space-y-8">
            {children}
          </main>
        </div>
      </div>
    </WalletSessionGuard>
  );
}
