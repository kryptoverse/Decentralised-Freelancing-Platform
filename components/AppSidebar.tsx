"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Briefcase, Building2, PieChart, FolderKanban, Plus, Wallet } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type UserMode = "freelance" | "companies"

export default function AppSidebar() {
  const pathname = usePathname()
  const [userMode, setUserMode] = useState<UserMode>("companies")

  useEffect(() => {
    if (!pathname) return
    const freelancePaths = ["/freelance", "/freelance/my-projects", "/freelance/projects", "/freelance/wallet", "/freelance/freelancers"]
    const companiesPaths = [
      "/Company",
      "/Company/my-companies",
      "/Company/portfolio",
      "/Company/shares",
      "/Company/companies",
      "/Company/transactions",
    ]
    if (freelancePaths.some((p) => pathname.startsWith(p))) {
      setUserMode("freelance")
    } else if (companiesPaths.some((p) => pathname.startsWith(p))) {
      setUserMode("companies")
    }
  }, [pathname])

  const freelanceMenuItems = [
    { icon: LayoutDashboard, label: "Profile", href: "/freelance" },
    { icon: FolderKanban, label: "Ongoing Projects", href: "/freelance/my-projects" },
    { icon: Briefcase, label: "Find Work", href: "/freelance/projects" },
    { icon: Wallet, label: "Hire Freelancer", href: "/freelance/freelancers" },
    { icon: Wallet, label: "Wallet", href: "/freelance/wallet" },
    
  ]

  const companiesMenuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/Company" },
    { icon: Building2, label: "My Companies", href: "/Company/my-companies" },
    { icon: Plus, label: "Deploy Company", href: "/" },
    { icon: PieChart, label: "Portfolio", href: "/Company/portfolio" },
    { icon: PieChart, label: "My Shares", href: "/Company/shares" },
  ]

  const menuItems = userMode === "freelance" ? freelanceMenuItems : companiesMenuItems

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Select value={userMode} onValueChange={(value) => setUserMode(value as UserMode)}>
          <SelectTrigger>
            <SelectValue placeholder="Select mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="freelance">On Chain Freelance</SelectItem>
            <SelectItem value="companies">On Chain Companies</SelectItem>
          </SelectContent>
        </Select>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{userMode === "freelance" ? "Freelance" : "Companies"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
