"use client"

interface UserBalanceProps {
  balance?: string
  faucetName?: string
  faucetUrl?: string
}

export default function UserBalance({ balance, faucetName, faucetUrl }: UserBalanceProps) {
  return (
    <div className="flex flex-col gap-3 items-center">
      <h2 className="text-lg font-semibold">Your Balance</h2>
      {balance === undefined ? (
        <div className="animate-pulse h-8 w-32 bg-muted rounded"></div>
      ) : (
        <p className="text-2xl font-bold">{balance} ETH</p>
      )}
      {faucetName && faucetUrl && (
        <a href={faucetUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
          Get test tokens from {faucetName}
        </a>
      )}
    </div>
  )
}
