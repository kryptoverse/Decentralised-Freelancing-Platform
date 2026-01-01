"use client"

import { motion } from "framer-motion"

interface LandingPageProps {
  onGetStarted: () => void
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 sm:px-6 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-2xl"
      >
        <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
          Welcome to <span className="gradient-text">FYP</span>
        </h1>
        <p className="text-sm sm:text-base md:text-lg text-foreground-secondary max-w-xl mx-auto mb-8">
          Web3 platform connecting freelancers, founders, and investors.
        </p>
        <button
          onClick={onGetStarted}
          className="rounded-full px-6 sm:px-8 py-3 bg-gradient-primary text-white font-semibold shadow-lg hover:scale-105 transition-all w-full sm:w-auto"
        >
          Get Started
        </button>
      </motion.div>
    </div>
  )
}
