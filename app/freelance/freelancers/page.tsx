"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Star, MapPin, Clock } from "lucide-react"

export default function FreelancersPage() {
  const freelancers = [
    {
      id: 1,
      name: "Alex Chen",
      title: "Full Stack Developer",
      rating: 4.9,
      reviews: 127,
      hourlyRate: "$85/hr",
      location: "San Francisco, CA",
      skills: ["React", "Node.js", "TypeScript", "Web3"],
      availability: "Available",
    },
    {
      id: 2,
      name: "Sarah Johnson",
      title: "Smart Contract Developer",
      rating: 5.0,
      reviews: 89,
      hourlyRate: "$120/hr",
      location: "New York, NY",
      skills: ["Solidity", "Ethereum", "Hardhat", "Security"],
      availability: "Available",
    },
    {
      id: 3,
      name: "Michael Park",
      title: "UI/UX Designer",
      rating: 4.8,
      reviews: 156,
      hourlyRate: "$75/hr",
      location: "Austin, TX",
      skills: ["Figma", "Design Systems", "Web3 UX", "Prototyping"],
      availability: "Busy",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Browse Freelancers</h1>
        <p className="text-muted-foreground">Find talented professionals for your projects</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {freelancers.map((freelancer) => (
          <Card key={freelancer.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback>
                    {freelancer.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle className="text-lg">{freelancer.name}</CardTitle>
                  <CardDescription>{freelancer.title}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold">{freelancer.rating}</span>
                  <span className="text-muted-foreground">({freelancer.reviews})</span>
                </div>
                <span className="font-semibold text-primary">{freelancer.hourlyRate}</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{freelancer.location}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                <Badge variant={freelancer.availability === "Available" ? "default" : "secondary"}>
                  {freelancer.availability}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                {freelancer.skills.map((skill) => (
                  <Badge key={skill} variant="outline" className="text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>

              <Button className="w-full">View Profile</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
