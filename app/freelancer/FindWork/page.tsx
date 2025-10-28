"use client";

import { motion } from "framer-motion";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopNavbar } from "@/components/dashboard/top-navbar";
import { AIAssistantChat } from "@/components/dashboard/ai-assistant-chat";
import { useState } from "react";

/**
 * ✅ Minimal FindWork Page
 * Uses Sidebar + TopNavbar layout
 */
export default function FindWorkPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {/* ✅ Sidebar */}
      <Sidebar
        activeTab="find-work"
        onTabChange={() => {}}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        isCollapsed={sidebarCollapsed}
        onCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        userRole="freelancer"
      />

      {/* ✅ Main content */}
      <div
        className="flex-1 flex flex-col overflow-hidden transition-all duration-300"
        style={{
          marginLeft: sidebarCollapsed ? "5rem" : "16rem", // 80px vs 256px
        }}
      >
        {/* ✅ Top Navbar */}
        <TopNavbar
          userRole="freelancer"
          onLogout={() => {}}
          onRoleChange={() => {}}
        />

        {/* ✅ Page Content */}
        <motion.main
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex-1 overflow-y-auto p-6 md:p-8"
        >
          <h1 className="text-3xl font-bold mb-6">Find Work</h1>
          <p className="text-foreground-secondary mb-8 max-w-2xl">
            Browse open projects and start earning by working with verified clients.
          </p>

          {/* 🔹 Example placeholder job list */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((job) => (
              <div
                key={job}
                className="glass-effect rounded-xl p-5 hover:shadow-lg transition-all duration-300"
              >
                <h3 className="text-lg font-semibold mb-2">Web3 Frontend Developer</h3>
                <p className="text-sm text-foreground-secondary mb-3">
                  Build decentralized dashboards using Next.js and Thirdweb.
                </p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground-secondary">Budget: 500 USDT</span>
                  <button className="px-4 py-2 bg-gradient-primary text-sm font-medium rounded-full hover:scale-105 transition-all">
                    Apply
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.main>
      </div>

      {/* ✅ Floating AI Assistant */}
      <AIAssistantChat
        isOpen={aiChatOpen}
        onToggle={() => setAiChatOpen(!aiChatOpen)}
      />
    </div>
  );
}
