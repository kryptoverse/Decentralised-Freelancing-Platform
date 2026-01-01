"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sidebar } from "./sidebar";
import { TopNavbar } from "./top-navbar";
import { HomeTab } from "./tabs/home-tab"; // Your universal "choose role" screen
import { AIAssistantChat } from "./ai-assistant-chat";

interface DashboardProps {
  userRole: "freelancer" | "client" | "founder" | "investor" | null;
  onLogout: () => void;
  onRoleChange: (role: "freelancer" | "client" | "founder" | "investor") => void;
}

export function Dashboard({ userRole, onLogout, onRoleChange }: DashboardProps) {
  // activeTab is still useful for internal state (AI, etc.), but not for highlighting now
  const [activeTab, setActiveTab] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);

  // On mobile (below md), the sidebar overlays, so content should not have a left margin.
  // On desktop, we add a left margin equal to the sidebar width (collapsed vs expanded).
  const sidebarWidthClass = sidebarCollapsed ? "md:ml-20" : "md:ml-64";

  // Universal "role picker" experience before they're inside a role app
  // You can later remove this once you always redirect into /freelancer or /client
  const renderContent = () => {
    return (
      <HomeTab
        userRole={userRole ?? undefined}
        onRoleChange={onRoleChange}
      />
    );
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        isCollapsed={sidebarCollapsed}
        onCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        userRole={userRole}
      />

      {/* Main area */}
      <div
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ml-0 ${sidebarWidthClass}`}
      >
        <TopNavbar
          userRole={userRole}
          onLogout={onLogout}
          onRoleChange={onRoleChange}
        />

        <motion.main
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex-1 overflow-y-auto p-6 md:p-8"
        >
          {renderContent()}
        </motion.main>
      </div>

      {/* Floating AI assistant */}
      <AIAssistantChat
        isOpen={aiChatOpen}
        onToggle={() => setAiChatOpen(!aiChatOpen)}
      />
    </div>
  );
}
