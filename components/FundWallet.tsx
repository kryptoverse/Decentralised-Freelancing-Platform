"use client"

import { FundModal, type FundModalProps } from "@coinbase/cdp-react"
import { useCallback } from "react"
import { getBuyOptions, createBuyQuote } from "@/lib/onramp-api"
import { useEvmAddress } from "@coinbase/cdp-hooks"
import { AuthButton } from "@coinbase/cdp-react/components/AuthButton"

export default function FundWallet({
  onSuccess,
  network = "base",
  cryptoCurrency = "usdc",
  destinationAddress,
}: {
  onSuccess?: () => void
  network?: string
  cryptoCurrency?: string
  destinationAddress?: string
}) {
  const { evmAddress } = useEvmAddress()
  const effectiveDestination = destinationAddress ?? evmAddress ?? ""

  const fetchBuyQuote: FundModalProps["fetchBuyQuote"] = useCallback(async (params) => {
    return createBuyQuote(params)
  }, [])

  const fetchBuyOptions: FundModalProps["fetchBuyOptions"] = useCallback(async (params) => {
    return getBuyOptions(params)
  }, [])

  if (!effectiveDestination) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-md border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Connect your wallet to fund it with Onramp. After signing in, the Onramp modal will be available.
        </p>
        <AuthButton />
      </div>
    )
  }

  return (
    <>
      <FundModal
        country="US"
        subdivision="CA"
        cryptoCurrency={cryptoCurrency}
        fiatCurrency="usd"
        fetchBuyQuote={fetchBuyQuote}
        fetchBuyOptions={fetchBuyOptions}
        network={network}
        presetAmountInputs={[10, 25, 50]}
        onSuccess={onSuccess}
        destinationAddress={effectiveDestination}
      />
      <p className="small-text">
        Warning: this will cost real money unless you{" "}
        <a
          href="https://docs.cdp.coinbase.com/onramp-&-offramp/developer-guidance/faq#can-i-test-my-onramp-integration-by-creating-mock-buys-and-sends%3F"
          target="_blank"
          rel="noopener noreferrer"
        >
          enable mock buys and sends
        </a>
      </p>
    </>
  )
}
