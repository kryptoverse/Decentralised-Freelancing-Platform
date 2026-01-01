import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body?.name || !body?.ticker) {
      return NextResponse.json({ error: "Name and ticker are required" }, { status: 400 })
    }

    // Simulate a deployment result
    const mock = {
      id: `company_${Math.random().toString(36).slice(2, 8)}`,
      txHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      message: "Company deployed (mock). Replace with real on-chain integration.",
    }
    return NextResponse.json(mock)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 })
  }
}
