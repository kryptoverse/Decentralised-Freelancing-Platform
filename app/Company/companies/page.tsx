"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Building2 } from "lucide-react"

export default function CompaniesPage() {
  const companies = [
    {
      id: 1,
      name: "DeFi Protocol Inc",
      description: "Leading decentralized finance protocol with $500M TVL",
      sector: "DeFi",
      sharePrice: "$125.50",
      change: "+12.5%",
      trending: "up",
      marketCap: "$50M",
      availableShares: "1,000",
    },
    {
      id: 2,
      name: "NFT Marketplace Co",
      description: "Premier NFT marketplace with 100K+ active users",
      sector: "NFT",
      sharePrice: "$89.00",
      change: "-3.2%",
      trending: "down",
      marketCap: "$35M",
      availableShares: "2,500",
    },
    {
      id: 3,
      name: "Web3 Gaming Studio",
      description: "Innovative blockchain gaming platform",
      sector: "Gaming",
      sharePrice: "$45.75",
      change: "+8.1%",
      trending: "up",
      marketCap: "$22M",
      availableShares: "5,000",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Companies</h1>
        <p className="text-muted-foreground">Explore investment opportunities in Web3 companies</p>
      </div>

      <div className="grid gap-6">
        {companies.map((company) => (
          <Card key={company.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{company.name}</CardTitle>
                      <CardDescription>{company.description}</CardDescription>
                    </div>
                    <Badge>{company.sector}</Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Share Price</p>
                  <p className="text-2xl font-bold">{company.sharePrice}</p>
                  <div
                    className={`flex items-center gap-1 text-sm ${company.trending === "up" ? "text-green-600" : "text-red-600"}`}
                  >
                    {company.trending === "up" ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    <span>{company.change}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Market Cap</p>
                  <p className="text-xl font-semibold">{company.marketCap}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Available Shares</p>
                  <p className="text-xl font-semibold">{company.availableShares}</p>
                </div>
                <div className="flex items-end">
                  <Button className="w-full">Invest Now</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
