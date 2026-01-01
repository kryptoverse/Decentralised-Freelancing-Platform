"use client"

import { AuthButton } from "@coinbase/cdp-react/components/AuthButton"
import { Sparkles, Shield, Zap } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export default function SignInScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-4 py-12">
      <div className="text-center space-y-4 max-w-2xl">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Sparkles className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-5xl font-bold tracking-tight">Welcome to FreelanceChain</h1>
        <p className="text-xl text-muted-foreground">
          The decentralized platform for freelancing and company shares powered by blockchain technology
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl w-full">
        <Card>
          <CardContent className="pt-6 text-center space-y-2">
            <Shield className="h-8 w-8 mx-auto text-primary" />
            <h3 className="font-semibold">Secure Payments</h3>
            <p className="text-sm text-muted-foreground">Smart contracts ensure safe and transparent transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center space-y-2">
            <Zap className="h-8 w-8 mx-auto text-primary" />
            <h3 className="font-semibold">Instant Settlements</h3>
            <p className="text-sm text-muted-foreground">Get paid immediately upon project completion</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center space-y-2">
            <Sparkles className="h-8 w-8 mx-auto text-primary" />
            <h3 className="font-semibold">Tokenized Shares</h3>
            <p className="text-sm text-muted-foreground">Invest in companies through blockchain-based shares</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col items-center gap-4">
        <AuthButton />
        <p className="text-sm text-muted-foreground">Connect your Coinbase wallet to get started</p>
      </div>
    </div>
  )
}
