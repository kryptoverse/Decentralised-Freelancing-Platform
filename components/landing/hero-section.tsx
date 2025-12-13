"use client"

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"

interface HeroSectionProps {
  onGetStarted: () => void
}

export function HeroSection({ onGetStarted }: HeroSectionProps) {
  return (
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center overflow-hidden px-4 sm:px-6 md:px-10 py-20 sm:py-24">
      {/* Animated Background Gradient */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="max-w-4xl mx-auto text-center px-2">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-4xl sm:text-5xl md:text-7xl font-bold mb-6 text-foreground leading-tight"
        >
          Freelance. Launch. Invest.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-base sm:text-lg md:text-2xl text-foreground-secondary mb-10 sm:mb-12 max-w-2xl mx-auto px-2"
        >
          Decentralized Freelancing connects people, capital, and AI — through blockchain simplicity.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full"
        >
          <button
            onClick={onGetStarted}
            className="rounded-full w-full sm:w-auto px-6 py-3 font-medium transition-all duration-300 ease-out hover:scale-105 active:scale-95 bg-gradient-primary dark:text-white text-gray-900 shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40"
          >
            Get Started
            <ArrowRight className="inline-block ml-2 w-5 h-5" />
          </button>
          <button
            onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            className="rounded-full w-full sm:w-auto px-6 py-3 font-medium transition-all duration-300 ease-out hover:scale-105 active:scale-95 bg-surface border border-border text-foreground hover:bg-surface-secondary"
          >
            Explore Platform
          </button>
        </motion.div>
      </div>
    </section>
  )
}
