"use client"

import { motion } from "framer-motion"
import { Briefcase, TrendingUp, Brain, Lock, Zap, Users } from "lucide-react"

export function FeaturesSection() {
  const features = [
    {
      icon: Briefcase,
      title: "Secure Freelancing",
      description: "Smart contract escrow ensures payments are protected. Freelancers get paid on delivery, clients only pay for completed work.",
    },
    {
      icon: TrendingUp,
      title: "Tokenized Startups",
      description: "Founders can tokenize equity and raise capital transparently. Investors track portfolio performance in real-time on-chain.",
    },
    {
      icon: Brain,
      title: "AI Assistant",
      description: "Intelligent project matching, automated proposal generation, and real-time insights powered by advanced AI technology.",
    },
    {
      icon: Lock,
      title: "Blockchain Security",
      description: "All transactions secured by Polygon smart contracts. Immutable records and transparent dispute resolution.",
    },
    {
      icon: Zap,
      title: "Instant Settlements",
      description: "Receive payments in USDT immediately upon job completion. No waiting periods, no intermediaries, no delays.",
    },
    {
      icon: Users,
      title: "Verified Reputation",
      description: "Build an on-chain reputation that follows you everywhere. Showcase verified skills, completed projects, and client reviews.",
    },
  ]

  return (
    <section id="features" className="py-20 sm:py-24 px-4 sm:px-6 bg-section-background">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 gradient-text">
            Platform Features
          </h2>
          <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto">
            Everything you need to work, invest, and grow in the decentralized economy
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="rounded-2xl p-8 transition-all duration-300 ease-out hover:shadow-xl bg-white dark:bg-[#0B2B26] border border-card-border dark:border-[#163832] card-shadow group hover:-translate-y-1"
              >
                <div className="mb-5 p-4 rounded-xl bg-gradient-to-br from-brand-secondary to-muted-green w-fit group-hover:scale-110 transition-transform duration-300">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-foreground dark:text-white">{feature.title}</h3>
                <p className="text-sm sm:text-base text-text-secondary dark:text-white/70 leading-relaxed">{feature.description}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
