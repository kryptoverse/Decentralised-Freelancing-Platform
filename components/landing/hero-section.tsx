"use client"

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"

interface HeroSectionProps {
  onGetStarted: () => void
}

export function HeroSection({ onGetStarted }: HeroSectionProps) {
  return (
    <section className="relative min-h-[85vh] flex flex-col items-center justify-center overflow-hidden px-4 sm:px-6 md:px-10 py-20 sm:py-24 bg-pastel-light">
      {/* Subtle Background Gradient */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-pastel-mint/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-pastel-card/40 rounded-full blur-3xl" />
      </div>

      <div className="max-w-5xl mx-auto text-center px-2 relative z-10">
        {/* Small Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 backdrop-blur-sm border border-soft-divider/50 mb-8 shadow-sm"
        >
          <span className="text-xs font-medium text-brand-primary tracking-wide uppercase">work it own it</span>
        </motion.div>

        {/* Main Headline - Serif Font */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-serif font-normal mb-8 text-foreground leading-tight tracking-tight"
          style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}
        >
          Freelance. Launch.{" "}
          <span className="italic">Invest.</span>
        </motion.h1>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-base sm:text-lg md:text-xl text-text-secondary mb-12 max-w-4xl mx-auto px-2 leading-relaxed"
        >
          <span className="font-bold text-brand-dark">WORQS</span> turns <span className="text-[#163832] font-semibold underline decoration-brand-primary/30">Work</span> into value, 
          builds <span className="text-[#163832] font-semibold underline decoration-brand-primary/30">Reputation</span> on-chain, 
          delivers <span className="text-[#163832] font-semibold underline decoration-brand-primary/30">QuickPay</span> instantly, 
          and distributes <span className="text-[#163832] font-semibold underline decoration-brand-primary/30">Ownership</span> through <span className="text-[#163832] font-semibold underline decoration-brand-primary/30">Shares</span>.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full"
        >
          <button
            onClick={onGetStarted}
            className="group rounded-full w-full sm:w-auto px-8 py-3.5 font-medium transition-all duration-300 ease-out hover:scale-105 active:scale-95 bg-[#163832] text-white shadow-lg hover:shadow-xl hover:bg-[#235347] flex items-center justify-center gap-2"
          >
            Login
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
            className="rounded-full w-full sm:w-auto px-8 py-3.5 font-medium transition-all duration-300 ease-out hover:scale-105 active:scale-95 bg-white dark:bg-[#163832] border-2 border-brand-primary/20 dark:border-brand-primary text-brand-dark dark:text-white hover:bg-white dark:hover:bg-[#235347] hover:border-brand-primary"
          >
            Explore Platform
          </button>
        </motion.div>
      </div>
    </section>
  )
}
