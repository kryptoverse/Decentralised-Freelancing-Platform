"use client"

import type React from "react"

import { useIsSignedIn, useIsInitialized } from "@coinbase/cdp-hooks"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import Loading from "./Loading"

interface WalletGuardProps {
  children: React.ReactNode
}

export default function WalletGuard({ children }: WalletGuardProps) {
  const { isInitialized } = useIsInitialized()
  const { isSignedIn } = useIsSignedIn()
  const router = useRouter()

  useEffect(() => {
    if (isInitialized && !isSignedIn) {
      router.push("/")
    }
  }, [isInitialized, isSignedIn, router])

  if (!isInitialized) {
    return <Loading />
  }

  if (!isSignedIn) {
    return null
  }

  return <>{children}</>
}
