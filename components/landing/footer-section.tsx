"use client"

import { motion } from "framer-motion"

export function FooterSection() {
  return (
    <footer className="py-12 sm:py-16 px-4 sm:px-6 border-t border-soft-divider bg-section-background text-center">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <div className="flex flex-wrap justify-center gap-3 sm:gap-6 mb-6 sm:mb-8 text-sm">
            {["About", "Whitepaper", "Privacy", "Socials"].map((item, i) => (
              <a
                key={i}
                href="#"
                className="text-text-secondary hover:text-brand-secondary transition-all duration-300 ease-out font-medium"
              >
                {item}
              </a>
            ))}
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-soft-divider to-transparent mb-6 sm:mb-8" />

          <p className="text-text-secondary text-xs sm:text-sm">
            © 2025 Decentralized Freelancing Platform. Powered by Web3 and built for the future.
          </p>
        </motion.div>
      </div>
    </footer>
  )
}
