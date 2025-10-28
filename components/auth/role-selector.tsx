"use client"

import { motion } from "framer-motion"
import { Briefcase, Users, Rocket, TrendingUp } from "lucide-react"

/**
 * Role Selector Component
 * Displays 4 role options in a grid layout
 * Each role has icon, title, and description
 */
interface RoleSelectorProps {
  onSelect: (role: "freelancer" | "client" | "founder" | "investor") => void
}

export function RoleSelector({ onSelect }: RoleSelectorProps) {
  const roles = [
    {
      id: "freelancer",
      icon: Briefcase,
      title: "Freelancer",
      description: "Offer your skills",
    },
    {
      id: "client",
      icon: Users,
      title: "Client",
      description: "Hire talent",
    },
    {
      id: "founder",
      icon: Rocket,
      title: "Founder",
      description: "Launch startup",
    },
    {
      id: "investor",
      icon: TrendingUp,
      title: "Investor",
      description: "Invest in startups",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4">
      {roles.map((role, index) => {
        const Icon = role.icon
        return (
          <motion.button
            key={role.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => onSelect(role.id as any)}
            className="rounded-2xl p-6 transition-all duration-300 ease-out hover:shadow-lg bg-surface-secondary border border-border hover:border-primary hover:glow-primary group"
          >
            <div className="mb-3 p-2 rounded-full bg-primary/10 w-fit group-hover:bg-primary/20 transition-all duration-300 ease-out">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground text-sm">{role.title}</h3>
            <p className="text-xs text-foreground-secondary">{role.description}</p>
          </motion.button>
        )
      })}
    </div>
  )
}
