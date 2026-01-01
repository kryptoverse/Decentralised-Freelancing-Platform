"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowUpRight, ArrowDownLeft, Calendar } from "lucide-react"

export default function TransactionsPage() {
  const transactions = [
    {
      id: 1,
      type: "buy",
      description: "Purchased 50 shares of DeFi Protocol Inc",
      amount: "$5,000",
      date: "2025-01-15",
      status: "completed",
      txHash: "0x1234...5678",
    },
    {
      id: 2,
      type: "buy",
      description: "Purchased 100 shares of NFT Marketplace Co",
      amount: "$9,500",
      date: "2025-01-10",
      status: "completed",
      txHash: "0xabcd...efgh",
    },
    {
      id: 3,
      type: "deposit",
      description: "Deposited ETH to wallet",
      amount: "$15,000",
      date: "2025-01-05",
      status: "completed",
      txHash: "0x9876...5432",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground">View your transaction history</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>All your blockchain transactions in one place</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-2 rounded-full ${tx.type === "buy" ? "bg-blue-100 dark:bg-blue-900" : "bg-green-100 dark:bg-green-900"}`}
                  >
                    {tx.type === "buy" ? (
                      <ArrowUpRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <ArrowDownLeft className="h-4 w-4 text-green-600 dark:text-green-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{tx.description}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{tx.date}</span>
                      <span>•</span>
                      <a
                        href={`https://etherscan.io/tx/${tx.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {tx.txHash}
                      </a>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{tx.amount}</p>
                  <Badge variant={tx.status === "completed" ? "default" : "secondary"}>{tx.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
