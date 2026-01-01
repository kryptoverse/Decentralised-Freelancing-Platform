"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import FundWallet from "@/components/FundWallet"
import EOATransaction from "@/components/EOATransaction"
import SmartAccountTransaction from "@/components/SmartAccountTransaction"
import UserBalance from "@/components/UserBalance"

export default function WalletPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Wallet</h1>
        <p className="text-muted-foreground">Manage your wallet and transactions</p>
      </div>

      <UserBalance />

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
              <CardDescription>Add funds to your wallet using various methods</CardDescription>
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
              <CardDescription>Send transactions without paying gas fees using Smart Accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <SmartAccountTransaction />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
