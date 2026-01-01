"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { Briefcase, Clock, DollarSign } from "lucide-react"

interface Job {
  id: number
  title: string
  description: string
  budget: string
  deadline: string
  applicants: number
}

interface JobListingProps {
  userRole: "freelancer" | "client" | "founder" | "investor"
}

export function JobListing({ userRole }: JobListingProps) {
  const [jobs, setJobs] = useState<Job[]>([
    {
      id: 1,
      title: "Build React Dashboard",
      description: "Create a responsive admin dashboard with charts and analytics",
      budget: "500 USDC",
      deadline: "7 days",
      applicants: 12,
    },
    {
      id: 2,
      title: "Smart Contract Audit",
      description: "Review and audit Solidity smart contract for security vulnerabilities",
      budget: "1,200 USDC",
      deadline: "14 days",
      applicants: 5,
    },
    {
      id: 3,
      title: "UI/UX Design",
      description: "Design mobile app interface for Web3 wallet application",
      budget: "800 USDC",
      deadline: "10 days",
      applicants: 8,
    },
  ])

  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const observerTarget = useRef<HTMLDivElement>(null)

  // Simulate loading more jobs
  const loadMoreJobs = useCallback(() => {
    if (isLoading || !hasMore) return

    setIsLoading(true)
    // Simulate API delay
    setTimeout(() => {
      const newJobs: Job[] = [
        {
          id: jobs.length + 1,
          title: `Project ${jobs.length + 1}`,
          description: "New project description for infinite scroll demo",
          budget: `${Math.floor(Math.random() * 2000) + 300} USDC`,
          deadline: `${Math.floor(Math.random() * 20) + 5} days`,
          applicants: Math.floor(Math.random() * 20) + 1,
        },
      ]
      setJobs((prev) => [...prev, ...newJobs])
      setIsLoading(false)
    }, 500)
  }, [jobs.length, isLoading, hasMore])

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMoreJobs()
        }
      },
      { threshold: 0.1 },
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => observer.disconnect()
  }, [loadMoreJobs, hasMore, isLoading])

  return (
    <div className="h-full flex flex-col">
      {/* Job Cards Container - Scrollable */}
      <div className="flex-1 overflow-y-auto pr-4 space-y-4">
        {jobs.map((job, index) => (
          <motion.div
            key={job.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.05 }}
            className="rounded-2xl p-6 transition-all duration-300 ease-out hover:shadow-lg glass-effect group hover:glow-primary"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground mb-2">{job.title}</h3>
                <p className="text-foreground-secondary text-sm mb-4">{job.description}</p>

                {/* Job Details */}
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2 text-foreground-secondary">
                    <DollarSign className="w-4 h-4 text-secondary" />
                    {job.budget}
                  </div>
                  <div className="flex items-center gap-2 text-foreground-secondary">
                    <Clock className="w-4 h-4 text-secondary" />
                    {job.deadline}
                  </div>
                  <div className="flex items-center gap-2 text-foreground-secondary">
                    <Briefcase className="w-4 h-4 text-secondary" />
                    {job.applicants} applicants
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button className="ml-4 px-6 py-2 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary-dark transition-all duration-300 ease-out whitespace-nowrap">
                {userRole === "client" ? "View" : "Apply"}
              </button>
            </div>
          </motion.div>
        ))}

        {/* Infinite Scroll Trigger */}
        <div ref={observerTarget} className="py-8 flex justify-center">
          {isLoading && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.1s" }} />
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.2s" }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
