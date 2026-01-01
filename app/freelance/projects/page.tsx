"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Calendar, DollarSign } from "lucide-react"

export default function ProjectsPage() {
  const projects = [
    {
      id: 1,
      title: "DeFi Dashboard Development",
      description: "Build a comprehensive dashboard for tracking DeFi investments across multiple chains",
      budget: "$5,000 - $8,000",
      deadline: "2 weeks",
      status: "Open",
      proposals: 12,
      skills: ["React", "Web3.js", "DeFi", "TypeScript"],
    },
    {
      id: 2,
      title: "NFT Marketplace Smart Contracts",
      description: "Develop and audit smart contracts for an NFT marketplace with royalty features",
      budget: "$10,000 - $15,000",
      deadline: "1 month",
      status: "In Progress",
      proposals: 8,
      skills: ["Solidity", "OpenZeppelin", "Testing", "Security"],
    },
    {
      id: 3,
      title: "Mobile Wallet UI/UX Design",
      description: "Design a user-friendly mobile wallet interface with focus on Web3 onboarding",
      budget: "$3,000 - $5,000",
      deadline: "3 weeks",
      status: "Open",
      proposals: 15,
      skills: ["Figma", "Mobile Design", "Web3 UX", "Prototyping"],
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Browse and manage project opportunities</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Post Project
        </Button>
      </div>

      <div className="grid gap-6">
        {projects.map((project) => (
          <Card key={project.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle>{project.title}</CardTitle>
                  <CardDescription>{project.description}</CardDescription>
                </div>
                <Badge variant={project.status === "Open" ? "default" : "secondary"}>{project.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {project.skills.map((skill) => (
                  <Badge key={skill} variant="outline">
                    {skill}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  <span>{project.budget}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{project.deadline}</span>
                </div>
                <span>{project.proposals} proposals</span>
              </div>

              <div className="flex gap-2">
                <Button>View Details</Button>
                <Button variant="outline">Submit Proposal</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
