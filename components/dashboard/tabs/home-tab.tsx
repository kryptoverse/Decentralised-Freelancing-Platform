"use client";

import { motion } from "framer-motion";
import { Briefcase, Users, Rocket, DollarSign } from "lucide-react";
import { useRouter } from "next/navigation";

interface HomeTabProps {
  userRole?: "freelancer" | "client" | "founder" | "investor";
  onRoleChange: (role: "freelancer" | "client" | "founder" | "investor") => void;
}

/**
 * HomeTab Component
 * Shown when user logs in but has not selected a role.
 * Displays role options and redirects to that dashboard.
 */
export function HomeTab({ userRole, onRoleChange }: HomeTabProps) {
  const router = useRouter();

  const roles = [
    {
      id: "freelancer",
      title: "I'm looking for Jobs",
      description: "Find projects, earn in crypto, and grow your portfolio.",
      icon: Briefcase,
      color: "from-blue-500 to-indigo-500",
    },
    {
      id: "client",
      title: "I'm looking for Developers",
      description: "Hire top freelancers and manage your projects securely.",
      icon: Users,
      color: "from-emerald-500 to-teal-500",
    },
    {
      id: "founder",
      title: "I'm looking for Funding",
      description: "Launch your startup and connect with potential investors.",
      icon: Rocket,
      color: "from-purple-500 to-pink-500",
    },
    {
      id: "investor",
      title: "I'm looking to Invest",
      description: "Discover startups and earn equity or token-based returns.",
      icon: DollarSign,
      color: "from-amber-500 to-orange-500",
    },
  ];

  const handleSelectRole = (
    role: "freelancer" | "client" | "founder" | "investor"
  ) => {
    onRoleChange(role); // update role state globally
    router.push(`/${role}`); // navigate to that role's dashboard page
  };

  // Always render role-selection cards when userRole is not chosen
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center space-y-10 py-16 px-6">
      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3">
          Welcome to <span className="gradient-text">Decentralized Freelancing</span>
        </h1>
        <p className="text-foreground-secondary max-w-xl mx-auto">
          Choose what you want to do today. Your dashboard will adjust
          accordingly.
        </p>
      </motion.div>

      {/* Role Cards */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-6xl"
      >
        {roles.map((role) => {
          const Icon = role.icon;
          return (
            <motion.button
              key={role.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleSelectRole(role.id as any)}
              transition={{ type: "spring", stiffness: 200 }}
              className="rounded-2xl p-6 bg-surface border border-border hover:shadow-xl transition-all duration-300 ease-out group text-left"
            >
              <div
                className={`p-3 rounded-full bg-gradient-to-br ${role.color} text-white w-fit mb-4 group-hover:scale-110 transition-transform`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {role.title}
              </h3>
              <p className="text-sm text-foreground-secondary">
                {role.description}
              </p>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
