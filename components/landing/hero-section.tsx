"use client"

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"

/**
 * Hero Section Component
 * Displays main headline, subtext, and call-to-action buttons
 * Features animated gradient background and smooth transitions
 */
interface HeroSectionProps {
  onGetStarted: () => void
}

export function HeroSection({ onGetStarted }: HeroSectionProps) {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 py-20">
      {/* Animated Background Gradient */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="max-w-4xl mx-auto text-center">
        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-5xl md:text-7xl font-bold mb-6 text-foreground"
        >
          Freelance. Launch. Invest.
        </motion.h1>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-xl md:text-2xl text-foreground-secondary mb-12 max-w-2xl mx-auto"
        >
          FYP connects people, capital, and AI — through blockchain simplicity.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <button
            onClick={onGetStarted}
            className="rounded-full px-6 py-3 font-medium transition-all duration-300 ease-out hover:scale-105 active:scale-95 bg-gradient-primary dark:text-white text-gray-900 shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40"
          >
            Get Started
            <ArrowRight className="inline-block ml-2 w-5 h-5" />
          </button>
          <button
            onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            className="rounded-full px-6 py-3 font-medium transition-all duration-300 ease-out hover:scale-105 active:scale-95 bg-surface border border-border text-foreground hover:bg-surface-secondary"
          >
            Explore Platform
          </button>
        </motion.div>
      </div>
    </section>
  )
}
