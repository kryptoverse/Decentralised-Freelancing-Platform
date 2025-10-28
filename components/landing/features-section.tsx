"use client"

import { motion } from "framer-motion"
import { Briefcase, TrendingUp, Brain } from "lucide-react"

/**
 * Features Section Component
 * Displays three main platform features in glassmorphism cards
 * Each card has icon, title, and description
 */
export function FeaturesSection() {
  const features = [
    {
      icon: Briefcase,
      title: "Freelancing",
      description: "Secure escrow payments for clients & freelancers with on-chain protection",
    },
    {
      icon: TrendingUp,
      title: "Company Shares",
      description: "Tokenized startups & transparent investing with real-time portfolio tracking",
    },
    {
      icon: Brain,
      title: "AI Assistant",
      description: "Chat-powered automation & project insights powered by advanced AI",
    },
  ]

  return (
    <section id="features" className="py-20 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="text-4xl md:text-5xl font-bold text-center mb-16 gradient-text"
        >
          Platform Features
        </motion.h2>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="rounded-2xl p-6 transition-all duration-300 ease-out hover:shadow-lg glass-effect group hover:glow-primary"
              >
                <div className="mb-4 p-3 rounded-full bg-gradient-primary w-fit">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">{feature.title}</h3>
                <p className="text-foreground-secondary">{feature.description}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
