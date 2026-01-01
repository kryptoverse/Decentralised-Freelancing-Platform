"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export function DeployFreelancerForm() {
  const [name, setName] = useState("")
  const [skills, setSkills] = useState("")
  const [bio, setBio] = useState("")
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<null | { txHash?: string; id?: string; message?: string }>(null)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch("/api/dev/deploy-freelancer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, skills, bio }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to deploy freelancer profile")
      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deploy Freelancer Profile</CardTitle>
        <CardDescription>Publish your freelancer identity and skills on-chain.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-3">
          <Input placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input
            placeholder="Key skills (comma-separated)"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
          />
          <Textarea placeholder="Short bio" value={bio} onChange={(e) => setBio(e.target.value)} />
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Deploying..." : "Deploy On-Chain"}
            </Button>
            {result?.txHash && (
              <a
                className="text-sm underline self-center"
                target="_blank"
                rel="noopener noreferrer"
                href={`https://sepolia.basescan.org/tx/${result.txHash}`}
              >
                View Tx
              </a>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {result?.id && <p className="text-sm text-muted-foreground">Profile ID: {result.id}</p>}
          {result?.message && <p className="text-sm text-muted-foreground">{result.message}</p>}
        </form>
      </CardContent>
    </Card>
  )
}

export function DeployCompanyForm() {
  const [name, setName] = useState("")
  const [ticker, setTicker] = useState("")
  const [desc, setDesc] = useState("")
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<null | { txHash?: string; id?: string; message?: string }>(null)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch("/api/dev/deploy-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ticker, description: desc }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to deploy company")
      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deploy Company</CardTitle>
        <CardDescription>Tokenize your company and publish metadata on-chain.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-3">
          <Input placeholder="Company name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input placeholder="Ticker (e.g. FCHN)" value={ticker} onChange={(e) => setTicker(e.target.value)} required />
          <Textarea placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Deploying..." : "Deploy On-Chain"}
            </Button>
            {result?.txHash && (
              <a
                className="text-sm underline self-center"
                target="_blank"
                rel="noopener noreferrer"
                href={`https://sepolia.basescan.org/tx/${result.txHash}`}
              >
                View Tx
              </a>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {result?.id && <p className="text-sm text-muted-foreground">Company ID: {result.id}</p>}
          {result?.message && <p className="text-sm text-muted-foreground">{result.message}</p>}
        </form>
      </CardContent>
    </Card>
  )
}
