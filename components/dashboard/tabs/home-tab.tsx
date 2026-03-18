"use client";

import { motion } from "framer-motion";
import { Briefcase, Users, Rocket, DollarSign, ArrowUpRight, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

interface HomeTabProps {
  userRole?: "freelancer" | "client" | "founder" | "investor";
  onRoleChange: (role: "freelancer" | "client" | "founder" | "investor") => void;
}

export function HomeTab({ userRole, onRoleChange }: HomeTabProps) {
  const router = useRouter();

  const handleSelectRole = (
    role: "freelancer" | "client" | "founder" | "investor"
  ) => {
    onRoleChange(role);
    router.push(`/${role}`);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  // Convai-inspired Accents adapted for light/dark mode:
  // We use the app's native background, but make the cards slightly denser/darker
  // and use the bright neon green (#7DE981) for the sleek tech accents.

  return (
    <div className="w-full h-full flex flex-col justify-center py-10 px-4 md:px-8">
      <div className="w-full max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1A261E]/80 dark:bg-[#1A261E] text-[#7DE981] text-sm font-semibold mb-4 border border-[#233629]">
            <Sparkles className="w-4 h-4" />
            <span>Select your portal</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-5xl font-bold tracking-tight text-foreground mb-4">
            The simplest and easiest<br />
            platform to craft your future
          </h1>
          <p className="text-foreground-secondary text-lg md:text-xl max-w-2xl">
            What brings you to the decentralized economy today? Select a role below to customize your dashboard.
          </p>
        </motion.div>

        {/* 4 Cards on the same line on desktop */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-[300px]"
        >
          {/* Freelancer */}
          <motion.button
            variants={itemVariants}
            onClick={() => handleSelectRole("freelancer")}
            whileHover={{ y: -8 }}
            whileTap={{ scale: 0.98 }}
            // We use bg-black/5 (light) and bg-black/40 (dark) to make cards slightly darker and denser than the background
            className="relative rounded-3xl overflow-hidden group text-left border border-border hover:border-[#7DE981]/60 bg-black/5 dark:bg-black/40 backdrop-blur-sm transition-all duration-300 shadow-sm hover:shadow-lg"
          >
            {/* Subtle Gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-transparent to-[#7DE981]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

            <div className="relative z-10 h-full p-6 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="p-4 rounded-xl bg-[#1A261E] text-[#7DE981] group-hover:bg-[#7DE981]/20 transition-colors duration-300 shadow-sm">
                  <Briefcase className="w-8 h-8" />
                </div>
                {/* Fixed the icon hover colors to ensure they change properly */}
                <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground-secondary group-hover:border-[#7DE981] group-hover:bg-[#7DE981] group-hover:text-black transition-colors duration-300 shadow-sm">
                  <ArrowUpRight className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-foreground mb-2 tracking-tight group-hover:text-[#7DE981] transition-colors">Find Work</h3>
                <p className="text-foreground-secondary text-sm leading-relaxed">Discover high-paying Web3 projects, build your on-chain reputation, and get paid securely.</p>
              </div>
            </div>
          </motion.button>

          {/* Client */}
          <motion.button
            variants={itemVariants}
            onClick={() => handleSelectRole("client")}
            whileHover={{ y: -8 }}
            whileTap={{ scale: 0.98 }}
            className="relative rounded-3xl overflow-hidden group text-left border border-border hover:border-[#7DE981]/60 bg-black/5 dark:bg-black/40 backdrop-blur-sm transition-all duration-300 shadow-sm hover:shadow-lg"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-transparent to-[#7DE981]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

            <div className="relative z-10 h-full p-6 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="p-4 rounded-xl bg-[#1A261E] text-[#7DE981] group-hover:bg-[#7DE981]/20 transition-colors duration-300 shadow-sm">
                  <Users className="w-8 h-8" />
                </div>
                <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground-secondary group-hover:border-[#7DE981] group-hover:bg-[#7DE981] group-hover:text-black transition-colors duration-300 shadow-sm">
                  <ArrowUpRight className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-foreground mb-2 tracking-tight group-hover:text-[#7DE981] transition-colors">Hire Talent</h3>
                <p className="text-foreground-secondary text-sm leading-relaxed">Tap into a global network of verified Web3 experts managed via smart escrow contracts.</p>
              </div>
            </div>
          </motion.button>

          {/* Founder */}
          <motion.button
            variants={itemVariants}
            onClick={() => handleSelectRole("founder")}
            whileHover={{ y: -8 }}
            whileTap={{ scale: 0.98 }}
            className="relative rounded-3xl overflow-hidden group text-left border border-border hover:border-[#7DE981]/60 bg-black/5 dark:bg-black/40 backdrop-blur-sm transition-all duration-300 shadow-sm hover:shadow-lg"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-transparent to-[#7DE981]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

            <div className="relative z-10 h-full p-6 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="p-4 rounded-xl bg-[#1A261E] text-[#7DE981] group-hover:bg-[#7DE981]/20 transition-colors duration-300 shadow-sm">
                  <Rocket className="w-8 h-8" />
                </div>
                <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground-secondary group-hover:border-[#7DE981] group-hover:bg-[#7DE981] group-hover:text-black transition-colors duration-300 shadow-sm">
                  <ArrowUpRight className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-foreground mb-2 tracking-tight group-hover:text-[#7DE981] transition-colors">Raise Capital</h3>
                <p className="text-foreground-secondary text-sm leading-relaxed">Launch your startup, pitch to our network of investors, and secure funding efficiently.</p>
              </div>
            </div>
          </motion.button>

          {/* Investor */}
          <motion.button
            variants={itemVariants}
            onClick={() => handleSelectRole("investor")}
            whileHover={{ y: -8 }}
            whileTap={{ scale: 0.98 }}
            className="relative rounded-3xl overflow-hidden group text-left border border-border hover:border-[#7DE981]/60 bg-black/5 dark:bg-black/40 backdrop-blur-sm transition-all duration-300 shadow-sm hover:shadow-lg"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-transparent to-[#7DE981]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

            <div className="relative z-10 h-full p-6 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="p-4 rounded-xl bg-[#1A261E] text-[#7DE981] group-hover:bg-[#7DE981]/20 transition-colors duration-300 shadow-sm">
                  <DollarSign className="w-8 h-8" />
                </div>
                <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground-secondary group-hover:border-[#7DE981] group-hover:bg-[#7DE981] group-hover:text-black transition-colors duration-300 shadow-sm">
                  <ArrowUpRight className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-foreground mb-2 tracking-tight group-hover:text-[#7DE981] transition-colors">Invest</h3>
                <p className="text-foreground-secondary text-sm leading-relaxed">Discover vetted Web3 startups and top-tier talent. Earn equitable returns securely.</p>
              </div>
            </div>
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
