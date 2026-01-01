"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Briefcase, Building2, TrendingUp } from "lucide-react"

export default function PortfolioPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
        <p className="text-muted-foreground">Overview of all your investments and projects</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Portfolio Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$15,175</div>
            <p className="text-xs text-green-600">+12.5% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">No active projects</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Company Investments</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">Companies invested in</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="shares" className="space-y-4">
        <TabsList>
          <TabsTrigger value="shares">Share Holdings</TabsTrigger>
          <TabsTrigger value="projects">Project History</TabsTrigger>
        </TabsList>
        <TabsContent value="shares" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Share Holdings</CardTitle>
              <CardDescription>Your current company share investments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-semibold">DeFi Protocol Inc</p>
                    <p className="text-sm text-muted-foreground">50 shares</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">$6,275</p>
                    <Badge variant="default" className="bg-green-600">
                      +25.5%
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-semibold">NFT Marketplace Co</p>
                    <p className="text-sm text-muted-foreground">100 shares</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">$8,900</p>
                    <Badge variant="secondary">-6.3%</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="projects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project History</CardTitle>
              <CardDescription>Your completed and ongoing projects</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                No projects yet. Start by browsing available projects or posting your own.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
