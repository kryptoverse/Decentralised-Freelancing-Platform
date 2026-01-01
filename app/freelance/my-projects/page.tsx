"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default function MyProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Projects</h1>
          <p className="text-muted-foreground">Manage your freelance projects and proposals</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Project
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Projects</CardTitle>
          <CardDescription>Projects you're currently working on</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <p>No active projects yet.</p>
            <p className="text-sm mt-2">Start by browsing available projects or create your own service offering.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending Proposals</CardTitle>
          <CardDescription>Proposals awaiting client response</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <p>No pending proposals.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
