"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import FundWallet from "@/components/FundWallet"
import EOATransaction from "@/components/EOATransaction"
import SmartAccountTransaction from "@/components/SmartAccountTransaction"
import { DeployFreelancerForm, DeployCompanyForm } from "@/components/OnchainForms"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function DevDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Developer Dashboard</h1>
          <p className="text-muted-foreground">Manage wallet and deploy your freelancer profile or company on-chain.</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/dashboard/wallet">Open Full Wallet</Link>
        </Button>
      </div>

      {/* Wallet quick actions keep feature intact */}
      <Tabs defaultValue="fund" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="fund">Fund</TabsTrigger>
          <TabsTrigger value="send">Send</TabsTrigger>
          <TabsTrigger value="gasless">Gasless</TabsTrigger>
        </TabsList>

        <TabsContent value="fund">
          <Card>
            <CardHeader>
              <CardTitle>Fund Your Wallet</CardTitle>
              <CardDescription>Add funds via Onramp</CardDescription>
            </CardHeader>
            <CardContent>
              <FundWallet />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="send">
          <Card>
            <CardHeader>
              <CardTitle>Send Transaction</CardTitle>
              <CardDescription>Send ETH to another address</CardDescription>
            </CardHeader>
            <CardContent>
              <EOATransaction />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gasless">
          <Card>
            <CardHeader>
              <CardTitle>Gasless Transaction</CardTitle>
              <CardDescription>Use Smart Accounts to cover gas</CardDescription>
            </CardHeader>
            <CardContent>
              <SmartAccountTransaction />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* On-chain deployment forms */}
      <div className="grid gap-4 md:grid-cols-2">
        <DeployFreelancerForm />
        <DeployCompanyForm />
      </div>
    </div>
  )
}
