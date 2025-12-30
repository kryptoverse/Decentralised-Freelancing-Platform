"use client"

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { JobListing } from "../job-listing"

/**
 * Freelancing Tab Component
 * Displays job listings with apply/pay buttons
 * Shows job details: title, token amount, deadline
 */
interface FreelancingTabProps {
  userRole: "freelancer" | "client" | "founder" | "investor"
}

export function FreelancingTab({ userRole }: FreelancingTabProps) {
  return (
    <div className="h-full flex flex-col gap-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-4xl font-bold text-foreground mb-2">Freelancing</h1>
        <p className="text-foreground-secondary">
          {userRole === "client" ? "Post and manage your projects" : "Browse and apply for jobs"}
        </p>
      </motion.div>

      {/* Post Job Button (for clients) */}
      {userRole === "client" && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-full px-6 py-3 font-medium transition-all duration-300 ease-out hover:scale-105 active:scale-95 bg-gradient-primary text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 w-fit"
        >
          Post a New Job
          <ArrowRight className="inline-block ml-2 w-4 h-4" />
        </motion.button>
      )}

      {/* Job Listing with Infinite Scroll */}
      <JobListing userRole={userRole} />
    </div>
  )
}
