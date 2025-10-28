"use client"

import { motion } from "framer-motion"

/**
 * Footer Section Component
 * Minimal centered footer with links and social media
 * Features soft dividers and subtle gradient styling
 */
export function FooterSection() {
  return (
    <footer className="py-16 px-4 border-t border-border">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          {/* Footer Links */}
          <div className="flex flex-wrap justify-center gap-6 mb-8 text-sm">
            <a
              href="#"
              className="text-foreground-secondary hover:text-foreground transition-all duration-300 ease-out"
            >
              About
            </a>
            <span className="text-border">•</span>
            <a
              href="#"
              className="text-foreground-secondary hover:text-foreground transition-all duration-300 ease-out"
            >
              Whitepaper
            </a>
            <span className="text-border">•</span>
            <a
              href="#"
              className="text-foreground-secondary hover:text-foreground transition-all duration-300 ease-out"
            >
              Privacy
            </a>
            <span className="text-border">•</span>
            <a
              href="#"
              className="text-foreground-secondary hover:text-foreground transition-all duration-300 ease-out"
            >
              Socials
            </a>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-8" />

          {/* Copyright */}
          <p className="text-foreground-secondary text-sm">© 2025 FYP. Powered by Web3 and built for the future.</p>
        </motion.div>
      </div>
    </footer>
  )
}
