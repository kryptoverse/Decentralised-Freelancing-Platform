"use client";

import { motion, AnimatePresence } from "framer-motion";

export default function HireSuccessModal({
  open,
  onClose,
  freelancer,
  amount,
}: any) {
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white dark:bg-neutral-900 p-6 rounded-2xl max-w-md w-full border border-neutral-800 shadow-xl"
          initial={{ scale: 0.85, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
        >
          <h2 className="text-xl font-bold mb-4">Freelancer Hired ✔</h2>

          <p className="text-sm mb-2">You hired:</p>

          <div className="p-3 rounded-xl bg-neutral-800/50 border border-neutral-700 text-sm font-mono mb-4">
            {freelancer}
          </div>

          <p className="text-sm mb-6">
            For <span className="font-bold">{amount} USDT</span>.
          </p>

          <button
            className="w-full py-2 rounded-xl bg-primary text-white hover:opacity-80"
            onClick={onClose}
          >
            Continue
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
