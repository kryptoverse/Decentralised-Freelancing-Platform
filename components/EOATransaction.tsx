"use client"

import { useSendEvmTransaction, useEvmAddress } from "@coinbase/cdp-hooks"
import { Button } from "@coinbase/cdp-react/components/ui/Button"
import { useState, useCallback } from "react"

interface Props {
  balance?: string
  onSuccess?: () => void
}

/**
 * Simple EOA (Externally Owned Account) transaction example.
 * This version requires the user to pay gas.
 */
export default function EOATransaction({ balance, onSuccess }: Props) {
  const { sendEvmTransaction } = useSendEvmTransaction()
  const { evmAddress } = useEvmAddress()
  const [isPending, setIsPending] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)

  const handleSendTx = useCallback(async () => {
    if (!evmAddress) return
    setIsPending(true)

    try {
      const { transactionHash } = await sendEvmTransaction({
        transaction: {
          to: evmAddress, // send to self for testing
          value: 1000000000000n, // 0.000001 ETH
          gas: 21000n,
          chainId: 84532, // Base Sepolia
          type: "eip1559",
        },
        evmAccount: evmAddress,
        network: "base-sepolia",
      })
      setTxHash(transactionHash)
      onSuccess?.()
    } catch (error) {
      console.error("Transaction failed:", error)
    } finally {
      setIsPending(false)
    }
  }, [evmAddress, sendEvmTransaction, onSuccess])

  return (
    <div className="flex flex-col gap-3 items-center">
      <h2 className="card-title">Send Transaction (EOA)</h2>
      <Button onClick={handleSendTx} isPending={isPending}>
        Send Transaction
      </Button>
      {txHash && (
        <p>
          Tx Hash:{" "}
          <a href={`https://sepolia.basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer">
            {txHash.slice(0, 6)}...{txHash.slice(-4)}
          </a>
        </p>
      )}
      {balance && <p className="text-xs text-gray-500">Balance: {balance} ETH</p>}
    </div>
  )
}
