"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown } from "lucide-react"

export default function SharesPage() {
  const shares = [
    {
      id: 1,
      company: "DeFi Protocol Inc",
      sector: "DeFi",
      owned: 50,
      currentPrice: "$125.50",
      purchasePrice: "$100.00",
      totalValue: "$6,275",
      change: "+25.5%",
      trending: "up",
    },
    {
      id: 2,
      company: "NFT Marketplace Co",
      sector: "NFT",
      owned: 100,
      currentPrice: "$89.00",
      purchasePrice: "$95.00",
      totalValue: "$8,900",
      change: "-6.3%",
      trending: "down",
    },
  ]

  const totalValue = shares.reduce((acc, share) => {
    return acc + Number.parseFloat(share.totalValue.replace(/[$,]/g, ""))
  }, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Shares</h1>
        <p className="text-muted-foreground">Track your company share investments</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Portfolio Summary</CardTitle>
          <CardDescription>Total value of your share holdings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">${totalValue.toLocaleString()}</div>
          <p className="text-sm text-muted-foreground mt-1">Across {shares.length} companies</p>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        {shares.map((share) => (
          <Card key={share.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{share.company}</CardTitle>
                  <CardDescription>{share.owned} shares owned</CardDescription>
                </div>
                <Badge>{share.sector}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-5">
                <div>
                  <p className="text-sm text-muted-foreground">Current Price</p>
                  <p className="text-lg font-semibold">{share.currentPrice}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Purchase Price</p>
                  <p className="text-lg font-semibold">{share.purchasePrice}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-lg font-semibold">{share.totalValue}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Change</p>
                  <div
                    className={`flex items-center gap-1 ${share.trending === "up" ? "text-green-600" : "text-red-600"}`}
                  >
                    {share.trending === "up" ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    <span className="text-lg font-semibold">{share.change}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
