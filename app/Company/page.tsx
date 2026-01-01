"use client"

import { useEvmAddress } from "@coinbase/cdp-hooks"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Briefcase, Building2, TrendingUp, Wallet, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import UserBalance from "@/components/UserBalance"

export default function DashboardPage() {
  const { evmAddress } = useEvmAddress()

  const stats = [
    {
      title: "Active Projects",
      value: "0",
      description: "Projects you're working on",
      icon: Briefcase,
      href: "/dashboard/projects",
    },
    {
      title: "Companies",
      value: "0",
      description: "Companies you've invested in",
      icon: Building2,
      href: "/dashboard/companies",
    },
    {
      title: "Portfolio Value",
      value: "$0.00",
      description: "Total value of your investments",
      icon: TrendingUp,
      href: "/dashboard/portfolio",
    },
    {
      title: "Wallet Balance",
      value: "0 ETH",
      description: "Your current balance",
      icon: Wallet,
      href: "/dashboard/wallet",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your overview.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <UserBalance />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Freelancing Module
            </CardTitle>
            <CardDescription>Browse freelancers, post projects, or offer your services</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Connect with talented freelancers worldwide or showcase your skills to potential clients.
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="default" size="sm">
                <Link href="/dashboard/freelancers">
                  Browse Freelancers
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/projects">View Projects</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Company Shares Module
            </CardTitle>
            <CardDescription>Invest in companies or tokenize your business</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Discover investment opportunities or tokenize your company shares on the blockchain.
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="default" size="sm">
                <Link href="/dashboard/companies">
                  Browse Companies
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/shares">My Shares</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
