"use client"

import { motion } from "framer-motion"
import { Briefcase, TrendingUp, Brain } from "lucide-react"

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
    <section id="features" className="py-16 sm:py-20 px-4 sm:px-6 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-12 sm:mb-16 gradient-text"
        >
          Platform Features
        </motion.h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="rounded-2xl p-6 sm:p-8 transition-all duration-300 ease-out hover:shadow-lg glass-effect group hover:glow-primary text-center sm:text-left"
              >
                <div className="mb-4 p-3 rounded-full bg-gradient-primary w-fit mx-auto sm:mx-0">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-3 text-foreground">{feature.title}</h3>
                <p className="text-sm sm:text-base text-foreground-secondary">{feature.description}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
