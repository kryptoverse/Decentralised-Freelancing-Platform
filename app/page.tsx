"use client"

import { useIsInitialized, useIsSignedIn } from "@coinbase/cdp-hooks"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import Loading from "@/components/Loading"
import { AuthButton } from "@coinbase/cdp-react/components/AuthButton"
import Link from "next/link"

export default function HomePage() {
  const { isInitialized } = useIsInitialized()
  const { isSignedIn } = useIsSignedIn()
  const router = useRouter()

  useEffect(() => {
    if (isInitialized && isSignedIn) {
      router.push("/Company")
    }
  }, [isInitialized, isSignedIn, router])

  if (!isInitialized) return <Loading />
  if (isSignedIn) return <Loading />

  return (
    <main className="min-h-screen flex flex-col">
      {/* Top Nav */}
      <header className="border-b bg-card">
        <div className="mx-auto max-w-6xl flex h-16 items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md border bg-muted" aria-hidden />
            <span className="font-semibold">FreelanceChain</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground">
              Features
            </Link>
            <Link href="#faq" className="text-sm text-muted-foreground hover:text-foreground">
              FAQ
            </Link>
            <AuthButton />
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1">
        <div className="mx-auto max-w-6xl px-6 py-12 grid gap-8">
          <div className="space-y-5 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-balance">
              Build, hire, and invest with a friendly, light anime-inspired UI
            </h1>
            <p className="text-muted-foreground leading-relaxed text-pretty max-w-2xl mx-auto">
              Wallet-native onboarding for clients, investors, and developers. Deploy freelancer profiles and companies
              on-chain, manage portfolios, and transact with confidence.
            </p>
            <div className="flex justify-center">
              <AuthButton />
            </div>
            <p className="text-xs text-muted-foreground">After signing in, you will be redirected to your dashboard.</p>
          </div>

          {/* Feature highlights (no large image) */}
          <ul id="features" className="grid gap-4 md:grid-cols-3">
            <li className="rounded-lg border bg-card p-4">
              <p className="font-medium">Wallet-first</p>
              <p className="text-sm text-muted-foreground">Seamless Coinbase CDP embedded wallet onboarding.</p>
            </li>
            <li className="rounded-lg border bg-card p-4">
              <p className="font-medium">On-chain deployment</p>
              <p className="text-sm text-muted-foreground">Publish freelancer and company profiles on-chain.</p>
            </li>
            <li className="rounded-lg border bg-card p-4">
              <p className="font-medium">Investor-ready</p>
              <p className="text-sm text-muted-foreground">Transparent portfolios and transaction history.</p>
            </li>
          </ul>

          <div id="faq" className="rounded-lg border bg-card p-4">
            <p className="text-sm">
              Questions? After you sign in, access the dashboard to explore wallet, funding, and deployment features.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl flex h-14 items-center justify-between px-6">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} FreelanceChain</p>
          <div className="text-xs text-muted-foreground">Built with Coinbase CDP</div>
        </div>
      </footer>
    </main>
  )
}
