"use client";

import { motion } from "framer-motion";
import { Menu, X, ChevronLeft, ChevronRight, Home as HomeIcon } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { ROLE_TABS, ROLE_ROUTES } from "@/src/config/roles-config";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  isCollapsed: boolean;
  onCollapse: () => void;
  userRole: keyof typeof ROLE_ROUTES | null | undefined;
}

export function Sidebar({
  activeTab,
  onTabChange,
  isOpen,
  onToggle,
  isCollapsed,
  onCollapse,
  userRole,
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  // 1. build nav items:
  //    - if user hasn't picked a role yet (userRole = null), show just the "universal dashboard home"
  //    - else show that role's full sidebar config
  const navItems = !userRole
    ? [
        {
          id: "home",
          label: "Home",
          icon: HomeIcon,
          path: "/",
          match: "exact" as const,
        },
      ]
    : ROLE_TABS[userRole];

  // Normalize helper for comparisons
  const normalize = (path: string) =>
    path.endsWith("/") && path !== "/" ? path.slice(0, -1) : path;

  const current = normalize(pathname);

  // Given navItem.match, decide if it should highlight
  const isActiveForRoute = (itemPath: string, match: "exact" | "startsWith") => {
    const cleanItem = normalize(itemPath);

    if (match === "exact") {
      // example: item "/freelancer" ONLY matches "/freelancer"
      return current === cleanItem;
    }

    // match === "startsWith"
    // example: item "/freelancer/Profile" should match "/freelancer/Profile" and "/freelancer/Profile/Edit"
    if (current === cleanItem) return true;
    if (current.startsWith(cleanItem + "/")) return true;
    return false;
  };

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={onToggle}
        className="md:hidden fixed top-4 left-4 z-30 p-2 rounded-full glass-effect"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Sidebar Panel */}
      <motion.aside
        initial={false}
        animate={{
          x: isOpen ? 0 : -300,
          width: isCollapsed ? 80 : 256,
        }}
        transition={{ duration: 0.3 }}
        className="fixed top-0 left-0 h-screen glass-effect-dark border-r border-border p-6 flex flex-col z-20 overflow-hidden"
      >
        {/* Header */}
        <div className="mb-8 pt-8 md:pt-0 flex items-center justify-between">
          {!isCollapsed && (
            <div>
              <h1 className="text-2xl font-bold gradient-text">FYP</h1>
              <p className="text-xs text-foreground-secondary">Web3 Platform</p>
            </div>
          )}
          <button
            onClick={onCollapse}
            className="hidden md:flex p-1 rounded-lg hover:bg-surface-secondary transition-all duration-300 ease-out"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActiveForRoute(item.path, item.match);

            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  router.push(item.path);
                  if (window.innerWidth < 768) onToggle();
                }}
                className={`w-full flex items-center transition-all duration-300 ease-out rounded-xl ${
                  isCollapsed ? "justify-center p-4" : "gap-3 px-4 py-3"
                } ${
                  isActive
                    ? "bg-gradient-primary text-foreground shadow-lg shadow-primary/30 font-semibold"
                    : "text-foreground-secondary hover:bg-surface-secondary hover:text-foreground"
                }`}
                title={isCollapsed ? item.label : ""}
              >
                <Icon
                  className={`w-6 h-6 flex-shrink-0 transition-transform duration-200 ${
                    isCollapsed ? "hover:scale-110" : ""
                  }`}
                />
                {!isCollapsed && (
                  <span className="font-medium text-sm md:text-base">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="pt-6 border-t border-border">
          {!isCollapsed && (
            <p className="text-xs text-foreground-secondary text-center">
              Connected to Polygon Network
            </p>
          )}
        </div>
      </motion.aside>

      {/* Mobile overlay */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onToggle}
          className="fixed inset-0 bg-black/50 md:hidden z-10"
        />
      )}
    </>
  );
}
