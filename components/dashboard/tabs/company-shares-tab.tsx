"use client"

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"

/**
 * Company Shares Tab Component
 * Displays tokenized startups for investment
 * Shows company info: valuation, ROI, investor count
 */
interface CompanySharesTabProps {
  userRole: "freelancer" | "client" | "founder" | "investor"
}

export function CompanySharesTab({ userRole }: CompanySharesTabProps) {
  // Mock company data
  const companies = [
    {
      id: 1,
      name: "TechFlow AI",
      description: "AI-powered workflow automation platform",
      valuation: "$2.5M",
      roi: "+45%",
      investors: 24,
      tokenPrice: "0.25 USDC",
    },
    {
      id: 2,
      name: "BlockChain Labs",
      description: "Web3 infrastructure and development tools",
      valuation: "$5M",
      roi: "+120%",
      investors: 42,
      tokenPrice: "0.50 USDC",
    },
    {
      id: 3,
      name: "DeFi Vault",
      description: "Decentralized yield farming protocol",
      valuation: "$1.8M",
      roi: "+85%",
      investors: 18,
      tokenPrice: "0.15 USDC",
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-4xl font-bold text-foreground mb-2">Company Shares</h1>
        <p className="text-foreground-secondary">
          {userRole === "founder" ? "Manage your startup tokenization" : "Invest in promising startups"}
        </p>
      </motion.div>

      {/* Launch Company Button (for founders) */}
      {userRole === "founder" && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-full px-6 py-3 font-medium transition-all duration-300 ease-out hover:scale-105 active:scale-95 bg-gradient-primary text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40"
        >
          Launch Your Company
          <ArrowRight className="inline-block ml-2 w-4 h-4" />
        </motion.button>
      )}

      {/* Company Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {companies.map((company, index) => (
          <motion.div
            key={company.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="rounded-2xl p-6 transition-all duration-300 ease-out hover:shadow-lg glass-effect group hover:glow-primary flex flex-col"
          >
            {/* Company Header */}
            <div className="mb-4 pb-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground mb-1">{company.name}</h3>
              <p className="text-sm text-foreground-secondary">{company.description}</p>
            </div>

            {/* Stats */}
            <div className="space-y-3 mb-6 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground-secondary">Valuation</span>
                <span className="font-semibold text-foreground">{company.valuation}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground-secondary">ROI</span>
                <span className="font-semibold text-success">{company.roi}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground-secondary">Investors</span>
                <span className="font-semibold text-foreground">{company.investors}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground-secondary">Token Price</span>
                <span className="font-semibold text-secondary">{company.tokenPrice}</span>
              </div>
            </div>

            {/* Action Button */}
            <button className="w-full px-4 py-2 rounded-full bg-primary text-white font-medium hover:bg-primary-dark transition-all duration-300 ease-out">
              {userRole === "founder" ? "Manage" : "Invest"}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
