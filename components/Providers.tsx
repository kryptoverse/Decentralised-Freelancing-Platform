"use client"

import type React from "react"

import { ThemeProvider } from "next-themes"
import { CDPReactProvider, type Config } from "@coinbase/cdp-react/components/CDPReactProvider"
import { theme } from "@/components/theme"

interface ProvidersProps {
  children: React.ReactNode
}

const ethereumAccountType = process.env.NEXT_PUBLIC_CDP_CREATE_ETHEREUM_ACCOUNT_TYPE
  ? process.env.NEXT_PUBLIC_CDP_CREATE_ETHEREUM_ACCOUNT_TYPE === "smart"
    ? "smart"
    : "eoa"
  : undefined

const solanaAccountType = process.env.NEXT_PUBLIC_CDP_CREATE_SOLANA_ACCOUNT
  ? process.env.NEXT_PUBLIC_CDP_CREATE_SOLANA_ACCOUNT === "true"
  : undefined

if (!ethereumAccountType && !solanaAccountType) {
  throw new Error(
    "Either NEXT_PUBLIC_CDP_CREATE_ETHEREUM_ACCOUNT_TYPE or NEXT_PUBLIC_CDP_CREATE_SOLANA_ACCOUNT must be defined",
  )
}

const CDP_CONFIG = {
  projectId: process.env.NEXT_PUBLIC_CDP_PROJECT_ID ?? "",
  ...(ethereumAccountType && {
    ethereum: {
      createOnLogin: ethereumAccountType,
    },
  }),
  ...(solanaAccountType && {
    solana: {
      createOnLogin: solanaAccountType,
    },
  }),
  appName: "CDP Next.js StarterKit",
  appLogoUrl: "http://localhost:3000/logo.svg",
  authMethods: ["email", "sms"],
} as Config

export default function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="class" // toggles "class" on <html> (light/dark)
      defaultTheme="system" // use OS preference on first load
      enableSystem // allow auto-switch when OS theme changes
      disableTransitionOnChange // prevent flashy transitions on toggle
    >
      <CDPReactProvider config={CDP_CONFIG} theme={theme}>
        {children}
      </CDPReactProvider>
    </ThemeProvider>
  )
}
