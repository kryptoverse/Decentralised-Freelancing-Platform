"use client"

import { useEvmAddress } from "@coinbase/cdp-hooks"
import { AuthButton } from "@coinbase/cdp-react/components/AuthButton"
import { useTheme } from "next-themes"
import { Moon, Sun, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function Header() {
  const { evmAddress } = useEvmAddress()
  const { theme, setTheme } = useTheme()

  return (
    <header className="border-b bg-card sticky top-0 z-10">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">FreelanceChain</h1>
          </div>
          {evmAddress && (
            <Badge variant="secondary" className="font-mono text-xs">
              {evmAddress.slice(0, 6)}...{evmAddress.slice(-4)}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
          <AuthButton />
        </div>
      </div>
    </header>
  )
}
