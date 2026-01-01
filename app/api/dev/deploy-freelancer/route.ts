import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    // Validate minimal input
    if (!body?.name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    // Simulate a deployment result
    const mock = {
      id: `freelancer_${Math.random().toString(36).slice(2, 8)}`,
      txHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      message: "Freelancer profile deployed (mock). Replace with real on-chain integration.",
    }
    return NextResponse.json(mock)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 })
  }
}
