"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown } from "lucide-react"

interface RoleSwitcherProps {
  selectedRole: "freelancer" | "client" | "founder" | "investor" | null
  onRoleSelect: (role: "freelancer" | "client" | "founder" | "investor") => void
  onGetStarted: () => void
}

export function RoleSwitcher({ selectedRole, onRoleSelect, onGetStarted }: RoleSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)

  const roles = [
    { id: "freelancer", label: "Freelancer", description: "Offer your skills" },
    { id: "client", label: "Client", description: "Hire talent" },
    { id: "founder", label: "Founder", description: "Launch startup" },
    { id: "investor", label: "Investor", description: "Invest capital" },
  ] as const

  const handleRoleSelect = (role: "freelancer" | "client" | "founder" | "investor") => {
    onRoleSelect(role)
    setIsOpen(false)
    onGetStarted()
  }

  const displayRole = selectedRole ? roles.find((r) => r.id === selectedRole)?.label : "Select Role"

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-full glass-effect hover:bg-surface-secondary transition-all duration-300 ease-out text-foreground font-medium"
      >
        {displayRole}
        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 mt-2 w-56 rounded-2xl overflow-hidden shadow-xl bg-surface border border-border z-50"
          >
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => handleRoleSelect(role.id)}
                className={`w-full px-4 py-3 text-left transition-all duration-300 ease-out flex flex-col ${
                  selectedRole === role.id
                    ? "bg-primary/10 border-l-4 border-primary"
                    : "hover:bg-surface-secondary border-l-4 border-transparent"
                }`}
              >
                <span className="font-semibold text-foreground">{role.label}</span>
                <span className="text-xs text-foreground-secondary">{role.description}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
