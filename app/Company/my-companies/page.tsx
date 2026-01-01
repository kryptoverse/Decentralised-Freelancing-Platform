"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Building2 } from "lucide-react"

export default function MyCompaniesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Companies</h1>
          <p className="text-muted-foreground">Manage your tokenized company shares</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Tokenize Company
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Companies</CardTitle>
          <CardDescription>Companies you've tokenized on the blockchain</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No companies tokenized yet.</p>
            <p className="text-sm mt-2">
              Tokenize your company shares to raise capital and provide liquidity to investors.
            </p>
            <Button className="mt-4">Learn More</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
