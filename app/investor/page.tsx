"use client";

import { motion } from "framer-motion";

export default function InvestorDashboard() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <h1 className="text-3xl font-bold">Investor Dashboard</h1>
      <p className="text-foreground-secondary max-w-2xl">
        Explore verified startups, review their smart contracts, and invest with trustless transparency.
      </p>

      {/* Example placeholder investment cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((proj) => (
          <div
            key={proj}
            className="glass-effect rounded-xl p-5 hover:shadow-lg transition-all duration-300"
          >
            <h3 className="text-lg font-semibold mb-2">Startup #{proj}</h3>
            <p className="text-sm text-foreground-secondary mb-3">
              Decentralized tool for Web3 project funding.
            </p>
            <div className="flex justify-between items-center">
              <span className="text-sm text-foreground-secondary">Target: 10,000 USDT</span>
              <button className="px-4 py-2 bg-gradient-primary text-sm font-medium rounded-full hover:scale-105 transition-all">
                Invest
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
